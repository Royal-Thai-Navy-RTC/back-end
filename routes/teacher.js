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

router.post(
  "/teacher/leaves",
  middleware.verifyToken,
  middleware.authorizeTeacher,
  teacherLeaveController.requestLeave
);

router.get(
  "/teacher/leaves",
  middleware.verifyToken,
  middleware.authorizeTeacher,
  teacherLeaveController.listMyLeaves
);

router.post(
  "/teacher/official-duty-leaves",
  middleware.verifyToken,
  middleware.authorizeTeacher,
  teacherLeaveController.requestOfficialDutyLeave
);

router.get(
  "/teacher/official-duty-leaves",
  middleware.verifyToken,
  middleware.authorizeTeacher,
  teacherLeaveController.listMyOfficialDutyLeaves
);

router.patch(
  "/teacher/leaves/:id/cancel",
  middleware.verifyToken,
  middleware.authorizeTeacher,
  teacherLeaveController.cancelMyLeave
);

router.get(
  "/teacher/notifications",
  middleware.verifyToken,
  middleware.authorizeTeacher,
  teacherNotificationController.getTeacherNotifications
);

router.patch(
  "/teacher/notifications/read",
  middleware.verifyToken,
  middleware.authorizeTeacher,
  teacherNotificationController.markTeacherNotificationsRead
);

module.exports = router;
