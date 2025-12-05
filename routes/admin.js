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

// Admin: users management
router.put(
  "/admin/users/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminUpdateUser
);

router.get(
  "/admin/users",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminGetAllUsers
);

router.get(
  "/admin/users/personal-search",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminSearchUserPersonalInfo
);

// Admin: list students only
router.get(
  "/admin/users/students",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminGetAllStudents
);

// Admin: list teachers only
router.get(
  "/admin/users/teachers",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminGetAllTeachers
);

router.get(
  "/admin/users/students/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminGetStudentById
);

router.get(
  "/admin/users/teachers/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminGetTeacherById
);

router.post(
  "/admin/users",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  optionalAvatarUpload,
  adminUser.adminCreateUser
);

router.get(
  "/admin/users/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminGetUserById
);

router.post(
  "/admin/users/:id/avatar",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  avatarUploadOne,
  adminUser.adminUploadAvatar
);

// Deactivate (soft delete) user
router.delete(
  "/admin/users/deactivate/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminDeactivateUser
);

// Activate user
router.patch(
  "/admin/users/activate/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminActivateUser
);

router.get(
  "/admin/training-reports",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminTrainingReports.getTrainingReportDashboard
);

router.get(
  "/admin/teacher-leaves/summary",
  middleware.verifyToken,
  middleware.authorizeGeneralLeaveApprover,
  adminTeacherLeaves.getTeacherLeaveSummary
);

router.get(
  "/admin/teacher-leaves",
  middleware.verifyToken,
  middleware.authorizeGeneralLeaveApprover,
  adminTeacherLeaves.listTeacherLeaves
);

router.patch(
  "/admin/teacher-leaves/:id/status",
  middleware.verifyToken,
  middleware.authorizeGeneralLeaveApprover,
  adminTeacherLeaves.updateTeacherLeaveStatus
);

router.get(
  "/admin/teacher-leaves/current",
  middleware.verifyToken,
  middleware.authorizeGeneralLeaveApprover,
  adminTeacherLeaves.listCurrentLeaves
);

// Admin: ตารางสอน/กิจกรรม ครู
router.post(
  "/admin/teaching-schedules",
  middleware.verifyToken,
  middleware.authorizeScheduleManager,
  adminTeachingSchedule.createSchedule
);

router.get(
  "/teaching-schedules",
  middleware.scheduleReadRateLimiter,
  adminTeachingSchedule.listSchedules
);

router.put(
  "/admin/teaching-schedules/:id",
  middleware.verifyToken,
  middleware.authorizeScheduleManager,
  adminTeachingSchedule.updateSchedule
);

router.delete(
  "/admin/teaching-schedules/:id",
  middleware.verifyToken,
  middleware.authorizeScheduleManager,
  adminTeachingSchedule.deleteSchedule
);

// Admin: มอบหมายงาน
router.post(
  "/admin/tasks",
  middleware.verifyToken,
  middleware.authorizeOwner,
  adminTaskAssignment.createTask
);

router.get(
  "/admin/tasks",
  middleware.verifyToken,
  middleware.authorizeNonStudent,
  adminTaskAssignment.listTasks
);

router.patch(
  "/admin/tasks/:id",
  middleware.verifyToken,
  middleware.authorizeNonStudent,
  adminTaskAssignment.updateTaskStatus
);

router.delete(
  "/admin/tasks/:id",
  middleware.verifyToken,
  middleware.authorizeOwner,
  adminTaskAssignment.deleteTask
);

module.exports = router;
