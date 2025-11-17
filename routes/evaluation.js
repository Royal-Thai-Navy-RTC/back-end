const express = require("express");
const {
  importEvaluationExcel,
  listEvaluationSheets,
  getEvaluationSheetById,
  downloadEvaluationTemplate,
} = require("../controllers/evaluationController");
const middleware = require("../middlewares/middleware");
const { excelUploadOne } = require("../middlewares/upload");

const router = express.Router();

// นำเข้าไฟล์ Excel เพื่อบันทึกคะแนนแบบประเมิน
router.post(
  "/evaluations/import",
  middleware.verifyToken,
  excelUploadOne,
  importEvaluationExcel
);

router.get(
  "/evaluations",
  middleware.verifyToken,
  listEvaluationSheets
);

router.get(
  "/evaluations/:id",
  middleware.verifyToken,
  getEvaluationSheetById
);

router.get(
  "/evaluations/template/download",
  middleware.verifyToken,
  downloadEvaluationTemplate
);

module.exports = router;
