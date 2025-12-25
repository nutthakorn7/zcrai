import { db } from '../../infra/db';
import { observables, enrichmentQueue } from '../../infra/db/schema';
import { eq, and, desc, or, sql } from 'drizzle-orm';
import { DGADetector } from '../ml/dga-detector';

// IOC extraction patterns
const IOC_PATTERNS = {
  ipv4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
  domain: /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  url: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/g,
  md5: /\b[a-f0-9]{32}\b/gi,
  sha1: /\b[a-f0-9]{40}\b/gi,
  sha256: /\b[a-f0-9]{64}\b/gi,
};

export class ObservableService {
  // Create observable
  static async create(data: {
    tenantId: string;
    caseId?: string;
    alertId?: string;
    type: string;
    value: string;
    isMalicious?: boolean;
    tlpLevel?: string;
    tags?: string[];
    source?: string;
  }) {
    // Check for existing observable (deduplication)
    const [existing] = await db
      .select()
      .from(observables)
      .where(
        and(
          eq(observables.tenantId, data.tenantId),
          eq(observables.type, data.type),
          eq(observables.value, data.value)
        )
      );

    if (existing) {
      // Update sighting count and lastSeen
      const [updated] = await db
        .update(observables)
        .set({
          lastSeen: new Date(),
          sightingCount: (parseInt(existing.sightingCount) + 1).toString(),
          updatedAt: new Date(),
        })
        .where(eq(observables.id, existing.id))
        .returning();

      return updated;
    }

    // ML: DGA Detection for domains
    let dgaAnalysis = null;
    if (data.type === 'domain') {
      const dgaResult = DGADetector.detect(data.value);
      if (dgaResult.isDGA && dgaResult.confidence > 0.6) {
        data.isMalicious = true; // Auto-flag as malicious if high-confidence DGA
        dgaAnalysis = dgaResult;
        data.tags = [...(data.tags || []), 'dga', `dga-confidence-${Math.round(dgaResult.confidence * 100)}`];
      }
    }

    // Create new observable
    const [observable] = await db.insert(observables).values({
      ...data,
      source: data.source || 'manual',
      tags: data.tags || [],
      sightingCount: '1',
      enrichmentData: dgaAnalysis ? { dga: dgaAnalysis } as any : undefined,
    }).returning();

    // Queue for enrichment (if external enrichment is needed)
    if (['ip', 'domain', 'hash', 'url'].includes(data.type)) {
      await this.queueEnrichment(observable.id, data.type);
    }

    return observable;
  }

  // Extract IOCs from text
  static async extract(text: string, tenantId: string, caseId?: string, alertId?: string, source: string = 'system') {
    const extractedIOCs: any[] = [];

    // IPv4
    const ips = text.match(IOC_PATTERNS.ipv4) || [];
    for (const ip of [...new Set(ips)]) {
      // Filter out private/local IPs
      if (this.isPrivateIP(ip)) continue;
      
      const observable = await this.create({
        tenantId,
        caseId,
        alertId,
        type: 'ip',
        value: ip,
        source,
      });
      extractedIOCs.push(observable);
    }

    // Domains
    const domains = text.match(IOC_PATTERNS.domain) || [];
    for (const domain of [...new Set(domains)]) {
      // Filter out common false positives
      if (this.isCommonDomain(domain)) continue;
      
      const observable = await this.create({
        tenantId,
        caseId,
        alertId,
        type: 'domain',
        value: domain.toLowerCase(),
        source,
      });
      extractedIOCs.push(observable);
    }

    // Emails
    const emails = text.match(IOC_PATTERNS.email) || [];
    for (const email of [...new Set(emails)]) {
      const observable = await this.create({
        tenantId,
        caseId,
        alertId,
        type: 'email',
        value: email.toLowerCase(),
        source,
      });
      extractedIOCs.push(observable);
    }

    // URLs
    const urls = text.match(IOC_PATTERNS.url) || [];
    for (const url of [...new Set(urls)]) {
      const observable = await this.create({
        tenantId,
        caseId,
        alertId,
        type: 'url',
        value: url,
        source,
      });
      extractedIOCs.push(observable);
    }

    // Hashes
    const md5s = text.match(IOC_PATTERNS.md5) || [];
    const sha1s = text.match(IOC_PATTERNS.sha1) || [];
    const sha256s = text.match(IOC_PATTERNS.sha256) || [];

    for (const hash of [...new Set([...md5s, ...sha1s, ...sha256s])]) {
      const observable = await this.create({
        tenantId,
        caseId,
        alertId,
        type: 'hash',
        value: hash.toLowerCase(),
        source,
      });
      extractedIOCs.push(observable);
    }

    return extractedIOCs;
  }

  // Helper: Check if IP is private
  private static isPrivateIP(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168)
    );
  }

  // Helper: Check if domain is common (to reduce false positives)
  private static isCommonDomain(domain: string): boolean {
    const common = ['localhost', 'example.com', 'test.com', 'invalid', 'local'];
    return common.some(c => domain.includes(c));
  }

  // List observables
  static async list(filters: {
    tenantId: string;
    type?: string[];
    caseId?: string;
    alertId?: string;
    isMalicious?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [eq(observables.tenantId, filters.tenantId)];

    if (filters.type && filters.type.length > 0) {
      conditions.push(
        or(...filters.type.map(t => eq(observables.type, t))) as any
      );
    }

    if (filters.caseId) {
      conditions.push(eq(observables.caseId, filters.caseId));
    }

    if (filters.alertId) {
      conditions.push(eq(observables.alertId, filters.alertId));
    }

    if (filters.isMalicious !== undefined) {
      conditions.push(eq(observables.isMalicious, filters.isMalicious));
    }

    if (filters.search) {
      conditions.push(sql`${observables.value} ILIKE ${'%' + filters.search + '%'}`);
    }

    const result = await db
      .select()
      .from(observables)
      .where(and(...conditions))
      .orderBy(desc(observables.createdAt))
      .limit(filters.limit || 100)
      .offset(filters.offset || 0);

    return result;
  }

  // Get by ID
  static async getById(id: string, tenantId: string) {
    const [observable] = await db
      .select()
      .from(observables)
      .where(and(eq(observables.id, id), eq(observables.tenantId, tenantId)));

    return observable;
  }

  // Get sightings (cases/alerts with this IOC)
  static async getSightings(id: string, tenantId: string) {
    const [observable] = await db
      .select()
      .from(observables)
      .where(and(eq(observables.id, id), eq(observables.tenantId, tenantId)));

    if (!observable) return { cases: [], alerts: [] };

    // Find all observables with same type and value
    const similar = await db
      .select()
      .from(observables)
      .where(
        and(
          eq(observables.tenantId, tenantId),
          eq(observables.type, observable.type),
          eq(observables.value, observable.value)
        )
      );

    const caseIds = similar.filter(o => o.caseId).map(o => o.caseId);
    const alertIds = similar.filter(o => o.alertId).map(o => o.alertId);

    return {
      cases: caseIds,
      alerts: alertIds,
      totalSightings: similar.length,
    };
  }

  // Mark as malicious or safe
  static async setMaliciousStatus(id: string, tenantId: string, isMalicious: boolean) {
    const [updated] = await db
      .update(observables)
      .set({ isMalicious, updatedAt: new Date() })
      .where(and(eq(observables.id, id), eq(observables.tenantId, tenantId)))
      .returning();

    return updated;
  }

  // Add tag
  static async addTag(id: string, tenantId: string, tag: string) {
    const [observable] = await db
      .select()
      .from(observables)
      .where(and(eq(observables.id, id), eq(observables.tenantId, tenantId)));

    if (!observable) throw new Error('Observable not found');

    const currentTags = (observable.tags as string[]) || [];
    if (currentTags.includes(tag)) return observable;

    const [updated] = await db
      .update(observables)
      .set({
        tags: [...currentTags, tag],
        updatedAt: new Date(),
      })
      .where(eq(observables.id, id))
      .returning();

    return updated;
  }

  // Remove tag
  static async removeTag(id: string, tenantId: string, tag: string) {
    const [observable] = await db
      .select()
      .from(observables)
      .where(and(eq(observables.id, id), eq(observables.tenantId, tenantId)));

    if (!observable) throw new Error('Observable not found');

    const currentTags = (observable.tags as string[]) || [];
    const [updated] = await db
      .update(observables)
      .set({
        tags: currentTags.filter(t => t !== tag),
        updatedAt: new Date(),
      })
      .where(eq(observables.id, id))
      .returning();

    return updated;
  }

  // Queue for enrichment
  private static async queueEnrichment(observableId: string, type: string) {
    const providers: string[] = [];

    if (type === 'ip') {
      providers.push('virustotal', 'abuseipdb');
    } else if (type === 'domain' || type === 'url') {
      providers.push('virustotal');
    } else if (type === 'hash') {
      providers.push('virustotal');
    }

    for (const provider of providers) {
      await db.insert(enrichmentQueue).values({
        observableId,
        provider,
        status: 'pending',
        retryCount: '0',
      });
    }
  }

  // Trigger enrichment now
  static async enrich(id: string, tenantId: string) {
    const observable = await this.getById(id, tenantId);
    if (!observable) throw new Error('Observable not found');

    // Queue if not already queued
    await this.queueEnrichment(id, observable.type);

    return { message: 'Enrichment queued' };
  }

  // Delete observable
  static async delete(id: string, tenantId: string) {
    await db
      .delete(observables)
      .where(and(eq(observables.id, id), eq(observables.tenantId, tenantId)));

    return { success: true };
  }
}
