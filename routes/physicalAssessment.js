const express = require("express");
const middleware = require("../middlewares/middleware");
const { excelUploadOne } = require("../middlewares/upload");
const physicalAssessmentController = require("../controllers/physicalAssessmentController");

const router = express.Router();

router.post(
  "/physical-assessments/import",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  excelUploadOne,
  physicalAssessmentController.importPhysicalAssessments
);

router.get(
  "/physical-assessments",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  physicalAssessmentController.listPhysicalAssessments
);

router.delete(
  "/physical-assessments/:id",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  physicalAssessmentController.deletePhysicalAssessmentById
);

router.delete(
  "/physical-assessments",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  physicalAssessmentController.deleteAllPhysicalAssessments
);

module.exports = router;
