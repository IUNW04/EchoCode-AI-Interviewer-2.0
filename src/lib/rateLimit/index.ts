import { LRUCache } from 'lru-cache';

// Configure the cache
const tokenCache = new LRUCache<string, number[]>({
  max: 1000, // Max 1000 unique IPs
  ttl: 1000 * 60 * 15, // 15 minute window
});

// Rate limit configuration
const RATE_LIMIT = {
  WINDOW_MS: 60000, // 1 minute
  MAX_REQUESTS: 30, // 30 requests per minute
};

export const checkRateLimit = (ip: string) => {
  const now = Date.now();
  const tokenState = tokenCache.get(ip) || [];

  // Remove old timestamps
  const recentRequests = tokenState.filter(time => now - time < RATE_LIMIT.WINDOW_MS);
  
  // Check if we've exceeded the limit
  const isRateLimited = recentRequests.length >= RATE_LIMIT.MAX_REQUESTS;
  
  // Add current request
  recentRequests.push(now);
  tokenCache.set(ip, recentRequests);

  return {
    isRateLimited,
    remaining: Math.max(0, RATE_LIMIT.MAX_REQUESTS - recentRequests.length),
    reset: Math.ceil((recentRequests[0] + RATE_LIMIT.WINDOW_MS - now) / 1000),
  };
};

// Client-side rate limiter for UI feedback
export class ClientRateLimiter {
  private lastRequestTime = 0;
  private readonly MIN_INTERVAL = 3000; // 3 seconds between AI analysis calls

  canMakeRequest(): boolean {
    const now = Date.now();
    if (now - this.lastRequestTime > this.MIN_INTERVAL) {
      this.lastRequestTime = now;
      return true;
    }
    return false;
  }

  getTimeUntilNextRequest(): number {
    return Math.max(0, this.MIN_INTERVAL - (Date.now() - this.lastRequestTime));
  }
}

// Default export for backward compatibility
const rateLimit = {
  checkRateLimit,
  ClientRateLimiter
};

export default rateLimit;

