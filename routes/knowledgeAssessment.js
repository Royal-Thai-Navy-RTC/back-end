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

router.delete(
  "/knowledge-assessments/:id",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  knowledgeAssessmentController.deleteKnowledgeAssessmentById
);

router.delete(
  "/knowledge-assessments",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  knowledgeAssessmentController.deleteAllKnowledgeAssessments
);

module.exports = router;
