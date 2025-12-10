const express = require("express");
const middleware = require("../middlewares/middleware");
const teacherReportController = require("../controllers/teacherReportController");
const teacherLeaveController = require("../controllers/teacherLeaveController");
const teacherNotificationController = require("../controllers/teacherNotificationController");

const router = express.Router();

router.post(
  "/teacher/training-reports",
  middleware.verifyToken,
  middleware.authorizeTeacher,
  teacherReportController.submitTrainingReport
);

router.get(
  "/teacher/training-reports/latest",
  middleware.verifyToken,
  middleware.authorizeTeacher,
  teacherReportController.getRecentTrainingReports
);

// export excel file
router.get(
  "/teacher/training-reports/export",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  teacherReportController.exportTrainingReportsExcel
);

router.post(
  "/teacher/leaves",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  teacherLeaveController.requestLeave
);

router.get(
  "/teacher/leaves",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  teacherLeaveController.listMyLeaves
);

router.post(
  "/teacher/official-duty-leaves",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  teacherLeaveController.requestOfficialDutyLeave
);

router.get(
  "/teacher/official-duty-leaves",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  teacherLeaveController.listMyOfficialDutyLeaves
);

router.patch(
  "/teacher/leaves/:id/cancel",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  teacherLeaveController.cancelMyLeave
);

router.get(
  "/teacher/notifications",
  middleware.verifyToken,
  middleware.authorizeNonStudent,
  teacherNotificationController.getTeacherNotifications
);

router.patch(
  "/teacher/notifications/read",
  middleware.verifyToken,
  middleware.authorizeNonStudent,
  teacherNotificationController.markTeacherNotificationsRead
);

module.exports = router;
