import { db } from '../infra/db';
import { detectionRules, tenants } from '../infra/db/schema';
import { DetectionService } from '../core/services/detection.service';
import { eq } from 'drizzle-orm';

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
            description: 'Detects repeated failed login attempts from a single IP.',
            severity: 'critical',
            query: "event_type = 'login_failed'",
            runIntervalSeconds: 60,
            isEnabled: true,
            mitreTactic: 'Credential Access',
            mitreTechnique: 'T1110',
            actions: { 
                auto_case: true,
                case_title_template: '[Auto] Brute Force Detected from {network_src_ip}',
                severity_override: 'critical',
                group_by: ['network_src_ip']
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
            mitreTactic: 'Credential Access',
            mitreTechnique: 'T1003',
            actions: { auto_case: false }
        },
        // 3. Port Scan (Medium)
        {
            name: 'Port Scanning Activity',
            description: 'Detects aggressive network connection attempts from single IP.',
            severity: 'medium',
            query: "event_type = 'network_connection'",
            runIntervalSeconds: 600,
            isEnabled: true,
            mitreTactic: 'Discovery',
            mitreTechnique: 'T1046',
            actions: { auto_case: false, group_by: ['network_src_ip'] }
        },
        // 4. Ransomware Pattern (Critical -> Auto Case)
        {
            name: 'Ransomware File Extension Activity',
            description: 'Detects creation of files with known ransomware extensions (.lock, .enc, .wcry).',
            severity: 'critical',
            query: "event_type = 'file_create' AND (file_name LIKE '%.lock' OR file_name LIKE '%.enc' OR file_name LIKE '%.wcry')",
            runIntervalSeconds: 60,
            isEnabled: true,
            mitreTactic: 'Impact',
            mitreTechnique: 'T1486',
            actions: { 
                auto_case: true,
                case_title_template: '[Auto] Ransomware Behavior Detected',
                severity_override: 'critical',
                group_by: ['user_name']
            }
        },
        // 5. Root Login (High)
        {
            name: 'Root/Administrator Login',
            description: 'Detects direct login as root or Administrator user.',
            severity: 'high',
            query: "event_type = 'login_success' AND user_name IN ('root', 'Administrator')",
            runIntervalSeconds: 60,
            isEnabled: true,
            mitreTactic: 'Initial Access',
            mitreTechnique: 'T1078',
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
                console.log(`   🔄 Updating existing rule: ${ruleData.name}`);
                
                await db.update(detectionRules)
                    .set({
                        query: ruleData.query,
                        actions: ruleData.actions,
                        description: ruleData.description,
                        mitreTactic: ruleData.mitreTactic,
                        mitreTechnique: ruleData.mitreTechnique
                    })
                    .where(eq(detectionRules.id, existing.id));
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
