/**
 * GCP Cloud Audit Logs Provider
 * Ingests logs from GCP Cloud Audit Logs and Security Command Center
 */

interface GCPAuditLog {
  timestamp: string;
  severity: string;
  logName: string;
  resource: {
    type: string;
    labels: {
      project_id: string;
      [key: string]: string;
    };
  };
  protoPayload?: {
    methodName: string;
    authenticationInfo?: {
      principalEmail: string;
    };
    status?: {
      code: number;
      message?: string;
    };
    requestMetadata?: {
      callerIp: string;
    };
  };
  jsonPayload?: any;
}

interface GCPConfig {
  projectId: string;
  serviceAccountJson?: string;
}

export class GCPAuditProvider {
  private config: GCPConfig;
  private static mockMode = process.env.GCP_MOCK_MODE !== 'false';

  constructor(config: GCPConfig) {
    this.config = config;
  }

  /**
   * Fetch audit logs (mock or real)
   */
  async fetchAuditLogs(startTime: Date, endTime: Date): Promise<any[]> {
    if (GCPAuditProvider.mockMode) {
      return this.generateMockLogs();
    }
    return this.fetchRealLogs(startTime, endTime);
  }

  /**
   * Generate mock GCP audit logs
   */
  private generateMockLogs(): any[] {
    const now = new Date();
    const projectId = this.config.projectId || 'my-project';

    const mockLogs = [
      {
        timestamp: new Date(now.getTime() - 3600000).toISOString(),
        severity: 'NOTICE',
        logName: `projects/${projectId}/logs/cloudaudit.googleapis.com%2Factivity`,
        resource: {
          type: 'gce_instance',
          labels: {
            project_id: projectId,
            instance_id: '1234567890',
            zone: 'us-central1-a',
          },
        },
        protoPayload: {
          methodName: 'v1.compute.instances.insert',
          authenticationInfo: {
            principalEmail: 'admin@example.com',
          },
          status: {
            code: 0,
          },
          requestMetadata: {
            callerIp: '203.0.113.10',
          },
        },
      },
      {
        timestamp: new Date(now.getTime() - 1800000).toISOString(),
        severity: 'WARNING',
        logName: `projects/${projectId}/logs/cloudaudit.googleapis.com%2Factivity`,
        resource: {
          type: 'gce_firewall_rule',
          labels: {
            project_id: projectId,
            firewall_rule_id: 'allow-all-ingress',
          },
        },
        protoPayload: {
          methodName: 'v1.compute.firewalls.insert',
          authenticationInfo: {
            principalEmail: 'admin@example.com',
          },
          status: {
            code: 0,
          },
        },
        jsonPayload: {
          riskLevel: 'HIGH',
          finding: 'Overly permissive firewall rule allowing all traffic',
        },
      },
      {
        timestamp: new Date(now.getTime() - 900000).toISOString(),
        severity: 'ERROR',
        logName: `projects/${projectId}/logs/cloudaudit.googleapis.com%2Factivity`,
        resource: {
          type: 'gcs_bucket',
          labels: {
            project_id: projectId,
            bucket_name: 'sensitive-data-bucket',
          },
        },
        protoPayload: {
          methodName: 'storage.buckets.setIamPolicy',
          authenticationInfo: {
            principalEmail: 'user@example.com',
          },
          status: {
            code: 7,
            message: 'Permission denied',
          },
          requestMetadata: {
            callerIp: '185.220.101.25',
          },
        },
        jsonPayload: {
          finding: 'Attempted unauthorized access to sensitive bucket from Tor exit node',
        },
      },
      {
        timestamp: new Date(now.getTime() - 600000).toISOString(),
        severity: 'CRITICAL',
        logName: `projects/${projectId}/logs/cloudaudit.googleapis.com%2Fdata_access`,
        resource: {
          type: 'gce_instance',
          labels: {
            project_id: projectId,
            instance_id: '9876543210',
            zone: 'us-east1-b',
          },
        },
        protoPayload: {
          methodName: 'v1.compute.instances.setMetadata',
          authenticationInfo: {
            principalEmail: 'compromised-sa@example.iam.gserviceaccount.com',
          },
          status: {
            code: 0,
          },
        },
        jsonPayload: {
          finding: 'SSH keys added to VM metadata',
          severity: 'HIGH',
          category: 'Persistence',
        },
      },
      {
        timestamp: new Date(now.getTime() - 300000).toISOString(),
        severity: 'INFO',
        logName: `projects/${projectId}/logs/cloudaudit.googleapis.com%2Factivity`,
        resource: {
          type: 'gke_cluster',
          labels: {
            project_id: projectId,
            cluster_name: 'prod-cluster',
            location: 'us-central1',
          },
        },
        protoPayload: {
          methodName: 'google.container.v1.ClusterManager.CreateCluster',
          authenticationInfo: {
            principalEmail: 'devops@example.com',
          },
          status: {
            code: 0,
          },
        },
      },
    ];

    return mockLogs;
  }

  /**
   * Fetch real GCP audit logs via Cloud Logging API
   */
  private async fetchRealLogs(startTime: Date, endTime: Date): Promise<any[]> {
    try {
      // Get OAuth token from service account
      const token = await this.getAccessToken();
      if (!token) {
        throw new Error('Failed to obtain GCP access token');
      }

      // Build filter for audit logs
      const filter = `
        resource.type=("gce_instance" OR "gcs_bucket" OR "gke_cluster")
        AND timestamp >= "${startTime.toISOString()}"
        AND timestamp <= "${endTime.toISOString()}"
        AND logName:("cloudaudit.googleapis.com/activity" OR "cloudaudit.googleapis.com/data_access")
      `.trim().replace(/\s+/g, ' ');

      const url = `https://logging.googleapis.com/v2/entries:list`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resourceNames: [`projects/${this.config.projectId}`],
          filter,
          orderBy: 'timestamp desc',
          pageSize: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`GCP API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.entries || [];
    } catch (error: any) {
      console.error('Failed to fetch GCP logs:', error.message);
      return [];
    }
  }

  /**
   * Get OAuth 2.0 access token from service account
   */
  private async getAccessToken(): Promise<string | null> {
    if (!this.config.serviceAccountJson) {
      console.error('GCP service account JSON not configured');
      return null;
    }

    try {
      // In production, use google-auth-library
      // For now, return null to indicate real API would be used
      console.log('GCP: Would authenticate with service account');
      return null;
    } catch (error) {
      console.error('Failed to get GCP token:', error);
      return null;
    }
  }

  /**
   * Transform GCP log to standardized format
   */
  transformToStandardLog(gcpLog: GCPAuditLog): any {
    const severity = this.mapSeverity(gcpLog.severity);
    
    return {
      timestamp: gcpLog.timestamp,
      source: 'gcp-audit',
      severity,
      title: this.generateTitle(gcpLog),
      description: this.generateDescription(gcpLog),
      resourceId: this.formatResourceId(gcpLog.resource),
      user: gcpLog.protoPayload?.authenticationInfo?.principalEmail || 'Unknown',
      action: gcpLog.protoPayload?.methodName || 'Unknown',
      result: this.mapStatusCode(gcpLog.protoPayload?.status?.code),
      metadata: {
        resourceType: gcpLog.resource.type,
        projectId: gcpLog.resource.labels.project_id,
        logName: gcpLog.logName,
        callerIp: gcpLog.protoPayload?.requestMetadata?.callerIp,
        jsonPayload: gcpLog.jsonPayload,
      },
    };
  }

  private mapSeverity(gcpSeverity: string): string {
    switch (gcpSeverity) {
      case 'CRITICAL':
      case 'ERROR':
        return 'high';
      case 'WARNING':
        return 'medium';
      case 'NOTICE':
      case 'INFO':
      default:
        return 'low';
    }
  }

  private mapStatusCode(code?: number): string {
    if (code === undefined || code === 0) return 'Success';
    return 'Failed';
  }

  private generateTitle(log: GCPAuditLog): string {
    const method = log.protoPayload?.methodName || 'Unknown';
    const action = method.split('.').pop() || method;
    const resourceType = this.formatResourceType(log.resource.type);
    
    return `GCP: ${action} on ${resourceType}`;
  }

  private generateDescription(log: GCPAuditLog): string {
    const user = log.protoPayload?.authenticationInfo?.principalEmail || 'System';
    const action = log.protoPayload?.methodName || 'Unknown action';
    const result = this.mapStatusCode(log.protoPayload?.status?.code);
    
    let desc = `${user} performed ${action} - ${result}`;
    
    if (log.protoPayload?.status?.message) {
      desc += `\nError: ${log.protoPayload.status.message}`;
    }
    
    if (log.jsonPayload?.finding) {
      desc += `\nFinding: ${log.jsonPayload.finding}`;
    }
    
    return desc;
  }

  private formatResourceType(type: string): string {
    const typeMap: Record<string, string> = {
      'gce_instance': 'Compute Instance',
      'gcs_bucket': 'Storage Bucket',
      'gke_cluster': 'Kubernetes Cluster',
      'gce_firewall_rule': 'Firewall Rule',
    };
    return typeMap[type] || type;
  }

  private formatResourceId(resource: any): string {
    const { type, labels } = resource;
    return `${type}/${labels.project_id}/${Object.values(labels).join('/')}`;
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
