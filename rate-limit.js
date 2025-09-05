/**
 * API Rate Limiting Module
 * Limits requests from external domains to prevent abuse
 */

// Rate limiting configuration
const ALLOWED_DOMAIN = "https://3d-model.aaronlei.com";
const MAX_REQUESTS_PER_DAY = 5;
const RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// In-memory storage for rate limiting
const rateLimitStore = new Map();

/**
 * Rate limiting middleware function
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function rateLimitMiddleware(req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || '127.0.0.1';
  const referer = req.get('Referer') || '';

  console.log(`Rate limit check - IP: ${clientIP}, Referer: ${referer}, Allowed Domain: ${ALLOWED_DOMAIN}`);

  // Check if request is from allowed domain
  if (referer.startsWith(ALLOWED_DOMAIN)) {
    console.log('Request from allowed domain - allowing');
    return next(); // Allow requests from allowed domain
  }

  console.log('Request from external source - applying rate limit');

  // Get current rate limit data for this IP
  const now = Date.now();
  let rateLimitData = rateLimitStore.get(clientIP);

  // Clean up expired entries
  if (rateLimitData && now > rateLimitData.resetTime) {
    rateLimitStore.delete(clientIP);
    rateLimitData = null;
  }

  // Initialize or update rate limit data
  if (!rateLimitData) {
    rateLimitData = {
      count: 0,
      resetTime: now + RATE_LIMIT_WINDOW
    };
  }

  // Check if limit exceeded
  if (rateLimitData.count >= MAX_REQUESTS_PER_DAY) {
    const remainingTime = Math.ceil((rateLimitData.resetTime - now) / (60 * 1000)); // minutes
    return res.status(429).json({
      ok: false,
      error: 'Too Many Requests',
      message: `超出請求限制。請等待 ${remainingTime} 分鐘後再試。`,
      retryAfter: remainingTime
    });
  }

  // Increment request count
  rateLimitData.count++;
  rateLimitStore.set(clientIP, rateLimitData);

  // Add rate limit headers
  res.set({
    'X-RateLimit-Limit': MAX_REQUESTS_PER_DAY,
    'X-RateLimit-Remaining': Math.max(0, MAX_REQUESTS_PER_DAY - rateLimitData.count),
    'X-RateLimit-Reset': rateLimitData.resetTime
  });

  next();
}

/**
 * Get rate limit statistics for monitoring
 * @returns {Object} Rate limit statistics
 */
function getRateLimitStats() {
  return {
    totalTrackedIPs: rateLimitStore.size,
    allowedDomain: ALLOWED_DOMAIN,
    maxRequestsPerDay: MAX_REQUESTS_PER_DAY,
    windowMs: RATE_LIMIT_WINDOW,
    currentEntries: Array.from(rateLimitStore.entries()).map(([ip, data]) => ({
      ip,
      count: data.count,
      resetTime: new Date(data.resetTime).toISOString(),
      remaining: Math.max(0, MAX_REQUESTS_PER_DAY - data.count)
    }))
  };
}

/**
 * Clean up expired rate limit entries
 * This can be called periodically to free memory
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  let cleaned = 0;

  for (const [ip, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(ip);
      cleaned++;
    }
  }

  console.log(`Cleaned up ${cleaned} expired rate limit entries`);
  return cleaned;
}

// Export the middleware and utility functions
export {
  rateLimitMiddleware,
  getRateLimitStats,
  cleanupExpiredEntries,
  ALLOWED_DOMAIN,
  MAX_REQUESTS_PER_DAY,
  RATE_LIMIT_WINDOW
};
