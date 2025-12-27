/**
 * URLScan.io Provider
 * Free tier: 5,000 requests/day
 * API Docs: https://urlscan.io/docs/api/
 */

export interface URLScanResponse {
  source: string;
  isMalicious: boolean;
  score: number;
  tags: string[];
  lastScanAt?: string;
  details: {
    verdicts: any;
    screenshot?: string;
    urlscanUrl?: string;
  };
}

export class URLScanProvider {
  private apiKey: string;
  private baseUrl = 'https://urlscan.io/api/v1';

  constructor() {
    this.apiKey = process.env.URLSCAN_API_KEY || '';
  }

  /**
   * Check a domain or URL
   * Note: URLScan is mostly for URLs, but can be used for search
   */
  async checkURL(url: string): Promise<URLScanResponse | null> {
    if (!this.apiKey) {
      return this.getMockData(url);
    }

    try {
      // For now, we search for existing scans rather than submitting new ones (to save time/quota)
      const query = encodeURIComponent(`page.url:"${url}" OR task.url:"${url}"`);
      const response = await fetch(`${this.baseUrl}/search/?q=${query}&size=1`, {
        headers: {
          'API-Key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`URLScan API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      if (!data.results || data.results.length === 0) {
        return null; // No previous scan found
      }

      const result = data.results[0];
      const verdict = result.verdicts?.overall || {};

      return {
        source: 'URLScan.io',
        isMalicious: verdict.malicious || false,
        score: verdict.score || 0,
        tags: result.task?.tags || [],
        lastScanAt: result.task?.time,
        details: {
          verdicts: result.verdicts,
          screenshot: result.screenshot,
          urlscanUrl: `https://urlscan.io/result/${result.task.uuid}/`,
        },
      };
    } catch (error: any) {
      console.error('URLScan check error:', error.message);
      return null;
    }
  }

  private getMockData(url: string): URLScanResponse {
    const isSuspicious = url.includes('login') || url.includes('verify') || url.includes('account');
    return {
      source: 'URLScan.io',
      isMalicious: isSuspicious,
      score: isSuspicious ? 80 : 0,
      tags: isSuspicious ? ['phishing', 'fake-login'] : [],
      details: {
        verdicts: { overall: { malicious: isSuspicious, score: isSuspicious ? 80 : 0 } },
        urlscanUrl: 'https://urlscan.io/result/mock-uuid/',
      },
    };
  }
}
