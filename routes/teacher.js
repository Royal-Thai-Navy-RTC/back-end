const express = require("express");
const middleware = require("../middlewares/middleware");
const teacherReportController = require("../controllers/teacherReportController");
const teacherLeaveController = require("../controllers/teacherLeaveController");
const teacherNotificationController = require("../controllers/teacherNotificationController");

const router = express.Router();

/**
 * =========================
 * Teacher
 * =========================
 */

/**
 * @openapi
 * /api/teacher/training-reports:
 *   post:
 *     summary: Submit training report (teacher)
 *     tags: [Teacher]
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
 *         description: Submitted
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  "/teacher/training-reports",
  middleware.verifyToken,
  middleware.authorizeTeacher,
  teacherReportController.submitTrainingReport
);

/**
 * @openapi
 * /api/teacher/training-reports/latest:
 *   get:
 *     summary: Get latest training reports (teacher)
 *     tags: [Teacher]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Latest reports
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/teacher/training-reports/latest",
  middleware.verifyToken,
  middleware.authorizeTeacher,
  teacherReportController.getRecentTrainingReports
);

// export excel file
/**
 * @openapi
 * /api/teacher/training-reports/export:
 *   get:
 *     summary: Export training reports as Excel (admin)
 *     tags: [Teacher]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel file
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/teacher/training-reports/export",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  teacherReportController.exportTrainingReportsExcel
);

/**
 * @openapi
 * /api/teacher/leaves:
 *   post:
 *     summary: Request leave (admin or teacher)
 *     tags: [Teacher Leaves]
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
 *         description: Requested
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  "/teacher/leaves",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  teacherLeaveController.requestLeave
);

/**
 * @openapi
 * /api/teacher/leaves:
 *   get:
 *     summary: List my leaves (admin or teacher)
 *     tags: [Teacher Leaves]
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
  "/teacher/leaves",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  teacherLeaveController.listMyLeaves
);

/**
 * @openapi
 * /api/teacher/leaves/current:
 *   get:
 *     summary: List my current active leaves (admin or teacher)
 *     tags: [Teacher Leaves]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeOfficial
 *         required: false
 *         schema:
 *           type: boolean
 *         description: ตั้งค่าเป็น false เพื่อไม่ดึงข้อมูลลาไปราชการ
 *       - in: query
 *         name: teacherId
 *         required: false
 *         schema:
 *           type: integer
 *         description: สำหรับ ADMIN/OWNER เท่านั้น ใช้ระบุครูเป้าหมาย
 *     responses:
 *       200:
 *         description: List returned
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/teacher/leaves/current",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  teacherLeaveController.listMyCurrentLeaves
);

/**
 * @openapi
 * /api/teacher/official-duty-leaves:
 *   post:
 *     summary: Request official duty leave (admin or teacher)
 *     tags: [Teacher Leaves]
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
 *         description: Requested
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  "/teacher/official-duty-leaves",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  teacherLeaveController.requestOfficialDutyLeave
);

/**
 * @openapi
 * /api/teacher/official-duty-leaves:
 *   get:
 *     summary: List my official duty leaves (admin or teacher)
 *     tags: [Teacher Leaves]
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
  "/teacher/official-duty-leaves",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  teacherLeaveController.listMyOfficialDutyLeaves
);

/**
 * @openapi
 * /api/teacher/leaves/{id}/cancel:
 *   patch:
 *     summary: Cancel my leave request (admin or teacher)
 *     tags: [Teacher Leaves]
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
 *         description: Cancelled
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.patch(
  "/teacher/leaves/:id/cancel",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  teacherLeaveController.cancelMyLeave
);

/**
 * @openapi
 * /api/teacher/notifications:
 *   get:
 *     summary: Get teacher notifications (non-student)
 *     tags: [Teacher Notifications]
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
  "/teacher/notifications",
  middleware.verifyToken,
  middleware.authorizeNonStudent,
  teacherNotificationController.getTeacherNotifications
);

/**
 * @openapi
 * /api/teacher/notifications/read:
 *   patch:
 *     summary: Mark teacher notifications as read
 *     tags: [Teacher Notifications]
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
  "/teacher/notifications/read",
  middleware.verifyToken,
  middleware.authorizeNonStudent,
  teacherNotificationController.markTeacherNotificationsRead
);

module.exports = router;
