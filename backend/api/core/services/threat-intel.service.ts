/**
 * Threat Intel Service
 * Unified interface for all threat intelligence providers
 * Supports API keys from both env vars AND Integration settings UI
 */

import { VirusTotalProvider } from '../enrichment-providers/virustotal';
import { AbuseIPDBProvider } from '../enrichment-providers/abuseipdb';
import { AlienVaultOTXProvider } from '../enrichment-providers/alienvault-otx';
import { db } from '../../infra/db';
import { apiKeys } from '../../infra/db/schema';
import { eq } from 'drizzle-orm';
import { Encryption } from '../../utils/encryption';

export interface ThreatIntelResult {
  indicator: string;
  type: 'ip' | 'domain' | 'url' | 'hash';
  verdict: 'clean' | 'suspicious' | 'malicious';
  confidenceScore: number; // 0-100
  sources: {
    name: string;
    found: boolean;
    risk: string;
    details: Record<string, any>;
  }[];
  tags: string[];
  malwareFamilies: string[];
  firstSeen?: string;
  lastSeen?: string;
  queriedAt: string;
}

export interface ThreatFeedSummary {
  totalIndicators: number;
  maliciousCount: number;
  suspiciousCount: number;
  cleanCount: number;
  topTags: { tag: string; count: number }[];
  recentQueries: ThreatIntelResult[];
}

// In-memory cache for recent queries
const queryCache = new Map<string, { result: ThreatIntelResult; expiresAt: number }>();
const recentQueries: ThreatIntelResult[] = [];
const CACHE_TTL = 3600000; // 1 hour

// Cache for API keys from DB
let apiKeyCache: { keys: Map<string, string>; expiresAt: number } | null = null;
const KEY_CACHE_TTL = 300000; // 5 minutes

export const ThreatIntelService = {
  virustotal: new VirusTotalProvider(),
  abuseipdb: new AbuseIPDBProvider(),
  otx: new AlienVaultOTXProvider(),

  /**
   * Get API key from DB or env var
   */
  async getApiKey(provider: string): Promise<string | undefined> {
    // Check cache first
    if (apiKeyCache && apiKeyCache.expiresAt > Date.now()) {
      return apiKeyCache.keys.get(provider);
    }

    // Fetch from DB
    const keys = new Map<string, string>();
    
    try {
      const dbKeys = await db.select()
        .from(apiKeys)
        .where(eq(apiKeys.provider, provider));

      for (const key of dbKeys) {
        try {
          const decrypted = Encryption.decrypt(key.encryptedKey);
          // Handle both raw strings and JSON objects
          let apiKey: string;
          try {
            const parsed = JSON.parse(decrypted);
            apiKey = parsed.apiKey || decrypted;
          } catch {
            apiKey = decrypted;
          }
          keys.set(key.provider, apiKey);
        } catch (e) {
          console.error(`Failed to decrypt ${provider} key:`, e);
        }
      }
    } catch (e) {
      // DB not available, fall through to env vars
    }

    // Also load other threat intel providers
    for (const p of ['virustotal', 'abuseipdb', 'alienvault-otx']) {
      if (!keys.has(p)) {
        try {
          const dbKeys = await db.select()
            .from(apiKeys)
            .where(eq(apiKeys.provider, p));
          
          for (const key of dbKeys) {
            try {
              const decrypted = Encryption.decrypt(key.encryptedKey);
              let apiKey: string;
              try {
                const parsed = JSON.parse(decrypted);
                apiKey = parsed.apiKey || decrypted;
              } catch {
                apiKey = decrypted;
              }
              keys.set(key.provider, apiKey);
            } catch (e) { /* ignore */ }
          }
        } catch (e) { /* ignore */ }
      }
    }

    // Cache the results
    apiKeyCache = { keys, expiresAt: Date.now() + KEY_CACHE_TTL };

    // Return from cache or fall back to env var
    const dbKey = keys.get(provider);
    if (dbKey) return dbKey;

    // Fallback to env vars
    switch (provider) {
      case 'virustotal': return process.env.VIRUSTOTAL_API_KEY;
      case 'abuseipdb': return process.env.ABUSEIPDB_API_KEY;
      case 'alienvault-otx': return process.env.OTX_API_KEY;
      default: return undefined;
    }
  },

  /**
   * Lookup an indicator across all threat intel sources
   */
  async lookup(indicator: string, type: 'ip' | 'domain' | 'url' | 'hash'): Promise<ThreatIntelResult> {
    const cacheKey = `${type}:${indicator}`;
    const cached = queryCache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    // Load API keys from DB and set on providers
    const [vtKey, abuseKey, otxKey] = await Promise.all([
      this.getApiKey('virustotal'),
      this.getApiKey('abuseipdb'),
      this.getApiKey('alienvault-otx'),
    ]);
    
    if (vtKey) this.virustotal.setApiKey(vtKey);
    if (abuseKey) this.abuseipdb.setApiKey(abuseKey);
    if (otxKey) this.otx.setApiKey(otxKey);

    const sources: ThreatIntelResult['sources'] = [];
    let allTags: string[] = [];
    let allMalwareFamilies: string[] = [];
    let maliciousCount = 0;
    let suspiciousCount = 0;

    // Query VirusTotal
    try {
      let vtResult;
      switch (type) {
        case 'ip':
          vtResult = await this.virustotal.enrichIP(indicator);
          break;
        case 'domain':
          vtResult = await this.virustotal.enrichDomain(indicator);
          break;
        case 'url':
          vtResult = await this.virustotal.enrichURL(indicator);
          break;
        case 'hash':
          vtResult = await this.virustotal.enrichHash(indicator);
          break;
      }

      if (vtResult.malicious) maliciousCount++;
      if (Array.isArray(vtResult.categories)) {
        allTags.push(...vtResult.categories);
      }

      sources.push({
        name: 'VirusTotal',
        found: vtResult.malicious ?? false,
        risk: vtResult.malicious ? 'malicious' : 'clean',
        details: vtResult
      });
    } catch (e: any) {
      sources.push({
        name: 'VirusTotal',
        found: false,
        risk: 'error',
        details: { error: e.message }
      });
    }

    // Query AbuseIPDB (IP only)
    if (type === 'ip') {
      try {
        const abuseResult = await this.abuseipdb.checkIP(indicator);
        
        const isHighRisk = abuseResult.abuseConfidenceScore > 50;
        const isMediumRisk = abuseResult.abuseConfidenceScore > 20;

        sources.push({
          name: 'AbuseIPDB',
          found: abuseResult.totalReports > 0,
          risk: isHighRisk ? 'malicious' : (isMediumRisk ? 'suspicious' : 'clean'),
          details: abuseResult
        });

        if (isHighRisk) maliciousCount++;
        else if (isMediumRisk) suspiciousCount++;
      } catch (e: any) {
        sources.push({
          name: 'AbuseIPDB',
          found: false,
          risk: 'error',
          details: { error: e.message }
        });
      }
    }

    // Query AlienVault OTX
    try {
      let otxResult;
      switch (type) {
        case 'ip':
          otxResult = await this.otx.checkIP(indicator);
          break;
        case 'domain':
          otxResult = await this.otx.checkDomain(indicator);
          break;
        case 'hash':
          otxResult = await this.otx.checkHash(indicator);
          break;
        default:
          otxResult = { found: false, pulseCount: 0, tags: [], malwareFamilies: [], risk: 'low' as const };
      }

      sources.push({
        name: 'AlienVault OTX',
        found: otxResult.found,
        risk: otxResult.risk,
        details: otxResult
      });

      if (otxResult.risk === 'critical' || otxResult.risk === 'high') maliciousCount++;
      else if (otxResult.risk === 'medium') suspiciousCount++;

      allTags.push(...otxResult.tags);
      allMalwareFamilies.push(...otxResult.malwareFamilies);
    } catch (e: any) {
      sources.push({
        name: 'AlienVault OTX',
        found: false,
        risk: 'error',
        details: { error: e.message }
      });
    }

    // Calculate verdict
    let verdict: 'clean' | 'suspicious' | 'malicious';
    let confidenceScore: number;

    if (maliciousCount >= 2) {
      verdict = 'malicious';
      confidenceScore = Math.min(95, 60 + maliciousCount * 15);
    } else if (maliciousCount === 1 || suspiciousCount >= 2) {
      verdict = 'suspicious';
      confidenceScore = Math.min(70, 40 + suspiciousCount * 15);
    } else {
      verdict = 'clean';
      confidenceScore = Math.max(10, 100 - suspiciousCount * 10);
    }

    const result: ThreatIntelResult = {
      indicator,
      type,
      verdict,
      confidenceScore,
      sources,
      tags: [...new Set(allTags)],
      malwareFamilies: [...new Set(allMalwareFamilies)],
      queriedAt: new Date().toISOString()
    };

    // Cache result
    queryCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL });
    
    // Store in recent queries
    recentQueries.unshift(result);
    if (recentQueries.length > 100) recentQueries.pop();

    return result;
  },

  /**
   * Bulk lookup for multiple indicators
   */
  async bulkLookup(indicators: { value: string; type: 'ip' | 'domain' | 'url' | 'hash' }[]): Promise<ThreatIntelResult[]> {
    const results: ThreatIntelResult[] = [];
    
    // Process in batches of 5 to avoid rate limits
    for (let i = 0; i < indicators.length; i += 5) {
      const batch = indicators.slice(i, i + 5);
      const batchResults = await Promise.all(
        batch.map(ind => this.lookup(ind.value, ind.type).catch(e => ({
          indicator: ind.value,
          type: ind.type,
          verdict: 'clean' as const,
          confidenceScore: 0,
          sources: [{ name: 'Error', found: false, risk: 'error', details: { error: e.message } }],
          tags: [],
          malwareFamilies: [],
          queriedAt: new Date().toISOString()
        })))
      );
      results.push(...batchResults);
      
      // Small delay between batches
      if (i + 5 < indicators.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    return results;
  },

  /**
   * Get summary of threat feed activity
   */
  getSummary(): ThreatFeedSummary {
    const maliciousCount = recentQueries.filter(q => q.verdict === 'malicious').length;
    const suspiciousCount = recentQueries.filter(q => q.verdict === 'suspicious').length;
    const cleanCount = recentQueries.filter(q => q.verdict === 'clean').length;

    // Count tags
    const tagCounts = new Map<string, number>();
    recentQueries.forEach(q => {
      q.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    const topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalIndicators: recentQueries.length,
      maliciousCount,
      suspiciousCount,
      cleanCount,
      topTags,
      recentQueries: recentQueries.slice(0, 10)
    };
  },

  /**
   * Check if providers are configured (from DB or env)
   */
  async getProviderStatus(): Promise<{ name: string; configured: boolean; source: 'database' | 'env' | 'none' }[]> {
    const providers = [
      { name: 'VirusTotal', provider: 'virustotal', envKey: 'VIRUSTOTAL_API_KEY' },
      { name: 'AbuseIPDB', provider: 'abuseipdb', envKey: 'ABUSEIPDB_API_KEY' },
      { name: 'AlienVault OTX', provider: 'alienvault-otx', envKey: 'OTX_API_KEY' },
    ];

    const results = [];

    for (const p of providers) {
      let configured = false;
      let source: 'database' | 'env' | 'none' = 'none';

      // Check DB first
      try {
        const dbKeys = await db.select()
          .from(apiKeys)
          .where(eq(apiKeys.provider, p.provider));
        
        if (dbKeys.length > 0) {
          configured = true;
          source = 'database';
        }
      } catch (e) { /* DB not available */ }

      // Fall back to env
      if (!configured && process.env[p.envKey]) {
        configured = true;
        source = 'env';
      }

      results.push({ name: p.name, configured, source });
    }

    return results;
  },

  /**
   * Clear API key cache (call after saving new keys)
   */
  clearKeyCache() {
    apiKeyCache = null;
  }
};
