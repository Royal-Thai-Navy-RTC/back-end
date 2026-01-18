const express = require("express");
const middleware = require("../middlewares/middleware");
const { avatarUploadOne } = require("../middlewares/upload");
const adminUser = require("../controllers/admin/userAdminController");
const adminTrainingReports = require("../controllers/admin/trainingReportAdminController");
const adminTeacherLeaves = require("../controllers/admin/teacherLeaveAdminController");
const adminTeachingSchedule = require("../controllers/admin/teachingScheduleAdminController");
const adminTaskAssignment = require("../controllers/admin/taskAssignmentAdminController");

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
 * Admin : Users Management
 * =========================
 */

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     summary: Get all users (admin)
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *     parameters:
 *       - in: query
 *         name: onlydivision
 *         required: false
 *         schema:
 *           type: boolean
 *         description: กรองเฉพาะผู้ใช้ที่มี division (default false)
 */
router.get(
  "/admin/users",
  middleware.verifyToken,
  middleware.authorizeAdminOrScheduleTeacherList,
  adminUser.adminGetAllUsers
);

/**
 * @openapi
 * /api/admin/division/{id}:
 *   get:
 *     summary: Get users by division
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of users in the division
 */
router.get(
  "/admin/division/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminGetUsersByDivision
);

/**
 * @openapi
 * /api/admin/users/division-summary:
 *   get:
 *     summary: Summarize users by division
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Summary of division counts
 */
router.get(
  "/admin/users/division-summary",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminGetDivisionSummary
);

/**
 * @openapi
 * /api/admin/summary:
 *   get:
 *     summary: Summarize users by role
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Summary of role counts
 */
router.get(
  "/admin/summary",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminGetRoleSummary
);

/**
 * @openapi
 * /api/admin/users/personal-search:
 *   get:
 *     summary: Search user personal information
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Search result
 */
router.get(
  "/admin/users/personal-search",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminSearchUserPersonalInfo
);

/**
 * @openapi
  * /api/admin/users/students:
  *   get:
  *     summary: Get all students
  *     tags: [Admin Users]
  *     security:
  *       - bearerAuth: []
  *     responses:
  *       200:
  *         description: List of students
  *       401:
  *         description: Unauthorized
  *       403:
  *         description: Forbidden
  */
router.get(
  "/admin/users/students",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminGetAllStudents
);

/**
 * @openapi
  * /api/admin/users/teachers:
  *   get:
  *     summary: Get all teachers
  *     tags: [Admin Users]
  *     security:
  *       - bearerAuth: []
  *     responses:
  *       200:
  *         description: List of teachers
  *       401:
  *         description: Unauthorized
  *       403:
  *         description: Forbidden
  */
router.get(
  "/admin/users/teachers",
  middleware.verifyToken,
  middleware.authorizeAdminOrScheduleTeacherList,
  adminUser.adminGetAllTeachers
);

/**
 * @openapi
 * /api/admin/users:
 *   post:
 *     summary: Create user (admin)
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: User created
 */
router.post(
  "/admin/users",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  optionalAvatarUpload,
  adminUser.adminCreateUser
);

/**
 * @openapi
 * /api/admin/users/person/{id}:
 *   get:
 *     summary: Export a user profile as PDF (admin)
 *     tags: [Admin Users]
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
 *         description: PDF file
 *       400:
 *         description: Invalid id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.get(
  "/admin/users/export/pdf/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminExportUserPersonPdf
);

/**
 * @openapi
  * /api/admin/users/{id}:
  *   get:
  *     summary: Get user by id
  *     tags: [Admin Users]
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
  *         description: User returned (รวมข้อมูลประเมินราชการและงานที่มอบหมาย)
  *       400:
  *         description: Invalid id
  *       401:
  *         description: Unauthorized
  *       403:
  *         description: Forbidden
  *       404:
  *         description: Not found
  */
router.get(
  "/admin/users/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminGetUserById
);

/**
 * @openapi
 * /api/admin/users/{id}:
 *   put:
 *     summary: Update user
 *     tags: [Admin Users]
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
 *               studentClassYear:
 *                 type: integer
 *                 description: ชั้นปีของนักเรียน (ส่ง null เพื่อล้างค่า)
 *               isOnOfficialDuty:
 *                 type: boolean
 *                 description: ระบุว่าผู้ใช้อยู่ระหว่างไปช่วยราชการหรือไม่
 *               officialDutyNote:
 *                 type: string
 *                 description: หมายเหตุการไปช่วยราชการ
 *               isAnnualHealthCheckDone:
 *                 type: boolean
 *                 description: ตรวจสุขภาพประจำปีแล้วหรือไม่
 *     responses:
 *       200:
 *         description: User updated
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.put(
  "/admin/users/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminUpdateUser
);

/**
 * @openapi
  * /api/admin/users/{id}/avatar:
  *   post:
  *     summary: Upload user avatar
  *     tags: [Admin Users]
  *     security:
  *       - bearerAuth: []
  *     parameters:
  *       - in: path
  *         name: id
  *         required: true
  *         schema:
  *           type: integer
  *     requestBody:
  *       content:
  *         multipart/form-data:
  *           schema:
  *             type: object
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
  *       403:
  *         description: Forbidden
  *       404:
  *         description: Not found
  */
router.post(
  "/admin/users/:id/avatar",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  avatarUploadOne,
  adminUser.adminUploadAvatar
);

/**
 * @openapi
  * /api/admin/users/deactivate/{id}:
  *   delete:
  *     summary: Deactivate user
  *     tags: [Admin Users]
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
  *         description: Deactivated
  *       400:
  *         description: Invalid id
  *       401:
  *         description: Unauthorized
  *       403:
  *         description: Forbidden
  *       404:
  *         description: Not found
  */
router.delete(
  "/admin/users/deactivate/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminDeactivateUser
);

/**
 * @openapi
  * /api/admin/users/activate/{id}:
  *   patch:
  *     summary: Activate user
  *     tags: [Admin Users]
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
  *         description: Activated
  *       400:
  *         description: Invalid id
  *       401:
  *         description: Unauthorized
  *       403:
  *         description: Forbidden
  *       404:
  *         description: Not found
  */
router.patch(
  "/admin/users/activate/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminActivateUser
);

/**
 * =========================
 * Admin : Training Reports
 * =========================
 */

/**
 * @openapi
  * /api/admin/training-reports:
  *   get:
  *     summary: Training report dashboard
  *     tags: [Admin Training]
  *     security:
  *       - bearerAuth: []
  *     responses:
  *       200:
  *         description: Dashboard data
  *       401:
  *         description: Unauthorized
  *       403:
  *         description: Forbidden
  */
router.get(
  "/admin/training-reports",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminTrainingReports.getTrainingReportDashboard
);

/**
 * @openapi
  * /api/admin/training-reports/company-summary:
  *   get:
  *     summary: Company participant summary from training reports
  *     tags: [Admin Training]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: กรองตามวันเดียว (ส่งค่านี้จะ override startDate/endDate)
 *       - in: query
 *         name: startDate
 *         required: false
  *         schema:
  *           type: string
  *           format: date
  *         description: กรองข้อมูลตั้งแต่วันที่ (YYYY-MM-DD)
  *       - in: query
  *         name: endDate
  *         required: false
  *         schema:
  *           type: string
  *           format: date
  *         description: กรองข้อมูลถึงวันที่ (YYYY-MM-DD)
  *     responses:
  *       200:
  *         description: Summary returned
  *       400:
  *         description: Invalid input
  *       401:
  *         description: Unauthorized
  *       403:
  *         description: Forbidden
  */
router.get(
  "/admin/training-reports/company-summary",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminTrainingReports.getCompanyTrainingReportSummary
);

/**
 * =========================
 * Admin : Teacher Leaves
 * =========================
 */

/**
 * @openapi
  * /api/admin/teacher-leaves/summary:
  *   get:
  *     summary: Teacher leave summary
  *     tags: [Admin Leaves]
  *     security:
  *       - bearerAuth: []
  *     responses:
  *       200:
  *         description: Summary returned
  *       401:
  *         description: Unauthorized
  *       403:
  *         description: Forbidden
  */
router.get(
  "/admin/teacher-leaves/summary",
  middleware.verifyToken,
  middleware.authorizeGeneralLeaveApprover,
  adminTeacherLeaves.getTeacherLeaveSummary
);

/**
 * @openapi
  * /api/admin/teacher-leaves:
  *   get:
  *     summary: List teacher leaves
  *     tags: [Admin Leaves]
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
  "/admin/teacher-leaves",
  middleware.verifyToken,
  middleware.authorizeGeneralLeaveApprover,
  adminTeacherLeaves.listTeacherLeaves
);

/**
 * @openapi
 * /api/admin/teacher-leaves/export:
 *   get:
 *     summary: Export teacher leave history as Excel
 *     tags: [Admin Leaves]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         required: false
 *         schema:
 *           type: integer
 *           example: 2025
 *         description: ปีที่ต้องการส่งออก (ค่าเริ่มต้นคือปีปัจจุบัน)
 *     responses:
 *       200:
 *         description: Excel file
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/admin/teacher-leaves/export",
  middleware.verifyToken,
  middleware.authorizeGeneralLeaveApprover,
  adminTeacherLeaves.exportTeacherLeaveHistory
);

/**
 * @openapi
  * /api/admin/teacher-leaves/{id}/status:
  *   patch:
  *     summary: Update teacher leave status
  *     tags: [Admin Leaves]
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
  "/admin/teacher-leaves/:id/status",
  middleware.verifyToken,
  middleware.authorizeGeneralLeaveApprover,
  adminTeacherLeaves.updateTeacherLeaveStatus
);

/**
 * @openapi
  * /api/admin/teacher-leaves/current:
  *   get:
  *     summary: List current teacher leaves
  *     tags: [Admin Leaves]
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
  "/admin/teacher-leaves/current",
  middleware.verifyToken,
  middleware.authorizeGeneralLeaveApprover,
  adminTeacherLeaves.listCurrentLeaves
);

/**
 * =========================
 * Admin : Teaching Schedules
 * =========================
 */

/**
 * @openapi
  * /api/admin/teaching-schedules:
  *   post:
  *     summary: Create teaching schedule
  *     tags: [Admin Schedule]
  *     security:
  *       - bearerAuth: []
  *     requestBody:
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             type: object
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
  "/admin/teaching-schedules",
  middleware.verifyToken,
  middleware.authorizeScheduleManager,
  adminTeachingSchedule.createSchedule
);

/**
 * @openapi
  * /api/teaching-schedules:
  *   get:
  *     summary: List teaching schedules (public/limited)
  *     tags: [Schedule]
  *     security: []
  *     responses:
  *       200:
  *         description: List returned
  *       429:
  *         description: Too many requests
  */
router.get(
  "/teaching-schedules",
  middleware.scheduleReadRateLimiter,
  adminTeachingSchedule.listSchedules
);

/**
 * @openapi
  * /api/admin/teaching-schedules/{id}:
  *   put:
  *     summary: Update teaching schedule
  *     tags: [Admin Schedule]
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
router.put(
  "/admin/teaching-schedules/:id",
  middleware.verifyToken,
  middleware.authorizeScheduleManager,
  adminTeachingSchedule.updateSchedule
);

/**
 * @openapi
  * /api/admin/teaching-schedules/{id}:
  *   delete:
  *     summary: Delete teaching schedule
  *     tags: [Admin Schedule]
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
  *         description: Invalid id
  *       401:
  *         description: Unauthorized
  *       403:
  *         description: Forbidden
  *       404:
  *         description: Not found
  */
router.delete(
  "/admin/teaching-schedules/:id",
  middleware.verifyToken,
  middleware.authorizeScheduleManager,
  adminTeachingSchedule.deleteSchedule
);

/**
 * =========================
 * Admin : Task Assignment
 * =========================
 */

/**
 * @openapi
  * /api/admin/tasks:
  *   post:
  *     summary: Create task
  *     tags: [Admin Tasks]
  *     security:
  *       - bearerAuth: []
  *     requestBody:
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             type: object
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
  "/admin/tasks",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminTaskAssignment.createTask
);

/**
 * @openapi
  * /api/admin/tasks:
  *   get:
  *     summary: List tasks
  *     tags: [Admin Tasks]
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
  "/admin/tasks",
  middleware.verifyToken,
  middleware.authorizeNonStudent,
  adminTaskAssignment.listTasks
);

/**
 * @openapi
  * /api/admin/tasks/{id}:
  *   patch:
  *     summary: Update task status
  *     tags: [Admin Tasks]
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
  "/admin/tasks/:id",
  middleware.verifyToken,
  middleware.authorizeNonStudent,
  adminTaskAssignment.updateTaskStatus
);

/**
 * @openapi
  * /api/admin/tasks/{id}:
  *   delete:
  *     summary: Delete task
  *     tags: [Admin Tasks]
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
  *         description: Invalid id
  *       401:
  *         description: Unauthorized
  *       403:
  *         description: Forbidden
  *       404:
  *         description: Not found
  */
router.delete(
  "/admin/tasks/:id",
  middleware.verifyToken,
  middleware.authorizeOwner,
  adminTaskAssignment.deleteTask
);

module.exports = router;
