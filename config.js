module.exports = {
  jwtSecret: process.env.JWT_SECRET || "dHw,ji^hlbot0Utg[[uh", // กำหนด secret key สำหรับการสร้าง token
  refreshTokenExpiryDays: Number(process.env.REFRESH_TOKEN_EXPIRY_DAYS || 7), // อายุของ refresh token (วัน)
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 300),
  authRateLimitWindowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000),
  authRateLimitMaxAttempts: Number(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS || 20),
  loginFailureThreshold: Number(process.env.LOGIN_FAIL_THRESHOLD || 3),
  loginFailureBaseDelayMs: Number(process.env.LOGIN_FAIL_BASE_DELAY_MS || 30 * 1000),
  loginFailureMaxDelayMs: Number(process.env.LOGIN_FAIL_MAX_DELAY_MS || 10 * 60 * 1000),
  loginFailureResetMs: Number(process.env.LOGIN_FAIL_RESET_MS || 30 * 60 * 1000),
};
