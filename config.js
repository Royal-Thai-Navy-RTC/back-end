module.exports = {
  jwtSecret: process.env.JWT_SECRET || "dHw,ji^hlbot0Utg[[uh", // กำหนด secret key สำหรับการสร้าง token
  refreshTokenExpiryDays: Number(process.env.REFRESH_TOKEN_EXPIRY_DAYS || 7), // อายุของ refresh token (วัน)
};
