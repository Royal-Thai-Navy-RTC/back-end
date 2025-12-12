const express = require("express");
const middleware = require("../middlewares/middleware");
const { excelUploadOne } = require("../middlewares/upload");
const disciplineAssessmentController = require("../controllers/disciplineAssessmentController");

const router = express.Router();

router.post(
  "/discipline-assessments/import",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  excelUploadOne,
  disciplineAssessmentController.importDisciplineAssessments
);

router.get(
  "/discipline-assessments",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  disciplineAssessmentController.listDisciplineAssessments
);

module.exports = router;
