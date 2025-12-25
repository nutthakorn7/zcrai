/**
 * AlienVault OTX (Open Threat Exchange) Provider
 * Free tier: 10,000 requests/day
 */

interface OTXPulse {
  id: string;
  name: string;
  description: string;
  created: string;
  tags: string[];
  malware_families: string[];
}

interface OTXIndicator {
  indicator: string;
  type: string;
  pulse_info: {
    count: number;
    pulses: OTXPulse[];
  };
}

interface OTXResponse {
  found: boolean;
  pulseCount: number;
  tags: string[];
  malwareFamilies: string[];
  firstSeen?: string;
  lastSeen?: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
}

export class AlienVaultOTXProvider {
  private apiKey: string;
  private baseUrl = 'https://otx.alienvault.com/api/v1';
  private rateLimiter = {
    requests: [] as number[],
    limit: 100,
    window: 60000, // 1 minute
  };

  constructor() {
    this.apiKey = process.env.OTX_API_KEY || '';
  }

  setApiKey(key: string) {
    this.apiKey = key;
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

  private calculateRisk(pulseCount: number, tags: string[]): 'low' | 'medium' | 'high' | 'critical' {
    const dangerousTags = ['apt', 'ransomware', 'c2', 'botnet', 'malware'];
    const hasDangerousTags = tags.some(t => dangerousTags.includes(t.toLowerCase()));
    
    if (pulseCount > 20 || hasDangerousTags) return 'critical';
    if (pulseCount > 10) return 'high';
    if (pulseCount > 3) return 'medium';
    return 'low';
  }

  private getMockData(indicator: string): OTXResponse {
    const isMalicious = indicator.includes('bad') || indicator.includes('evil') || indicator.endsWith('.66');
    
    return {
      found: isMalicious,
      pulseCount: isMalicious ? 15 : 0,
      tags: isMalicious ? ['malware', 'c2'] : [],
      malwareFamilies: isMalicious ? ['emotet'] : [],
      firstSeen: isMalicious ? '2024-01-15T00:00:00Z' : undefined,
      lastSeen: isMalicious ? new Date().toISOString() : undefined,
      risk: isMalicious ? 'high' : 'low'
    };
  }

  async checkIP(ip: string): Promise<OTXResponse> {
    if (!this.apiKey) {
      console.warn('⚠️ OTX API key not configured. Using Mock Data.');
      return this.getMockData(ip);
    }

    if (!this.canMakeRequest()) {
      throw new Error('Rate limit exceeded');
    }

    try {
      const response = await fetch(`${this.baseUrl}/indicators/IPv4/${ip}/general`, {
        headers: {
          'X-OTX-API-KEY': this.apiKey,
        },
      });

      this.recordRequest();

      if (!response.ok) {
        if (response.status === 404) {
          return { found: false, pulseCount: 0, tags: [], malwareFamilies: [], risk: 'low' };
        }
        throw new Error(`OTX API error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      const pulses = data.pulse_info?.pulses || [];
      const tags = [...new Set(pulses.flatMap((p: OTXPulse) => p.tags || []))];
      const malwareFamilies = [...new Set(pulses.flatMap((p: OTXPulse) => p.malware_families || []))];

      return {
        found: data.pulse_info?.count > 0,
        pulseCount: data.pulse_info?.count || 0,
        tags: tags as string[],
        malwareFamilies: malwareFamilies as string[],
        firstSeen: pulses[pulses.length - 1]?.created,
        lastSeen: pulses[0]?.created,
        risk: this.calculateRisk(data.pulse_info?.count || 0, tags as string[]),
      };
    } catch (error: any) {
      console.error('OTX IP check error:', error.message);
      throw error;
    }
  }

  async checkDomain(domain: string): Promise<OTXResponse> {
    if (!this.apiKey) {
      return this.getMockData(domain);
    }

    if (!this.canMakeRequest()) {
      throw new Error('Rate limit exceeded');
    }

    try {
      const response = await fetch(`${this.baseUrl}/indicators/domain/${domain}/general`, {
        headers: {
          'X-OTX-API-KEY': this.apiKey,
        },
      });

      this.recordRequest();

      if (!response.ok) {
        if (response.status === 404) {
          return { found: false, pulseCount: 0, tags: [], malwareFamilies: [], risk: 'low' };
        }
        throw new Error(`OTX API error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      const pulses = data.pulse_info?.pulses || [];
      const tags = [...new Set(pulses.flatMap((p: OTXPulse) => p.tags || []))];
      const malwareFamilies = [...new Set(pulses.flatMap((p: OTXPulse) => p.malware_families || []))];

      return {
        found: data.pulse_info?.count > 0,
        pulseCount: data.pulse_info?.count || 0,
        tags: tags as string[],
        malwareFamilies: malwareFamilies as string[],
        risk: this.calculateRisk(data.pulse_info?.count || 0, tags as string[]),
      };
    } catch (error: any) {
      console.error('OTX domain check error:', error.message);
      throw error;
    }
  }

  async checkHash(hash: string): Promise<OTXResponse> {
    if (!this.apiKey) {
      return this.getMockData(hash);
    }

    if (!this.canMakeRequest()) {
      throw new Error('Rate limit exceeded');
    }

    try {
      const response = await fetch(`${this.baseUrl}/indicators/file/${hash}/general`, {
        headers: {
          'X-OTX-API-KEY': this.apiKey,
        },
      });

      this.recordRequest();

      if (!response.ok) {
        if (response.status === 404) {
          return { found: false, pulseCount: 0, tags: [], malwareFamilies: [], risk: 'low' };
        }
        throw new Error(`OTX API error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      const pulses = data.pulse_info?.pulses || [];
      const tags = [...new Set(pulses.flatMap((p: OTXPulse) => p.tags || []))];
      const malwareFamilies = [...new Set(pulses.flatMap((p: OTXPulse) => p.malware_families || []))];

      return {
        found: data.pulse_info?.count > 0,
        pulseCount: data.pulse_info?.count || 0,
        tags: tags as string[],
        malwareFamilies: malwareFamilies as string[],
        risk: this.calculateRisk(data.pulse_info?.count || 0, tags as string[]),
      };
    } catch (error: any) {
      console.error('OTX hash check error:', error.message);
      throw error;
    }
  }
}
