const express = require("express");
const middleware = require("../middlewares/middleware");
const { excelUploadOne } = require("../middlewares/upload");
const ethicsController = require("../controllers/ethicsController");

const router = express.Router();

router.post(
  "/ethics-assessments/import",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  excelUploadOne,
  ethicsController.importEthicsAssessments
);

router.get(
  "/ethics-assessments",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  ethicsController.listEthicsAssessments
);

router.delete(
  "/ethics-assessments/:id",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  ethicsController.deleteEthicsAssessmentById
);

router.delete(
  "/ethics-assessments",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  ethicsController.deleteAllEthicsAssessments
);

module.exports = router;
