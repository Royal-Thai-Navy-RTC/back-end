const express = require("express");
const middleware = require("../middlewares/middleware");
const ownerLeaveController = require("../controllers/ownerLeaveController");
const ownerNotificationController = require("../controllers/ownerNotificationController");
const ownerBackupController = require("../controllers/ownerBackupController");

const router = express.Router();

/**
 * =========================
 * Owner
 * =========================
 */

/**
 * @openapi
 * /api/owner/teacher-leaves:
 *   get:
 *     summary: List teacher leave requests (owner)
 *     tags: [Owner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List returned
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/owner/teacher-leaves",
  middleware.verifyToken,
  middleware.authorizeOwner,
  ownerLeaveController.listGeneralLeaves
);

/**
 * @openapi
 * /api/owner/teacher-leaves/{id}/status:
 *   patch:
 *     summary: Update teacher leave status (owner)
 *     tags: [Owner]
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
  "/owner/teacher-leaves/:id/status",
  middleware.verifyToken,
  middleware.authorizeOwner,
  ownerLeaveController.updateGeneralLeaveStatus
);

/**
 * @openapi
 * /api/owner/official-duty-leaves:
 *   get:
 *     summary: List official duty leave requests (owner)
 *     tags: [Owner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List returned
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/owner/official-duty-leaves",
  middleware.verifyToken,
  middleware.authorizeOwner,
  ownerLeaveController.listOfficialDutyLeaves
);

/**
 * @openapi
 * /api/owner/official-duty-leaves/{id}/status:
 *   patch:
 *     summary: Update official duty leave status (owner)
 *     tags: [Owner]
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
  "/owner/official-duty-leaves/:id/status",
  middleware.verifyToken,
  middleware.authorizeOwner,
  ownerLeaveController.updateOfficialDutyLeaveStatus
);

/**
 * @openapi
 * /api/owner/notifications:
 *   get:
 *     summary: Get owner notifications
 *     tags: [Owner Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         required: false
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Notifications returned
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/owner/notifications",
  middleware.verifyToken,
  middleware.authorizeOwner,
  ownerNotificationController.getOwnerNotifications
);

/**
 * @openapi
 * /api/owner/database/backup:
 *   get:
 *     summary: สำรองฐานข้อมูล (ดาวน์โหลดไฟล์ .sql)
 *     tags: [Owner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ไฟล์สำรองฐานข้อมูล (.sql)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Backup failed
 */
router.get(
  "/owner/database/backup",
  middleware.verifyToken,
  middleware.authorizeOwner,
  ownerBackupController.downloadDatabaseBackup
);

/**
 * @openapi
 * /api/owner/notifications/read:
 *   patch:
 *     summary: Mark owner notifications as read
 *     tags: [Owner Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Marked as read
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  "/owner/notifications/read",
  middleware.verifyToken,
  middleware.authorizeOwner,
  ownerNotificationController.markOwnerNotificationsRead
);

module.exports = router;
