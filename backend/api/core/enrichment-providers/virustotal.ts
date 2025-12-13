interface VirusTotalResponse {
  reputation?: number;
  detectionRatio?: string;
  malicious?: boolean;
  country?: string;
  asn?: number;
  lastAnalysisDate?: string;
  categories?: string[];
}

export class VirusTotalProvider {
  private apiKey: string;
  private baseUrl = 'https://www.virustotal.com/api/v3';
  private rateLimiter = {
    requests: [] as number[],
    limit: 4,
    window: 60000, // 1 minute
  };

  constructor() {
    // Use environment variable only (infrastructure-level config)
    this.apiKey = process.env.VIRUSTOTAL_API_KEY || '';
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

  private async makeRequest(endpoint: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('VirusTotal API key not configured');
    }

    if (!this.canMakeRequest()) {
      throw new Error('Rate limit exceeded, please try again later');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'x-apikey': this.apiKey,
      },
    });

    this.recordRequest();

    if (!response.ok) {
      throw new Error(`VirusTotal API error: ${response.statusText}`);
    }

    return response.json();
  }

  async enrichIP(ip: string): Promise<VirusTotalResponse> {
    try {
      const data = await this.makeRequest(`/ip_addresses/${ip}`);
      
      const stats = data.data?.attributes?.last_analysis_stats || {};
      const total = Object.values(stats).reduce((a: any, b: any) => a + b, 0) as number;
      const malicious = stats.malicious || 0;

      return {
        reputation: data.data?.attributes?.reputation || 0,
        detectionRatio: `${malicious}/${total}`,
        malicious: malicious > 0,
        country: data.data?.attributes?.country || 'Unknown',
        asn: data.data?.attributes?.asn,
        lastAnalysisDate: data.data?.attributes?.last_analysis_date
          ? new Date(data.data.attributes.last_analysis_date * 1000).toISOString()
          : undefined,
      };
    } catch (error: any) {
      console.error('VirusTotal IP enrichment error:', error.message);
      throw error;
    }
  }

  async enrichDomain(domain: string): Promise<VirusTotalResponse> {
    try {
      const data = await this.makeRequest(`/domains/${domain}`);
      
      const stats = data.data?.attributes?.last_analysis_stats || {};
      const total = Object.values(stats).reduce((a: any, b: any) => a + b, 0) as number;
      const malicious = stats.malicious || 0;

      return {
        reputation: data.data?.attributes?.reputation || 0,
        detectionRatio: `${malicious}/${total}`,
        malicious: malicious > 0,
        categories: data.data?.attributes?.categories || [],
        lastAnalysisDate: data.data?.attributes?.last_analysis_date
          ? new Date(data.data.attributes.last_analysis_date * 1000).toISOString()
          : undefined,
      };
    } catch (error: any) {
      console.error('VirusTotal domain enrichment error:', error.message);
      throw error;
    }
  }

  async enrichURL(url: string): Promise<VirusTotalResponse> {
    try {
      // URL encode the URL for VirusTotal
      const urlId = Buffer.from(url).toString('base64').replace(/=/g, '');
      const data = await this.makeRequest(`/urls/${urlId}`);
      
      const stats = data.data?.attributes?.last_analysis_stats || {};
      const total = Object.values(stats).reduce((a: any, b: any) => a + b, 0) as number;
      const malicious = stats.malicious || 0;

      return {
        detectionRatio: `${malicious}/${total}`,
        malicious: malicious > 0,
        categories: data.data?.attributes?.categories || [],
        lastAnalysisDate: data.data?.attributes?.last_analysis_date
          ? new Date(data.data.attributes.last_analysis_date * 1000).toISOString()
          : undefined,
      };
    } catch (error: any) {
      console.error('VirusTotal URL enrichment error:', error.message);
      throw error;
    }
  }

  async enrichHash(hash: string): Promise<VirusTotalResponse> {
    try {
      const data = await this.makeRequest(`/files/${hash}`);
      
      const stats = data.data?.attributes?.last_analysis_stats || {};
      const total = Object.values(stats).reduce((a: any, b: any) => a + b, 0) as number;
      const malicious = stats.malicious || 0;

      return {
        detectionRatio: `${malicious}/${total}`,
        malicious: malicious > 0,
        lastAnalysisDate: data.data?.attributes?.last_analysis_date
          ? new Date(data.data.attributes.last_analysis_date * 1000).toISOString()
          : undefined,
      };
    } catch (error: any) {
      console.error('VirusTotal hash enrichment error:', error.message);
      throw error;
    }
  }
}
