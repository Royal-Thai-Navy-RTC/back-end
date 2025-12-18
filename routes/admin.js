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
 */
router.get(
  "/admin/users",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminGetAllUsers
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
  middleware.authorizeAdmin,
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
  "/admin/users/person/:id",
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
  *         description: User returned
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
  middleware.authorizeOwner,
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
