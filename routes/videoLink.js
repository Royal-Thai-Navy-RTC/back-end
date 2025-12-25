const express = require("express");
const middleware = require("../middlewares/middleware");
const videoLinkController = require("../controllers/videoLinkController");

const router = express.Router();

/**
 * =========================
 * Video Links
 * =========================
 */

/**
 * @openapi
 * /api/video-links:
 *   get:
 *     summary: List video links (public)
 *     tags: [VideoLinks]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [YOUTUBE, TIKTOK]
 *     responses:
 *       200:
 *         description: List returned
 */
router.get("/video-links", videoLinkController.listVideoLinks);

/**
 * @openapi
 * /api/video-links:
 *   post:
 *     summary: Create video link (admin)
 *     tags: [VideoLinks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               title:
 *                 type: string
 *               url:
 *                 type: string
 *               platform:
 *                 type: string
 *                 enum: [YOUTUBE, TIKTOK]
 *               isActive:
 *                 type: boolean
 *               displayOrder:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  "/video-links",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  videoLinkController.createVideoLink
);

/**
 * @openapi
 * /api/video-links/{id}:
 *   patch:
 *     summary: Update video link (admin)
 *     tags: [VideoLinks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               url:
 *                 type: string
 *               platform:
 *                 type: string
 *                 enum: [YOUTUBE, TIKTOK]
 *               isActive:
 *                 type: boolean
 *               displayOrder:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.patch(
  "/video-links/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  videoLinkController.updateVideoLink
);

/**
 * @openapi
 * /api/video-links/{id}:
 *   delete:
 *     summary: Delete video link (admin)
 *     tags: [VideoLinks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.delete(
  "/video-links/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  videoLinkController.deleteVideoLink
);

module.exports = router;
