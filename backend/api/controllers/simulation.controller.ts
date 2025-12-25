import { Elysia, t } from 'elysia'
import { AlertService } from '../core/services/alert.service'
import { withAuth } from '../middleware/auth'
import { getEffectiveTenantId } from '../core/utils/tenant'

export const simulationController = new Elysia({ prefix: '/simulation' })
  .use(withAuth)
  
  /**
   * Trigger a simulated Malicious Login attempt
   * This will exercise Alert -> AI Triage (Mock TRUE_POSITIVE) -> Autopilot Remediation
   */
  .post('/malicious-login', async ({ set, user, cookie: { selected_tenant } }: any) => {
    try {
      const tenantId = getEffectiveTenantId(user, selected_tenant);
      
      const alert = await AlertService.create({
        tenantId,
        source: 'sentinelone',
        severity: 'critical',
        title: 'Simulation: Brute Force followed by Successful Login',
        description: 'Observed 45 failed login attempts for user "admin" followed by a successful login from suspicious IP 178.12.44.9. Classification: Lateral Movement suspected.',
        rawData: {
          event_type: 'login_failure',
          source_ip: '178.12.44.9',
          target_user: 'admin',
          failed_attempts: 45,
          dest_host: 'DC-01',
          dest_ip: '10.0.0.4',
          is_simulated: true
        }
      });

      return { 
        success: true, 
        message: 'Simulation alert created. AI Triage and Autopilot Remediation triggered.',
        alertId: alert.id 
      };
    } catch (e: any) {
      set.status = 500;
      return { success: false, error: e.message };
    }
  })

  /**
   * Trigger a simulated Ransomware Execution
   */
  .post('/ransomware', async ({ set, user, cookie: { selected_tenant } }: any) => {
    try {
      const tenantId = getEffectiveTenantId(user, selected_tenant);
      
      const alert = await AlertService.create({
        tenantId,
        source: 'crowdstrike',
        severity: 'critical',
        title: 'Simulation: Potential Ransomware Activity - File Encryption',
        description: 'Vantage point observed high-frequency file modification (renaming to .crypt) in "C:\\Users\\Finance\\Documents". Parent process: unknown_binary.exe (PID: 8842)',
        rawData: {
          event_type: 'file_mod',
          source_ip: '10.0.0.15',
          pid: 8842,
          process_name: 'unknown_binary.exe',
          impacted_files: 24,
          is_simulated: true
        }
      });

      return { 
        success: true, 
        message: 'Ransomware simulation alert created.',
        alertId: alert.id 
      };
    } catch (e: any) {
      set.status = 500;
      return { success: false, error: e.message };
    }
  })
