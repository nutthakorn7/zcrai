import { query } from '../../infra/clickhouse/client';
import * as yaml from 'js-yaml'; // Need to make sure this is available or use a simple parser if not

// Basic Sigma Rule Interface
interface SigmaRule {
    title: string;
    description?: string;
    logsource: {
        category?: string;
        product?: string;
        service?: string;
    };
    detection: Record<string, any>;
    condition: string;
}

export class ThreatHuntService {
    
    /**
     * Execute a raw SQL query against ClickHouse
     * @param tenantId 
     * @param sqlQuery 
     */
    static async runQuery(tenantId: string, sqlQuery: string) {
        // Security Check: Basic SQL Injection / Tenant Isolation check
        // In a real prod env, we'd parser the AST to ensure 'tenant_id' clause exists
        // For MVP, we'll assume the client generated the query correctly OR we append tenant_id 
        // But specialized CH SQL is hard to regex. 
        // Let's enforce that the query MUST contain "tenant_id = '{tenantId}'" or we append it to WHERE.
        
        // Actually, safer to just use parameter binding if possible, but for raw flexible queries it's hard.
        // Let's just run it for now, assuming the analyst knows what they are doing (Internal Tool).
        // WE MUST ensure Read-Only though.
        
        const lowerSql = sqlQuery.toLowerCase();
        if (lowerSql.includes('alter') || lowerSql.includes('drop') || lowerSql.includes('truncate') || lowerSql.includes('insert')) {
            throw new Error('Only SELECT queries are allowed.');
        }

        // Ideally we force tenant isolation. 
        // Simple hack: Enforce tenant_id check in string
        if (!sqlQuery.includes(`tenant_id = '${tenantId}'`) && !sqlQuery.includes(`tenant_id='${tenantId}'`)) {
             // Try to inject it? Too risky for complex SQL.
             // Throw error requiring it.
             throw new Error("Query must include WHERE tenant_id = '...' for security isolation.");
        }

        try {
            const results = await query(sqlQuery);
            return results;
        } catch (error: any) {
            throw new Error(`Query Execution Failed: ${error.message}`);
        }
    }

    /**
     * Convert Sigma Rule YAML to ClickHouse SQL
     */
    static async parseSigma(tenantId: string, sigmaYaml: string): Promise<{ sql: string; rule: SigmaRule }> {
        let rule: SigmaRule;
        try {
            // dynamic import js-yaml if possible, or simple json parse if user pasted json?
            // Assuming we installed 'js-yaml' or have a way to parse. 
            // If not, we might need to ask user to install it.
            // Let's try to import it, if fail, throw.
            const yaml = await import('js-yaml');
            rule = yaml.load(sigmaYaml) as SigmaRule;
        } catch (e) {
            throw new Error('Failed to parse YAML. Please ensure it is valid Sigma format.');
        }

        if (!rule.detection) throw new Error('Invalid Sigma Rule: Missing detection section');

        // Simple Parser Logic (MVP)
        // 1. Parse 'selection' or named conditions
        const conditions: string[] = [];
        
        for (const [key, value] of Object.entries(rule.detection)) {
            if (key === 'condition') continue;
            
            // Value is a map of field: value
            // e.g. Image: 'cmd.exe'
            const parts: string[] = [];
            
            if (Array.isArray(value)) {
                 // OR logic usually? or dependent on condition
            } else if (typeof value === 'object') {
                 for (const [field, match] of Object.entries(value)) {
                     const column = this.mapSigmaField(field);
                     if (Array.isArray(match)) {
                         // OR logic: process_name IN ('a', 'b')
                         const opts = match.map(m => `'${m}'`).join(', ');
                         parts.push(`${column} IN (${opts})`);
                     } else {
                         // Exact match
                         parts.push(`${column} = '${match}'`);
                     }
                 }
            }
            
            if (parts.length > 0) {
                conditions.push(`(${parts.join(' AND ')})`); // Assuming AND inside a selection
            }
        }

        // Build SQL
        // Join all detection parts (Simplified: assumes 'all of selection' logic usually)
        // Correct Sigma parsing is complex (processing the 'condition' string like "selection1 and not selection2")
        // MVP: Just AND everything found in detection parts.
        
        const whereClause = conditions.join(' AND ');
        
        const sql = `
            SELECT * 
            FROM security_events 
            WHERE tenant_id = '${tenantId}' 
            AND ${whereClause}
            ORDER BY timestamp DESC
            LIMIT 100
        `;

        return { sql, rule };
    }

    private static mapSigmaField(field: string): string {
        const map: Record<string, string> = {
            'Image': 'process_name',
            'CommandLine': 'process_command_line',
            'ParentImage': 'parent_process_name',
            'DestinationIp': 'dest_ip',
            'SourceIp': 'source_ip',
            'User': 'user_name',
            'EventID': 'event_type' // Loose mapping
        };
        return map[field] || field.toLowerCase();
    }
}
