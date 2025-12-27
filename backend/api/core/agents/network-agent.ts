import { BaseAgent, AgentTask, AgentResult } from './base-agent';
import { VirusTotalProvider } from '../enrichment-providers/virustotal';
import { AbuseIPDBProvider } from '../enrichment-providers/abuseipdb';
import { AlienVaultOTXProvider } from '../enrichment-providers/alienvault-otx';
import { clickhouse } from '../../infra/clickhouse/client';

export class NetworkAgent extends BaseAgent {
    private vtProvider = new VirusTotalProvider();
    private abuseProvider = new AbuseIPDBProvider();
    private otxProvider = new AlienVaultOTXProvider();

    constructor() {
        super('Network');
    }

    async process(task: AgentTask): Promise<AgentResult> {
        this.log(`Received task: ${task.type}`);
        
        try {
            switch (task.type) {
                case 'check_ip':
                    return await this.checkIP(task.params.ip);
                case 'query_logs':
                    return await this.queryLogs(task.params.ip, task.params.hours || 24);
                default:
                    throw new Error(`Unknown task type: ${task.type}`);
            }
        } catch (error: any) {
            return {
                agent: this.name,
                status: 'failed',
                error: error.message,
                summary: `Network analysis failed: ${error.message}`
            };
        }
    }

    private async checkIP(ip: string): Promise<AgentResult> {
        this.log(`Analyzing IP: ${ip}`);
        const results = [];

        // Parallel execution for speed
        const [vt, abuse, otx] = await Promise.allSettled([
            this.vtProvider.enrichIP(ip)
                .catch(e => ({ error: e.message, source: 'VirusTotal' })),
            this.abuseProvider.checkIP(ip)
                .catch(e => ({ error: e.message, source: 'AbuseIPDB' })),
            this.otxProvider.checkIP(ip)
                .catch(e => ({ error: e.message, source: 'AlienVault' }))
        ]);

        const vtData = vt.status === 'fulfilled' ? vt.value : { error: vt.reason };
        const abuseData = abuse.status === 'fulfilled' ? abuse.value : { error: abuse.reason };
        const otxData = otx.status === 'fulfilled' ? otx.value : { error: otx.reason };

        results.push({ source: 'VirusTotal', data: vtData });
        results.push({ source: 'AbuseIPDB', data: abuseData });
        results.push({ source: 'AlienVault', data: otxData });

        const isMalicious = (vtData as any)?.malicious || (otxData as any)?.pulseCount > 0 || (abuseData as any)?.abuseConfidenceScore > 50;

        return {
            agent: this.name,
            status: 'success',
            data: { ip, results },
            summary: isMalicious 
                ? `🚨 IP ${ip} is FLAGGED as malicious by multiple sources.` 
                : `✅ IP ${ip} appears clean across threat intel feeds.`
        };
    }

    private async queryLogs(ip: string, hours: number): Promise<AgentResult> {
        this.log(`Querying logs for ${ip} (last ${hours}h)`);
        
        try {
            const query = `
                SELECT timestamp, event_type, source_ip, dest_ip, user_name, result
                FROM events
                WHERE (source_ip = '${ip}' OR dest_ip = '${ip}')
                AND timestamp >= now() - INTERVAL ${hours} HOUR
                ORDER BY timestamp DESC
                LIMIT 20
            `;
            
            const result = await clickhouse.query({ query });
            const rows = await result.json();
            const data = rows.data || [];

            return {
                agent: this.name,
                status: 'success',
                data: { hits: data.length, logs: data },
                summary: data.length > 0
                    ? `Found ${data.length} network events involving ${ip}.`
                    : `No network activity found for ${ip} in the last ${hours}h.`
            };
        } catch (e: any) {
             return {
                agent: this.name,
                status: 'failed',
                error: e.message,
                summary: `Log query failed for ${ip}`
            };
        }
    }
}
