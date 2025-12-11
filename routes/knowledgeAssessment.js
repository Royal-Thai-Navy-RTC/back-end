const express = require("express");
const middleware = require("../middlewares/middleware");
const { excelUploadOne } = require("../middlewares/upload");
const knowledgeAssessmentController = require("../controllers/knowledgeAssessmentController");

const router = express.Router();

router.post(
  "/knowledge-assessments/import",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  excelUploadOne,
  knowledgeAssessmentController.importKnowledgeAssessments
);

router.get(
  "/knowledge-assessments",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  knowledgeAssessmentController.listKnowledgeAssessments
);

module.exports = router;
