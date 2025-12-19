const express = require("express");
const authController = require("../controllers/authController");
const { avatarUploadOne } = require("../middlewares/upload");
const {
  authRateLimiter,
  loginBruteForceGuard,
  verifyToken,
  authorizeOwner,
} = require("../middlewares/middleware");

const router = express.Router();

const optionalAvatarUpload = (req, res, next) => {
  const contentType = (req.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("multipart/form-data")) {
    return avatarUploadOne(req, res, next);
  }
  return next();
};

/**
 * =========================
 * Auth
 * =========================
 */

/**
 * @openapi
 * /api/register:
 *   post:
 *     summary: Register new user
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - firstName
 *               - lastName
 *               - email
 *               - phone
 *               - rank
 *               - profileImage
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin01
 *               password:
 *                 type: string
 *                 format: password
 *                 example: P@ssw0rd
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               rank:
 *                 type: string
 *               profileImage:
 *                 type: string
 *                 description: Base64 image string or data URL
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin01
 *               password:
 *                 type: string
 *                 format: password
 *                 example: P@ssw0rd
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Registered successfully
 *       400:
 *         description: Invalid input
 *       429:
 *         description: Too many requests
 */
router.post(
  "/register",
  authRateLimiter,
  optionalAvatarUpload,
  authController.register
);

/**
 * @openapi
 * /api/registration/status:
 *   get:
 *     summary: Get registration availability
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: Status returned
 */
router.get("/registration/status", authController.getRegistrationStatus);

/**
 * @openapi
 * /api/owner/registration/status:
 *   patch:
 *     summary: Toggle registration availability (owner only)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid payload
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  "/owner/registration/status",
  verifyToken,
  authorizeOwner,
  authController.updateRegistrationStatus
);

/**
 * @openapi
 * /api/login:
 *   post:
 *     summary: User login
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin01
 *               password:
 *                 type: string
 *                 format: password
 *                 example: P@ssw0rd
 *     responses:
 *       200:
 *         description: Login success
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many login attempts
 */
router.post(
  "/login",
  authRateLimiter,
  loginBruteForceGuard,
  authController.login
);

/**
 * @openapi
 * /api/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: x-refresh-token
 *         required: false
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed
 *       401:
 *         description: Invalid refresh token
 */
router.post(
  "/refresh-token",
  authController.refreshToken
);

module.exports = router;
