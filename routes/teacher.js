const express = require("express");
const middleware = require("../middlewares/middleware");
const teacherReportController = require("../controllers/teacherReportController");
const teacherLeaveController = require("../controllers/teacherLeaveController");

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

module.exports = router;
