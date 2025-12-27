import { db } from '../infra/db';
import { enrichmentQueue, observables, alerts } from '../infra/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { VirusTotalProvider } from '../core/enrichment-providers/virustotal';
import { AbuseIPDBProvider } from '../core/enrichment-providers/abuseipdb';
import { AlienVaultOTXProvider } from '../integrations/alienvault.provider';
import { URLScanProvider } from '../core/enrichment-providers/urlscan';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export class EnrichmentWorker {
  private vtProvider: VirusTotalProvider;
  private abuseIPDBProvider: AbuseIPDBProvider;
  private otxProvider: AlienVaultOTXProvider;
  private urlscanProvider: URLScanProvider; // Added URLScanProvider property
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.vtProvider = new VirusTotalProvider();
    this.abuseIPDBProvider = new AbuseIPDBProvider();
    this.otxProvider = new AlienVaultOTXProvider();
    this.urlscanProvider = new URLScanProvider(); // Initialized URLScanProvider
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️ Enrichment worker already running');
      return;
    }

    console.log('🔄 Starting enrichment worker...');
    this.isRunning = true;

    // Process immediately on start
    this.processQueue();

    // Then process every 30 seconds
    this.intervalId = setInterval(() => {
      this.processQueue();
    }, 30000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    console.log('⏹️ Enrichment worker stopped');
  }

  private async processQueue() {
    try {
      // Get pending items
      const pending = await db
        .select()
        .from(enrichmentQueue)
        .where(eq(enrichmentQueue.status, 'pending'))
        .limit(10); // Process 10 at a time

      if (pending.length === 0) {
        return; // Nothing to process
      }

      console.log(`📊 Processing ${pending.length} enrichment items...`);

      for (const item of pending) {
        try {
          // Mark as processing
          await db
            .update(enrichmentQueue)
            .set({ status: 'processing' })
            .where(eq(enrichmentQueue.id, item.id));

          // Get observable
          const [observable] = await db
            .select()
            .from(observables)
            .where(eq(observables.id, item.observableId));

          if (!observable) {
            throw new Error('Observable not found');
          }

          // Check if already enriched recently (cache)
          if (observable.enrichedAt) {
            const age = Date.now() - new Date(observable.enrichedAt).getTime();
            if (age < CACHE_TTL) {
              console.log(`✅ Using cached enrichment for ${observable.value}`);
              await db
                .update(enrichmentQueue)
                .set({ status: 'completed', processedAt: new Date() })
                .where(eq(enrichmentQueue.id, item.id));
              continue;
            }
          }

          // Enrich based on provider
          let result: any = {};

          if (item.provider === 'virustotal') {
            result = await this.enrichWithVirusTotal(observable);
          } else if (item.provider === 'abuseipdb') {
            result = await this.enrichWithAbuseIPDB(observable);
          } else if (item.provider === 'alienvault') {
            result = await this.enrichWithOTX(observable);
          } else if (item.provider === 'urlscan') {
            result = await this.enrichWithURLScan(observable);
          }

          // Merge with existing enrichment data
          const existingData = (observable.enrichmentData as any) || {};
          const mergedData = {
            ...existingData,
            [item.provider]: result,
          };

          // Update observable
          await db
            .update(observables)
            .set({
              enrichmentData: mergedData,
              enrichedAt: new Date(),
              // Auto-set malicious flag if VirusTotal or AbuseIPDB says so
              isMalicious: result.malicious || result.abuseConfidenceScore > 75 || observable.isMalicious,
              updatedAt: new Date(),
            })
            .where(eq(observables.id, observable.id));

          // Mark queue item as completed
          await db
            .update(enrichmentQueue)
            .set({
              status: 'completed',
              result,
              processedAt: new Date(),
            })
            .where(eq(enrichmentQueue.id, item.id));

          console.log(`✅ Enriched ${observable.type}: ${observable.value}`);

          // --- NEW: Trigger AI Triage if this was the last pending enrichment for an alert ---
          try {
            const affectedAlerts = await db
              .select()
              .from(alerts)
              .where(and(
                eq(alerts.aiTriageStatus, 'enriching'),
                // We need to check if this alert uses this observable
                // Since observables table has alertId, we can use that directly
                eq(alerts.id, observable.alertId as string)
              ));

            for (const alert of affectedAlerts) {
              // Check if ALL observables for this alert are enriched
              const allObservables = await db
                .select()
                .from(observables)
                .where(eq(observables.alertId, alert.id));
              
              const pendingEnrichment = await db
                .select()
                .from(enrichmentQueue)
                .where(and(
                  inArray(enrichmentQueue.observableId, allObservables.map(o => o.id)),
                  eq(enrichmentQueue.status, 'pending')
                ));

              if (pendingEnrichment.length === 0) {
                console.log(`🚀 All observables enriched for alert ${alert.id}. Triggering AI Triage...`);
                const { AITriageService } = await import('../core/services/ai-triage.service');
                // We can't easily reconstruction the original 'data' object here, 
                // but AITriageService.analyze fetches what it needs from the DB anyway.
                // We just need to pass the alertId and some basic info.
                AITriageService.analyze(alert.id, alert).catch(e => console.error(`AI Triage trigger failed for ${alert.id}:`, e));
              }
            }
          } catch (e) {
            console.warn("[EnrichmentWorker] AI Triage Trigger Check failed:", e);
          }

        } catch (error: any) {
          console.error(`❌ Enrichment failed for item ${item.id}:`, error.message);

          const retryCount = parseInt(item.retryCount) + 1;

          if (retryCount >= 3) {
            // Max retries reached, mark as failed
            await db
              .update(enrichmentQueue)
              .set({
                status: 'failed',
                error: error.message,
                retryCount: retryCount.toString(),
                processedAt: new Date(),
              })
              .where(eq(enrichmentQueue.id, item.id));
          } else {
            // Reset to pending for retry
            await db
              .update(enrichmentQueue)
              .set({
                status: 'pending',
                error: error.message,
                retryCount: retryCount.toString(),
              })
              .where(eq(enrichmentQueue.id, item.id));
          }
        }
      }
    } catch (error) {
      console.error('❌ Enrichment worker error:', error);
    }
  }

  private async enrichWithVirusTotal(observable: any) {
    switch (observable.type) {
      case 'ip':
        return await this.vtProvider.enrichIP(observable.value);
      case 'domain':
        return await this.vtProvider.enrichDomain(observable.value);
      case 'url':
        return await this.vtProvider.enrichURL(observable.value);
      case 'hash':
        return await this.vtProvider.enrichHash(observable.value);
      default:
        throw new Error(`Unsupported type for VirusTotal: ${observable.type}`);
    }
  }

  private async enrichWithAbuseIPDB(observable: any) {
    if (observable.type !== 'ip') {
      throw new Error('AbuseIPDB only supports IP addresses');
    }
    return await this.abuseIPDBProvider.checkIP(observable.value);
  }

  private async enrichWithOTX(observable: any) {
    switch (observable.type) {
      case 'ip':
        return await this.otxProvider.enrichIP(observable.value);
      case 'domain':
        return await this.otxProvider.enrichDomain(observable.value);
      case 'url':
        return await this.otxProvider.enrichURL(observable.value);
      case 'hash':
        return await this.otxProvider.enrichHash(observable.value);
      default:
        throw new Error(`Unsupported type for AlienVault OTX: ${observable.type}`);
    }
  }
  private async enrichWithURLScan(observable: any) {
    if (observable.type !== 'url' && observable.type !== 'domain') {
      throw new Error('URLScan only supports URLs and domains');
    }
    return await this.urlscanProvider.checkURL(observable.value);
  }
}
