/**
 * DGA (Domain Generation Algorithm) Detector
 * Detects algorithmically generated domains commonly used by malware
 * Uses entropy analysis and pattern recognition
 */

interface DGAResult {
  isDGA: boolean;
  confidence: number; // 0-1
  entropy: number;
  features: {
    length: number;
    vowelRatio: number;
    consonantClusters: number;
    dictionaryWords: number;
    digitRatio: number;
  };
  reason: string;
}

export class DGADetector {
  
  // Common TLDs that are frequently used by DGA
  private static suspiciousTLDs = new Set([
    'tk', 'ml', 'ga', 'cf', 'gq', 'pw', 'cc', 'ws', 'info', 'biz'
  ]);

  // Simple dictionary of common words (subset)
  private static commonWords = new Set([
    'com', 'net', 'org', 'www', 'web', 'site', 'page', 'home', 'mail',
    'app', 'api', 'cdn', 'admin', 'user', 'login', 'secure', 'cloud',
    'data', 'info', 'service', 'server', 'host', 'domain', 'email'
  ]);

  /**
   * Main detection method
   */
  static detect(domain: string): DGAResult {
    // Remove protocol if present
    let cleanDomain = domain.replace(/^https?:\/\//, '');
    
    // Remove port if present
    cleanDomain = cleanDomain.split(':')[0];
    
    // Remove path if present
    cleanDomain = cleanDomain.split('/')[0];
    
    // Extract subdomain and root domain
    const parts = cleanDomain.split('.');
    if (parts.length < 2) {
      return {
        isDGA: false,
        confidence: 0,
        entropy: 0,
        features: { length: 0, vowelRatio: 0, consonantClusters: 0, dictionaryWords: 0, digitRatio: 0 },
        reason: 'Invalid domain format'
      };
    }

    // Analyze the main domain part (before TLD)
    const mainDomain = parts[parts.length - 2];
    const tld = parts[parts.length - 1];

    // Calculate features
    const entropy = this.calculateEntropy(mainDomain);
    const vowelRatio = this.calculateVowelRatio(mainDomain);
    const consonantClusters = this.countConsonantClusters(mainDomain);
    const dictionaryWords = this.countDictionaryWords(mainDomain);
    const digitRatio = this.calculateDigitRatio(mainDomain);
    const length = mainDomain.length;

    // Scoring system
    let score = 0;
    let reasons: string[] = [];

    // High entropy (randomness)
    if (entropy > 3.5) {
      score += 30;
      reasons.push('high entropy');
    } else if (entropy > 3.0) {
      score += 15;
    }

    // Low vowel ratio (unpronounceable)
    if (vowelRatio < 0.2) {
      score += 25;
      reasons.push('low vowel ratio');
    } else if (vowelRatio < 0.3) {
      score += 10;
    }

    // Many consonant clusters
    if (consonantClusters > 3) {
      score += 20;
      reasons.push('consonant clusters');
    }

    // No dictionary words
    if (dictionaryWords === 0 && length > 6) {
      score += 15;
      reasons.push('no dictionary words');
    }

    // Contains digits (unusual for legitimate domains)
    if (digitRatio > 0.3) {
      score += 15;
      reasons.push('high digit ratio');
    }

    // Unusual length
    if (length > 20 || (length > 12 && entropy > 3.0)) {
      score += 10;
      reasons.push('unusual length');
    }

    // Suspicious TLD
    if (this.suspiciousTLDs.has(tld.toLowerCase())) {
      score += 10;
      reasons.push('suspicious TLD');
    }

    // Very short domains are usually not DGA
    if (length < 6) {
      score = Math.max(0, score - 30);
    }

    const confidence = Math.min(1, score / 100);
    const isDGA = score > 60; // Threshold for DGA classification

    return {
      isDGA,
      confidence: Number(confidence.toFixed(2)),
      entropy: Number(entropy.toFixed(2)),
      features: {
        length,
        vowelRatio: Number(vowelRatio.toFixed(2)),
        consonantClusters,
        dictionaryWords,
        digitRatio: Number(digitRatio.toFixed(2)),
      },
      reason: isDGA ? reasons.join(', ') : 'appears legitimate'
    };
  }

  /**
   * Calculate Shannon entropy
   */
  private static calculateEntropy(str: string): number {
    const len = str.length;
    if (len === 0) return 0;

    const frequencies: { [key: string]: number } = {};
    for (const char of str.toLowerCase()) {
      frequencies[char] = (frequencies[char] || 0) + 1;
    }

    let entropy = 0;
    for (const char in frequencies) {
      const p = frequencies[char] / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Calculate ratio of vowels to total characters
   */
  private static calculateVowelRatio(str: string): number {
    if (str.length === 0) return 0;
    const vowels = str.toLowerCase().match(/[aeiou]/g) || [];
    return vowels.length / str.length;
  }

  /**
   * Count consonant clusters (3+ consonants in a row)
   */
  private static countConsonantClusters(str: string): number {
    const matches = str.toLowerCase().match(/[^aeiou0-9]{3,}/g) || [];
    return matches.length;
  }

  /**
   * Count dictionary words found in domain
   */
  private static countDictionaryWords(str: string): number {
    let count = 0;
    const lower = str.toLowerCase();
    
    for (const word of this.commonWords) {
      if (lower.includes(word)) {
        count++;
      }
    }
    
    return count;
  }

  /**
   * Calculate ratio of digits to total characters
   */
  private static calculateDigitRatio(str: string): number {
    if (str.length === 0) return 0;
    const digits = str.match(/\d/g) || [];
    return digits.length / str.length;
  }

  /**
   * Batch detection for multiple domains
   */
  static detectBatch(domains: string[]): DGAResult[] {
    return domains.map(domain => this.detect(domain));
  }

  /**
   * Filter domains to find likely DGA ones
   */
  static filterDGADomains(domains: string[], minConfidence: number = 0.6): string[] {
    return domains.filter(domain => {
      const result = this.detect(domain);
      return result.isDGA && result.confidence >= minConfidence;
    });
  }
}
