import { db } from '../infra/db';
import { detectionRules, tenants } from '../infra/db/schema';
import { DetectionService } from '../core/services/detection.service';

/**
 * Seed Default Detection Rules
 * - 5 Basic Rules
 * - 2 Critical Auto-Case Rules
 */
export async function seedDetectionRules() {
    console.log('🌱 Seeding Detection Rules...');

    // 1. Get All Tenants
    const allTenants = await db.query.tenants.findMany();
    
    if (allTenants.length === 0) {
        console.error('❌ No tenants found. Please seed tenant first.');
        return;
    }

    console.log(`🔍 Found ${allTenants.length} tenants. Seeding rules for all...`);

    const rulesTemplate = [
        // 1. Brute Force (Critical -> Auto Case)
        {
            name: 'Critical Brute Force Attack',
            description: 'Detects more than 20 failed login attempts from a single IP within 1 minute.',
            severity: 'critical',
            query: "event_type = 'login_failed' GROUP BY src_ip HAVING count() > 20",
            runIntervalSeconds: 60,
            isEnabled: true,
            actions: { 
                auto_case: true,
                case_title_template: '[Auto] Brute Force Detected from {src_ip}',
                severity_override: 'critical',
                group_by: ['src_ip']
            }
        },
        // 2. Modified System File (High)
        {
            name: 'Sensitive System File Modification',
            description: 'Detects changes to /etc/passwd, /etc/shadow, or system32 files.',
            severity: 'high',
            query: "event_type = 'file_modification' AND file_path IN ('/etc/passwd', '/etc/shadow', 'C:\\Windows\\System32\\cmd.exe')",
            runIntervalSeconds: 300,
            isEnabled: true,
            actions: { auto_case: false }
        },
        // 3. Port Scan (Medium)
        {
            name: 'Port Scanning Activity',
            description: 'Detects connection attempts to more than 50 unique ports from single IP.',
            severity: 'medium',
            query: "event_type = 'network_connection' GROUP BY src_ip HAVING uniq(dest_port) > 50",
            runIntervalSeconds: 600,
            isEnabled: true,
            actions: { auto_case: false, group_by: ['src_ip'] }
        },
        // 4. Ransomware Pattern (Critical -> Auto Case)
        {
            name: 'Ransomware File Extension Activity',
            description: 'Detects rapid creation of files with known ransomware extensions (.lock, .enc, .wcry).',
            severity: 'critical',
            query: "event_type = 'file_create' AND file_extension IN ('lock', 'enc', 'wcry') GROUP BY user HAVING count() > 50",
            runIntervalSeconds: 60,
            isEnabled: true,
            actions: { 
                auto_case: true,
                case_title_template: '[Auto] Ransomware Behavior Detected',
                severity_override: 'critical',
                group_by: ['user']
            }
        },
        // 5. Root Login (High)
        {
            name: 'Root/Administrator Login',
            description: 'Detects direct login as root or Administrator user.',
            severity: 'high',
            query: "event_type = 'login_success' AND user IN ('root', 'Administrator')",
            runIntervalSeconds: 60,
            isEnabled: true,
            actions: { auto_case: false }
        }
    ];

    for (const tenant of allTenants) {
        console.log(`\n👉 Processing Tenant: ${tenant.name} (${tenant.id})`);
        
        for (const template of rulesTemplate) {
            const ruleData = { ...template, tenantId: tenant.id };
            
            // Upsert based on name
            const existing = await db.query.detectionRules.findFirst({
                where: (dt, { eq, and }) => and(eq(dt.name, ruleData.name), eq(dt.tenantId, tenant.id))
            });
    
            if (!existing) {
                await DetectionService.createRule(ruleData as any);
                console.log(`   ✅ Created rule: ${ruleData.name}`);
            } else {
                console.log(`   ℹ️ Rule already exists: ${ruleData.name}`);
                
                // Optional: Update Actions to include new fields if missing
                if (!existing.actions || !(existing.actions as any).group_by) {
                     // Check if template has group_by, if so, we might want to patch it.
                     // For now, let's keep it simple.
                }
            }
        }
    }

    console.log('✅ Detection Rules Seeding Completed.');
}

// Run if main
if (import.meta.main) {
    seedDetectionRules()
        .then(() => process.exit(0))
        .catch(console.error);
}
