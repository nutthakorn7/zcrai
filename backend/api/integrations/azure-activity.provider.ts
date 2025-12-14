/**
 * Azure Activity Logs Provider
 * Ingests logs from Azure Activity Logs, Security Center, and Azure AD
 */

interface AzureActivityLog {
  time: string;
  resourceId: string;
  operationName: string;
  category: string;
  resultType: string;
  identity: {
    claims: {
      upn?: string;
      appid?: string;
      oid?: string;
    };
  };
  properties?: any;
  level?: string;
}

interface AzureConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId: string;
}

export class AzureActivityProvider {
  private config: AzureConfig;
  private static mockMode = process.env.AZURE_MOCK_MODE !== 'false';

  constructor(config: AzureConfig) {
    this.config = config;
  }

  /**
   * Fetch activity logs (mock or real)
   */
  async fetchActivityLogs(startTime: Date, endTime: Date): Promise<any[]> {
    if (AzureActivityProvider.mockMode) {
      return this.generateMockLogs();
    }
    return this.fetchRealLogs(startTime, endTime);
  }

  /**
   * Generate mock Azure activity logs
   */
  private generateMockLogs(): any[] {
    const now = new Date();
    const mockLogs = [
      {
        time: new Date(now.getTime() - 3600000).toISOString(),
        resourceId: '/subscriptions/12345/resourceGroups/prod-rg/providers/Microsoft.Compute/virtualMachines/web-vm-01',
        operationName: 'Microsoft.Compute/virtualMachines/write',
        category: 'Administrative',
        resultType: 'Success',
        level: 'Informational',
        identity: {
          claims: {
            upn: 'admin@contoso.com',
            oid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          },
        },
        properties: {
          statusCode: 'OK',
          eventCategory: 'Administrative',
        },
      },
      {
        time: new Date(now.getTime() - 1800000).toISOString(),
        resourceId: '/subscriptions/12345/resourceGroups/prod-rg',
        operationName: 'Microsoft.Security/locations/alerts/activate/action',
        category: 'Security',
        resultType: 'Success',
        level: 'Warning',
        identity: {
          claims: {
            appid: 'azure-security-center',
          },
        },
        properties: {
          severity: 'High',
          threatType: 'VM_SuspiciousActivity',
          description: 'Suspicious PowerShell execution detected on VM',
          remediationSteps: 'Investigate the PowerShell commands and isolate the VM if necessary',
        },
      },
      {
        time: new Date(now.getTime() - 900000).toISOString(),
        resourceId: '/subscriptions/12345/resourceGroups/prod-rg/providers/Microsoft.Storage/storageAccounts/prodsa01',
        operationName: 'Microsoft.Storage/storageAccounts/delete',
        category: 'Administrative',
        resultType: 'Failed',
        level: 'Error',
        identity: {
          claims: {
            upn: 'user@contoso.com',
          },
        },
        properties: {
          statusCode: 'Forbidden',
          statusMessage: 'Insufficient permissions',
        },
      },
      {
        time: new Date(now.getTime() - 600000).toISOString(),
        resourceId: '/subscriptions/12345/providers/Microsoft.AAD/tenants/contoso.onmicrosoft.com',
        operationName: 'Microsoft.AAD/signIns',
        category: 'SignInLogs',
        resultType: 'Success',
        level: 'Informational',
        identity: {
          claims: {
            upn: 'admin@contoso.com',
          },
        },
        properties: {
          location: 'Unknown',
          ipAddress: '185.220.101.25',
          riskLevel: 'High',
          riskDetail: 'Sign-in from anonymous IP address (Tor)',
        },
      },
      {
        time: new Date(now.getTime() - 300000).toISOString(),
        resourceId: '/subscriptions/12345/resourceGroups/prod-rg/providers/Microsoft.Network/networkSecurityGroups/prod-nsg',
        operationName: 'Microsoft.Network/networkSecurityGroups/write',
        category: 'Administrative',
        resultType: 'Success',
        level: 'Warning',
        identity: {
          claims: {
            upn: 'admin@contoso.com',
          },
        },
        properties: {
          changeType: 'SecurityRuleAdded',
          ruleName: 'Allow-All-Inbound',
          description: 'Overly permissive security rule added',
        },
      },
    ];

    return mockLogs;
  }

  /**
   * Fetch real Azure activity logs via Azure Monitor API
   */
  private async fetchRealLogs(startTime: Date, endTime: Date): Promise<any[]> {
    try {
      // Get OAuth token
      const token = await this.getAccessToken();
      if (!token) {
        throw new Error('Failed to obtain Azure access token');
      }

      // Fetch activity logs
      const filter = `eventTimestamp ge '${startTime.toISOString()}' and eventTimestamp le '${endTime.toISOString()}'`;
      const url = `https://management.azure.com/subscriptions/${this.config.subscriptionId}/providers/Microsoft.Insights/eventtypes/management/values?api-version=2015-04-01&$filter=${encodeURIComponent(filter)}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Azure API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.value || [];
    } catch (error: any) {
      console.error('Failed to fetch Azure logs:', error.message);
      return [];
    }
  }

  /**
   * Get OAuth 2.0 access token from Azure AD
   */
  private async getAccessToken(): Promise<string | null> {
    try {
      const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
      
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'https://management.azure.com/.default',
        grant_type: 'client_credentials',
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = await response.json();
      return data.access_token || null;
    } catch (error) {
      console.error('Failed to get Azure token:', error);
      return null;
    }
  }

  /**
   * Transform Azure log to standardized format
   */
  transformToStandardLog(azureLog: AzureActivityLog): any {
    const severity = this.mapSeverity(azureLog.level || 'Informational', azureLog.category);
    
    return {
      timestamp: azureLog.time,
      source: 'azure-activity',
      severity,
      title: this.generateTitle(azureLog),
      description: this.generateDescription(azureLog),
      resourceId: azureLog.resourceId,
      user: azureLog.identity?.claims?.upn || azureLog.identity?.claims?.appid || 'Unknown',
      action: azureLog.operationName,
      result: azureLog.resultType,
      metadata: {
        category: azureLog.category,
        properties: azureLog.properties,
      },
    };
  }

  private mapSeverity(level: string, category: string): string {
    if (category === 'Security') return 'high';
    if (level === 'Error') return 'high';
    if (level === 'Warning') return 'medium';
    return 'low';
  }

  private generateTitle(log: AzureActivityLog): string {
    const action = log.operationName.split('/').pop() || log.operationName;
    const resource = this.extractResourceType(log.resourceId);
    return `Azure: ${action} on ${resource}`;
  }

  private generateDescription(log: AzureActivityLog): string {
    const user = log.identity?.claims?.upn || 'System';
    const action = log.operationName;
    const result = log.resultType;
    
    let desc = `${user} performed ${action} - ${result}`;
    
    if (log.properties?.description) {
      desc += `\n${log.properties.description}`;
    }
    
    return desc;
  }

  private extractResourceType(resourceId: string): string {
    const match = resourceId.match(/\/providers\/([^/]+)/);
    return match ? match[1] : 'Resource';
  }

  /**
   * Set mock mode
   */
  static setMockMode(enabled: boolean): void {
    this.mockMode = enabled;
  }

  /**
   * Get mock mode status
   */
  static isMockMode(): boolean {
    return this.mockMode;
  }
}
