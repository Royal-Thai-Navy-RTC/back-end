const express = require("express");
const middleware = require("../middlewares/middleware");
const { excelUploadOne } = require("../middlewares/upload");
const examController = require("../controllers/examController");

const router = express.Router();

// นำเข้าผลสอบจากไฟล์ Excel
router.post(
  "/exam-results/import",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  excelUploadOne,
  examController.importExamExcel
);

// รายการผลสอบที่นำเข้าไว้
router.get(
  "/exam-results",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  examController.listExamResults
);

// สรุปคะแนนเฉลี่ยรายกองพัน/กองร้อย
router.get(
  "/exam-results/summary",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  examController.summarizeExamResults
);

router.delete(
  "/exam-results/:id",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  examController.deleteExamResult
);

// ลบผลสอบทั้งหมด
router.delete(
  "/exam-results",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  examController.deleteAllExamResults
);

// สรุปภาพรวม (จำนวนทั้งหมด, ค่าเฉลี่ย, รายการล่าสุด)
router.get(
  "/exam-results/overview",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  examController.getExamOverview
);

// ส่งออกผลสอบเป็นไฟล์ Excel (แยก sheet ตามกองร้อย)
router.get(
  "/exam-results/export",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  examController.exportExamResults
);

module.exports = router;
