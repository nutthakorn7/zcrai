/**
 * AlienVault OTX (Open Threat Exchange) Provider
 * Free threat intelligence platform
 * API Docs: https://otx.alienvault.com/api
 */

interface OTXResponse {
  pulse_info?: {
    count: number;
    pulses: Array<{
      name: string;
      description: string;
      tags: string[];
      malware_families: string[];
      adversary: string;
      created: string;
    }>;
  };
  general?: {
    reputation: number;
    whois?: string;
  };
  malware?: {
    count: number;
    data: any[];
  };
}

export class AlienVaultOTXProvider {
  private apiKey: string;
  private baseUrl = 'https://otx.alienvault.com/api/v1';

  constructor(apiKey?: string) {
    // OTX API key is optional - public API works without it but has rate limits
    this.apiKey = apiKey || process.env.ALIENVAULT_API_KEY || '';
  }

  private async request(endpoint: string): Promise<any> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    
    if (this.apiKey) {
      headers['X-OTX-API-KEY'] = this.apiKey;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Not found in OTX
      }
      throw new Error(`OTX API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Enrich IP address
   */
  async enrichIP(ip: string) {
    try {
      const [general, malware] = await Promise.all([
        this.request(`/indicators/IPv4/${ip}/general`),
        this.request(`/indicators/IPv4/${ip}/malware`),
      ]);

      if (!general) return null;

      const pulses = general.pulse_info?.pulses || [];
      const isMalicious = pulses.length > 0 || (general.general?.reputation || 0) < 0;

      return {
        source: 'AlienVault OTX',
        isMalicious,
        confidence: pulses.length > 0 ? 'high' : 'low',
        details: {
          reputation: general.general?.reputation || 0,
          pulseCount: general.pulse_info?.count || 0,
          pulses: pulses.slice(0, 5).map((p: any) => ({
            name: p.name,
            description: p.description,
            tags: p.tags,
            created: p.created,
          })),
          malwareCount: malware?.count || 0,
          whois: general.general?.whois,
        },
        tags: pulses.flatMap((p: any) => p.tags).slice(0, 10),
        rawResponse: { general, malware },
      };
    } catch (error: any) {
      console.error('OTX IP enrichment error:', error.message);
      return null;
    }
  }

  /**
   * Enrich domain
   */
  async enrichDomain(domain: string) {
    try {
      const [general, malware] = await Promise.all([
        this.request(`/indicators/domain/${domain}/general`),
        this.request(`/indicators/domain/${domain}/malware`),
      ]);

      if (!general) return null;

      const pulses = general.pulse_info?.pulses || [];
      const isMalicious = pulses.length > 0;

      return {
        source: 'AlienVault OTX',
        isMalicious,
        confidence: pulses.length > 3 ? 'high' : pulses.length > 0 ? 'medium' : 'low',
        details: {
          pulseCount: general.pulse_info?.count || 0,
          pulses: pulses.slice(0, 5).map((p: any) => ({
            name: p.name,
            description: p.description,
            tags: p.tags,
            adversary: p.adversary,
            created: p.created,
          })),
          malwareCount: malware?.count || 0,
        },
        tags: pulses.flatMap((p: any) => p.tags).slice(0, 10),
        rawResponse: { general, malware },
      };
    } catch (error: any) {
      console.error('OTX domain enrichment error:', error.message);
      return null;
    }
  }

  /**
   * Enrich URL
   */
  async enrichURL(url: string) {
    try {
      const general = await this.request(`/indicators/url/${encodeURIComponent(url)}/general`);
      
      if (!general) return null;

      const pulses = general.pulse_info?.pulses || [];
      const isMalicious = pulses.length > 0;

      return {
        source: 'AlienVault OTX',
        isMalicious,
        confidence: pulses.length > 0 ? 'high' : 'low',
        details: {
          pulseCount: general.pulse_info?.count || 0,
          pulses: pulses.slice(0, 5).map((p: any) => ({
            name: p.name,
            description: p.description,
            tags: p.tags,
          })),
        },
        tags: pulses.flatMap((p: any) => p.tags).slice(0, 10),
        rawResponse: general,
      };
    } catch (error: any) {
      console.error('OTX URL enrichment error:', error.message);
      return null;
    }
  }

  /**
   * Enrich file hash
   */
  async enrichHash(hash: string) {
    try {
      const general = await this.request(`/indicators/file/${hash}/general`);
      
      if (!general) return null;

      const pulses = general.pulse_info?.pulses || [];
      const malwareData = general.malware || {};

      return {
        source: 'AlienVault OTX',
        isMalicious: pulses.length > 0,
        confidence: pulses.length > 0 ? 'high' : 'unknown',
        details: {
          pulseCount: general.pulse_info?.count || 0,
          pulses: pulses.slice(0, 5).map((p: any) => ({
            name: p.name,
            description: p.description,
            malwareFamilies: p.malware_families,
            tags: p.tags,
          })),
          malware: malwareData,
        },
        tags: pulses.flatMap((p: any) => [...(p.tags || []), ...(p.malware_families || [])]).slice(0, 10),
        rawResponse: general,
      };
    } catch (error: any) {
      console.error('OTX hash enrichment error:', error.message);
      return null;
    }
  }
}
