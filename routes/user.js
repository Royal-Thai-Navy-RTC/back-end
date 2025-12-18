const express = require("express");
const userController = require("../controllers/userController");
const middleware = require("../middlewares/middleware");
const { avatarUploadOne } = require("../middlewares/upload");

const router = express.Router();

/**
 * =========================
 * Users : Profile
 * =========================
 */

// Profile routes (must be logged in)

/**
 * @openapi
 * /api/me:
 *   get:
 *     summary: Get my profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile returned
 *       401:
 *         description: Unauthorized
 */
router.get("/me", middleware.verifyToken, userController.getMe);

/**
 * @openapi
 * /api/me:
 *   put:
 *     summary: Update my profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.put("/me", middleware.verifyToken, userController.updateMe);

/**
 * @openapi
 * /api/me/avatar:
 *   post:
 *     summary: Upload my avatar (image)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploaded
 *       400:
 *         description: Invalid file or input
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/me/avatar",
  middleware.verifyToken,
  avatarUploadOne,
  userController.uploadAvatar
);

/**
 * @openapi
 * /api/me/change-password:
 *   post:
 *     summary: Change my password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password changed
 *       400:
 *         description: Invalid password or input
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/me/change-password",
  middleware.verifyToken,
  userController.changeMyPassword
);

module.exports = router;
