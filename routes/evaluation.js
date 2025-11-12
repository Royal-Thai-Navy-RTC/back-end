const express = require("express");
const { importEvaluationExcel } = require("../controllers/evaluationController");
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

module.exports = router;

