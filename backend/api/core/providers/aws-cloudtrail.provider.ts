import { db } from '../../infra/db';
import { alerts } from '../../infra/db/schema';
import { eq } from 'drizzle-orm';
import { S3Client, ListObjectsV2Command, GetObjectCommand, CommonPrefix } from '@aws-sdk/client-s3';
import { gunzipSync } from 'node:zlib';

export interface AWSConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucketName: string;
  roleArn?: string; // Not used yet in simple client
}

export interface CloudLog {
  eventId: string;
  eventTime: string;
  eventName: string;
  eventSource: string;
  userIdentity: {
    type: string;
    principalId: string;
    arn: string;
    accountId: string;
    userName?: string;
  };
  sourceIPAddress: string;
  userAgent: string;
  requestParameters?: any;
  responseElements?: any;
  awsRegion: string;
  errorCode?: string;
  errorMessage?: string;
}

export class AWSCloudTrailProvider {
  private client: S3Client;
  private bucket: string;

  constructor(config: AWSConfig) {
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
    this.bucket = config.bucketName;
  }

  /**
   * Fetch logs from S3
   * Strategy:
   * 1. List 'AWSLogs/' to find Account IDs.
   * 2. Construct path for Today and Yesterday (UTC).
   * 3. List .json.gz objects.
   * 4. Download and Parse.
   */
  async fetchLogs(): Promise<CloudLog[]> {
    const logs: CloudLog[] = [];
    
    try {
      // 1. Discover Account IDs
      const accountIds = await this.discoverAccountIds();
      
      // 2. Generate prefixes for last 24 hours (Today and Yesterday)
      const dates = this.getRecentDates(); // ['2023/12/14', '2023/12/13']
      
      const region = await this.client.config.region();

      for (const accountId of accountIds) {
        for (const datePath of dates) {
          // Path: AWSLogs/<AccountID>/CloudTrail/<Region>/<YYYY>/<MM>/<DD>/
          const prefix = `AWSLogs/${accountId}/CloudTrail/${region}/${datePath}/`;
          
          await this.processPrefix(prefix, logs);
        }
      }
    } catch (e) {
      console.error('Error fetching S3 logs:', e);
      // Don't throw, return partial logs if any
    }

    return logs;
  }

  private async discoverAccountIds(): Promise<string[]> {
    try {
        const command = new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: 'AWSLogs/',
            Delimiter: '/'
        });
        const response = await this.client.send(command);
        
        // CommonPrefixes will be like ['AWSLogs/123456789012/', 'AWSLogs/987654321098/']
        return (response.CommonPrefixes || [])
            .map(p => p.Prefix?.split('/')[1])
            .filter((id): id is string => !!id);
    } catch (e) {
        console.warn('Failed to discover Account IDs, trying root scan fallback?', e);
        return [];
    }
  }

  private getRecentDates(): string[] {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const format = (d: Date) => {
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        return `${yyyy}/${mm}/${dd}`;
    };

    return [format(today), format(yesterday)];
  }

  private async processPrefix(prefix: string, logs: CloudLog[]) {
    try {
        const listCmd = new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
            MaxKeys: 50 // Limit per day/account to avoid timeout in MVP
        });
        
        const listRes = await this.client.send(listCmd);
        
        if (!listRes.Contents) return;

        // Parallel download (limit 5 at a time)
        const chunks = [];
        for (let i = 0; i < listRes.Contents.length; i += 5) {
            chunks.push(listRes.Contents.slice(i, i + 5));
        }

        for (const chunk of chunks) {
            await Promise.all(chunk.map(async (obj) => {
                if (!obj.Key || !obj.Key.endsWith('.json.gz')) return;
                
                try {
                    const getCmd = new GetObjectCommand({ Bucket: this.bucket, Key: obj.Key });
                    const getRes = await this.client.send(getCmd);
                    
                    if (getRes.Body) {
                        const byteArray = await getRes.Body.transformToByteArray();
                        const decompressed = gunzipSync(byteArray);
                        const json = JSON.parse(decompressed.toString('utf-8'));
                        
                        if (json.Records && Array.isArray(json.Records)) {
                            logs.push(...json.Records);
                        }
                    }
                } catch (err) {
                    console.error(`Failed to process object ${obj.Key}:`, err);
                }
            }));
        }
    } catch (e) {
        // Prefix might not exist, ignore
    }
  }

  /**
   * Analyze logs and create alerts
   */
  async processLogs(tenantId: string, logs: CloudLog[]) {
    let newAlerts = 0;

    for (const log of logs) {
      const alert = this.detectThreat(log);
      if (alert) {
        await this.createAlert(tenantId, alert, log);
        newAlerts++;
      }
    }

    return { processed: logs.length, alerts: newAlerts };
  }

  /**
   * Detection Logic (Simple Rules Engine)
   */
  private detectThreat(log: CloudLog): { title: string; severity: 'critical' | 'high' | 'medium' | 'low'; description: string } | null {
    
    // Rule 1: Root Account Usage
    if (log.userIdentity.type === 'Root' && log.eventName === 'ConsoleLogin' && !log.errorMessage) {
      return {
        title: 'AWS Root Account Console Login',
        severity: 'critical',
        description: `Root account login detected from IP ${log.sourceIPAddress}. Root access should be avoided.`
      };
    }

    // Rule 2: S3 Bucket Made Public
    if (log.eventName === 'PutBucketAcl' || log.eventName === 'PutBucketPolicy') {
      const params = JSON.stringify(log.requestParameters);
      if (params.includes('AllUsers') || params.includes('AuthenticatedUsers')) {
        return {
          title: 'S3 Bucket Made Public',
          severity: 'high',
          description: `S3 bucket ACL/Policy change detected granting public access. Source User: ${log.userIdentity.userName}`
        };
      }
    }

    // Rule 3: Unauthorized Access Calls (Brute Force Indicator?)
    if (log.errorCode === 'AccessDenied' || log.errorCode === 'UnauthorizedOperation') {
         // Could be noisy, only alert if critical service?
         // For now, return Low
         return {
             title: 'AWS Access Denied',
             severity: 'low',
             description: `Access Denied for ${log.eventName} by ${log.userIdentity.userName || log.userIdentity.arn}`
         };
    }

    // Rule 4: Security Group Changes (Ingress Open)
    if (log.eventName === 'AuthorizeSecurityGroupIngress') {
        const params = JSON.stringify(log.requestParameters);
        if (params.includes('0.0.0.0/0')) {
            return {
                title: 'Security Group Opened to World',
                severity: 'medium',
                description: `Security Group ingress rule added for 0.0.0.0/0. User: ${log.userIdentity.userName}`
            };
        }
    }

    return null;
  }

  /**
   * Save alert to DB
   */
  private async createAlert(tenantId: string, alertData: any, log: CloudLog) {
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(log.eventId + alertData.title);
    const fingerprintHash = hasher.digest("hex");

    const [existing] = await db.select().from(alerts).where(eq(alerts.fingerprint, fingerprintHash));
    
    if (existing) {
        await db.update(alerts)
            .set({ 
                lastSeenAt: new Date(),
                duplicateCount: existing.duplicateCount + 1
            })
            .where(eq(alerts.id, existing.id));
    } else {
        await db.insert(alerts).values({
            tenantId,
            source: 'aws-cloudtrail',
            title: alertData.title,
            description: alertData.description,
            severity: alertData.severity,
            status: 'new',
            fingerprint: fingerprintHash,
            rawData: log,
            firstSeenAt: new Date(),
            lastSeenAt: new Date()
        });
    }
  }
}
