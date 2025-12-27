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
        },
        
        // ========== NEW RULES ==========
        
        // 6. Lateral Movement - RDP/SMB (High)
        {
            name: 'Lateral Movement via RDP/SMB',
            description: 'Detects RDP or SMB connections between internal hosts indicating lateral movement.',
            severity: 'high',
            query: "event_type = 'network_connection' AND (dest_port IN (3389, 445, 135, 139)) AND network_src_ip LIKE '10.%' AND network_dst_ip LIKE '10.%'",
            runIntervalSeconds: 120,
            isEnabled: true,
            mitreTactic: 'Lateral Movement',
            mitreTechnique: 'T1021',
            actions: { auto_case: false, group_by: ['network_src_ip', 'network_dst_ip'] }
        },
        // 7. Lateral Movement - PsExec (Critical -> Auto Case)
        {
            name: 'PsExec Remote Execution',
            description: 'Detects PsExec or similar remote execution tools.',
            severity: 'critical',
            query: "event_type = 'process_create' AND (process_name LIKE '%psexec%' OR command_line LIKE '%psexec%' OR process_name LIKE '%wmic%')",
            runIntervalSeconds: 60,
            isEnabled: true,
            mitreTactic: 'Lateral Movement',
            mitreTechnique: 'T1570',
            actions: { 
                auto_case: true,
                case_title_template: '[Auto] PsExec Lateral Movement Detected',
                severity_override: 'critical',
                group_by: ['user_name', 'host_name']
            }
        },
        // 8. Data Exfiltration - Large Upload (High)
        {
            name: 'Large Data Upload Detected',
            description: 'Detects unusually large outbound data transfers (>100MB) indicating potential exfiltration.',
            severity: 'high',
            query: "event_type = 'network_traffic' AND bytes_out > 104857600 AND network_dst_ip NOT LIKE '10.%' AND network_dst_ip NOT LIKE '192.168.%'",
            runIntervalSeconds: 300,
            isEnabled: true,
            mitreTactic: 'Exfiltration',
            mitreTechnique: 'T1048',
            actions: { auto_case: false, group_by: ['network_src_ip'] }
        },
        // 9. Data Exfiltration - Cloud Storage (Medium)
        {
            name: 'Data Upload to Cloud Storage',
            description: 'Detects connections to cloud storage services (Dropbox, Google Drive, OneDrive, MEGA).',
            severity: 'medium',
            query: "event_type = 'dns_query' AND (query LIKE '%dropbox%' OR query LIKE '%drive.google%' OR query LIKE '%onedrive%' OR query LIKE '%mega.nz%')",
            runIntervalSeconds: 600,
            isEnabled: true,
            mitreTactic: 'Exfiltration',
            mitreTechnique: 'T1567',
            actions: { auto_case: false }
        },
        // 10. Privilege Escalation - Sudo (High)
        {
            name: 'Privilege Escalation via Sudo',
            description: 'Detects sudo usage to escalate privileges.',
            severity: 'high',
            query: "event_type = 'process_create' AND (process_name = 'sudo' OR command_line LIKE 'sudo %')",
            runIntervalSeconds: 120,
            isEnabled: true,
            mitreTactic: 'Privilege Escalation',
            mitreTechnique: 'T1548',
            actions: { auto_case: false, group_by: ['user_name'] }
        },
        // 11. Privilege Escalation - UAC Bypass (Critical)
        {
            name: 'UAC Bypass Attempt',
            description: 'Detects attempts to bypass Windows UAC using known techniques.',
            severity: 'critical',
            query: "event_type = 'process_create' AND (command_line LIKE '%eventvwr%' OR command_line LIKE '%fodhelper%' OR command_line LIKE '%computerdefaults%')",
            runIntervalSeconds: 60,
            isEnabled: true,
            mitreTactic: 'Privilege Escalation',
            mitreTechnique: 'T1548.002',
            actions: { 
                auto_case: true,
                case_title_template: '[Auto] UAC Bypass Detected on {host_name}',
                severity_override: 'critical',
                group_by: ['host_name']
            }
        },
        // 12. Persistence - Scheduled Task (Medium)
        {
            name: 'Scheduled Task Created',
            description: 'Detects creation of new scheduled tasks or cron jobs for persistence.',
            severity: 'medium',
            query: "event_type = 'process_create' AND (process_name LIKE '%schtasks%' OR command_line LIKE '%crontab%' OR process_name = 'at')",
            runIntervalSeconds: 300,
            isEnabled: true,
            mitreTactic: 'Persistence',
            mitreTechnique: 'T1053',
            actions: { auto_case: false }
        },
        // 13. Persistence - Registry Run Key (High)
        {
            name: 'Registry Run Key Modification',
            description: 'Detects modifications to Windows registry Run keys for persistence.',
            severity: 'high',
            query: "event_type = 'registry_modification' AND registry_key LIKE '%\\Run%'",
            runIntervalSeconds: 300,
            isEnabled: true,
            mitreTactic: 'Persistence',
            mitreTechnique: 'T1547.001',
            actions: { auto_case: false }
        },
        // 14. C2 Communication - Beaconing (High)
        {
            name: 'C2 Beaconing Pattern',
            description: 'Detects regular interval network connections potentially indicating C2 beaconing.',
            severity: 'high',
            query: "event_type = 'network_connection' AND dest_port IN (80, 443, 8080, 8443) AND network_dst_ip NOT LIKE '10.%'",
            runIntervalSeconds: 600,
            isEnabled: true,
            mitreTactic: 'Command and Control',
            mitreTechnique: 'T1071',
            actions: { auto_case: false, group_by: ['network_dst_ip'] }
        },
        // 15. Defense Evasion - Log Deletion (Critical -> Auto Case)
        {
            name: 'Security Log Deletion',
            description: 'Detects attempts to clear or delete security logs.',
            severity: 'critical',
            query: "event_type = 'process_create' AND (command_line LIKE '%wevtutil cl%' OR command_line LIKE '%Clear-EventLog%' OR command_line LIKE '%rm -rf /var/log%')",
            runIntervalSeconds: 60,
            isEnabled: true,
            mitreTactic: 'Defense Evasion',
            mitreTechnique: 'T1070.001',
            actions: { 
                auto_case: true,
                case_title_template: '[Auto] Log Deletion Detected on {host_name}',
                severity_override: 'critical',
                group_by: ['host_name']
            }
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
