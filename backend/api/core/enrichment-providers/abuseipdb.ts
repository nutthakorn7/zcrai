interface AbuseIPDBResponse {
  abuseConfidenceScore: number;
  totalReports: number;
  countryCode: string;
  isWhitelisted: boolean;
  lastReportedAt?: string;
}

export class AbuseIPDBProvider {
  private apiKey: string;
  private baseUrl = 'https://api.abuseipdb.com/api/v2';
  private rateLimiter = {
    requests: [] as number[],
    limit: 1000,
    window: 24 * 60 * 60 * 1000, // 24 hours
  };

  constructor() {
    // Use environment variable only (infrastructure-level config)
    this.apiKey = process.env.ABUSEIPDB_API_KEY || '';
  }

  private canMakeRequest(): boolean {
    const now = Date.now();
    this.rateLimiter.requests = this.rateLimiter.requests.filter(
      t => now - t < this.rateLimiter.window
    );
    return this.rateLimiter.requests.length < this.rateLimiter.limit;
  }

  private recordRequest(): void {
    this.rateLimiter.requests.push(Date.now());
  }

  async checkIP(ip: string): Promise<AbuseIPDBResponse> {
    if (!this.apiKey) {
        console.warn('⚠️ AbuseIPDB API key not configured. Using Mock Data.');
        const isMalicious = ip.includes('44.') || ip.endsWith('.66');
        return {
            abuseConfidenceScore: isMalicious ? 85 : 0,
            totalReports: isMalicious ? 50 : 0,
            countryCode: isMalicious ? 'RU' : 'US',
            isWhitelisted: !isMalicious,
            lastReportedAt: isMalicious ? new Date().toISOString() : undefined
        };
    }

    if (!this.canMakeRequest()) {
      throw new Error('Rate limit exceeded, please try again later');
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/check?ipAddress=${ip}&maxAgeInDays=90`,
        {
          headers: {
            'Key': this.apiKey,
            'Accept': 'application/json',
          },
        }
      );

      this.recordRequest();

      if (!response.ok) {
        throw new Error(`AbuseIPDB API error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      const ipData = data.data;

      return {
        abuseConfidenceScore: ipData.abuseConfidenceScore || 0,
        totalReports: ipData.totalReports || 0,
        countryCode: ipData.countryCode || 'Unknown',
        isWhitelisted: ipData.isWhitelisted || false,
        lastReportedAt: ipData.lastReportedAt || undefined,
      };
    } catch (error: any) {
      console.error('AbuseIPDB enrichment error:', error.message);
      throw error;
    }
  }
}
