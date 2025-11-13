const express = require("express");
const middleware = require("../middlewares/middleware");
const teacherReportController = require("../controllers/teacherReportController");

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

module.exports = router;
