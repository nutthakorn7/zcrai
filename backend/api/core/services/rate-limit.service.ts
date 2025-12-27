
/**
 * Rate Limit Service
 * Implements a Token Bucket algorithm to throttle outgoing API calls.
 * Used to prevent quota exhaustion for Gemini, VirusTotal, etc.
 */
export class RateLimitService {
    private static buckets: Map<string, TokenBucket> = new Map();

    private static config = {
        'gemini': { capacity: 15, refillRate: 15 / 60 }, // 15 RPM (Free tier is often 15 RPM, Pay-as-you-go is 60+)
        'virustotal': { capacity: 4, refillRate: 4 / 60 }, // 4 RPM (Public API limit)
        'abuseipdb': { capacity: 10, refillRate: 10 / 60 }, // 10 RPM (Free tier)
        'alienvault': { capacity: 100, refillRate: 100 / 60 }, // OTX is generous but let's be safe
        'default': { capacity: 60, refillRate: 1 } // 1 TPS
    };

    /**
     * Consume tokens from a bucket. Waits if tokens are not available.
     * @param key Service key (e.g., 'gemini', 'virustotal')
     * @param tokens Number of tokens to consume (default 1)
     */
    static async consume(key: string, tokens: number = 1): Promise<void> {
        const bucket = this.getBucket(key);
        await bucket.consume(tokens);
    }

    private static getBucket(key: string): TokenBucket {
        if (!this.buckets.has(key)) {
            const conf = this.config[key as keyof typeof this.config] || this.config['default'];
            this.buckets.set(key, new TokenBucket(conf.capacity, conf.refillRate));
        }
        return this.buckets.get(key)!;
    }
}

class TokenBucket {
    private tokens: number;
    private lastRefill: number;
    private capacity: number;
    private refillRate: number; // Tokens per second

    constructor(capacity: number, refillRate: number) {
        this.capacity = capacity;
        this.refillRate = refillRate;
        this.tokens = capacity;
        this.lastRefill = Date.now();
    }

    private refill() {
        const now = Date.now();
        const delta = (now - this.lastRefill) / 1000; // seconds
        const newTokens = delta * this.refillRate;
        
        if (newTokens > 0) {
            this.tokens = Math.min(this.capacity, this.tokens + newTokens);
            this.lastRefill = now;
        }
    }

    async consume(count: number): Promise<void> {
        this.refill();

        if (this.tokens >= count) {
            this.tokens -= count;
            return;
        }

        // Not enough tokens, calculate wait time
        const deficit = count - this.tokens;
        const waitTimeMs = (deficit / this.refillRate) * 1000;
        
        // Wait and retry
        console.log(`[RateLimit] Throttling ${waitTimeMs.toFixed(0)}ms for tokens...`);
        await new Promise(resolve => setTimeout(resolve, waitTimeMs));
        
        // Recursive call to re-check after waiting (handling race conditions slightly better for single thread)
        return this.consume(count);
    }
}
