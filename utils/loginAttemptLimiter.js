const config = require("../config");

const ATTEMPT_STORE = new Map();

const getClientKey = (req) => {
  const forwarded = req.headers && req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return (
    req.ip ||
    (req.connection && req.connection.remoteAddress) ||
    (req.socket && req.socket.remoteAddress) ||
    "unknown"
  );
};

const resetIfExpired = (key, entry) => {
  if (!entry) return null;
  if (
    entry.lastFailureAt &&
    Date.now() - entry.lastFailureAt > config.loginFailureResetMs
  ) {
    ATTEMPT_STORE.delete(key);
    return null;
  }
  return entry;
};

const loginBruteForceGuard = (req, res, next) => {
  const key = getClientKey(req);
  const entry = resetIfExpired(key, ATTEMPT_STORE.get(key));
  if (entry && entry.blockUntil && entry.blockUntil > Date.now()) {
    const waitMs = entry.blockUntil - Date.now();
    const waitSeconds = Math.ceil(waitMs / 1000);
    res.setHeader("Retry-After", waitSeconds);
    return res.status(429).json({
      message: `ระบบตรวจพบการพยายามเข้าสู่ระบบจำนวนมาก กรุณารอ ${waitSeconds} วินาทีแล้วลองใหม่`,
    });
  }
  return next();
};

const registerLoginFailure = (req) => {
  const key = getClientKey(req);
  let entry = resetIfExpired(key, ATTEMPT_STORE.get(key));
  if (!entry) {
    entry = { failCount: 0, blockUntil: 0 };
  }
  entry.failCount += 1;
  entry.lastFailureAt = Date.now();
  if (entry.failCount >= config.loginFailureThreshold) {
    const exponent = entry.failCount - config.loginFailureThreshold;
    const delay = Math.min(
      config.loginFailureBaseDelayMs * Math.pow(2, Math.max(0, exponent)),
      config.loginFailureMaxDelayMs
    );
    entry.blockUntil = Date.now() + delay;
  }
  ATTEMPT_STORE.set(key, entry);
};

const registerLoginSuccess = (req) => {
  const key = getClientKey(req);
  if (ATTEMPT_STORE.has(key)) {
    ATTEMPT_STORE.delete(key);
  }
};

module.exports = {
  loginBruteForceGuard,
  registerLoginFailure,
  registerLoginSuccess,
};
