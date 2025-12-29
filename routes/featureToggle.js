const express = require("express");
const middleware = require("../middlewares/middleware");
const featureToggleController = require("../controllers/featureToggleController");

const router = express.Router();

/**
 * @openapi
 * /api/front-card/status:
 *   get:
 *     summary: Get front-end card visibility status
 *     tags: [Feature Toggle]
 *     security: []
 *     responses:
 *       200:
 *         description: Status returned
 *   patch:
 *     summary: Update front-end card visibility status (admin)
 *     tags: [Feature Toggle]
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
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get("/front-card/status", featureToggleController.getFrontCardStatus);
router.patch(
  "/front-card/status",
  middleware.verifyToken,
  middleware.authorizeOwner,
  featureToggleController.updateFrontCardStatus
);

module.exports = router;
