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
        // 1. Basic Security Check
        const lowerSql = sqlQuery.toLowerCase();
        if (lowerSql.match(/\b(alter|drop|truncate|insert|update|delete|create|grant)\b/)) {
            throw new Error('Only SELECT queries are allowed.');
        }

        // 2. Normalize and Inject Tenant ID
        // This is a naive injection for MVP. In production, use a real SQL parser or parameterized queries.
        // We look for the WHERE clause to append AND tenant_id = ...
        // If no WHERE, we add WHERE tenant_id = ...
        
        let finalQuery = sqlQuery;

        // Check if tenant_id is already present to avoid duplication
        if (!finalQuery.includes(`tenant_id = '${tenantId}'`) && !finalQuery.includes(`tenant_id='${tenantId}'`)) {
            const whereMatch = finalQuery.match(/\bwhere\b/i);
            if (whereMatch) {
                const index = whereMatch.index!;
                const preWhere = finalQuery.substring(0, index);
                const postWhere = finalQuery.substring(index + whereMatch[0].length);
                
                // Identify where the conditions end (ORDER BY, LIMIT, etc.)
                const keywordMatch = postWhere.match(/\b(ORDER BY|LIMIT|GROUP BY|HAVING|UNION)\b/i);
                let conditions = postWhere;
                let tail = '';
                
                if (keywordMatch) {
                    conditions = postWhere.substring(0, keywordMatch.index);
                    tail = postWhere.substring(keywordMatch.index!);
                }
                
                // Construct safer query: WHERE tenant_id = '...' AND (original_conditions)
                finalQuery = `${preWhere} WHERE tenant_id = '${tenantId}' AND (${conditions}) ${tail}`;
            } else {
                // If table is specified, we need to find where to put WHERE
                // Simple strategy: Split by keywords
                const parts = finalQuery.split(/(?=\bORDER\b|\bLIMIT\b|\bGROUP\b)/i);
                // parts[0] is everything before OREDER/LIMIT
                // Append WHERE to parts[0]
                parts[0] = `${parts[0]} WHERE tenant_id = '${tenantId}'`;
                finalQuery = parts.join(' ');
            }
        }

        try {
            const results = await query(finalQuery);
            return results;
        } catch (error: any) {
            console.error('ClickHouse Query Error:', error);
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
