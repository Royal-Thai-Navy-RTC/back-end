const express = require("express");
const middleware = require("../middlewares/middleware");
const { excelUploadOne } = require("../middlewares/upload");
const examController = require("../controllers/examController");

const router = express.Router();

// นำเข้าผลสอบจากไฟล์ Excel
router.post(
  "/exam-results/import",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  excelUploadOne,
  examController.importExamExcel
);

// รายการผลสอบที่นำเข้าไว้
router.get(
  "/exam-results",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  examController.listExamResults
);

// สรุปคะแนนเฉลี่ยรายกองพัน/กองร้อย
router.get(
  "/exam-results/summary",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  examController.summarizeExamResults
);

module.exports = router;
