const express = require("express");
const authController = require("../controllers/authController");
const { avatarUploadOne } = require("../middlewares/upload");
const { authRateLimiter, loginBruteForceGuard } = require("../middlewares/middleware");

const router = express.Router();

const optionalAvatarUpload = (req, res, next) => {
  const contentType = (req.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("multipart/form-data")) {
    return avatarUploadOne(req, res, next);
  }
  return next();
};

// Auth
router.post(
  "/register",
  authRateLimiter,
  optionalAvatarUpload,
  authController.register
);
router.post(
  "/login",
  authRateLimiter,
  loginBruteForceGuard,
  authController.login
);
router.post("/refresh-token", authController.refreshToken);

module.exports = router;
