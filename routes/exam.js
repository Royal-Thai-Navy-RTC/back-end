const express = require("express");
const middleware = require("../middlewares/middleware");
const { excelUploadOne } = require("../middlewares/upload");
const examController = require("../controllers/examController");

const router = express.Router();

// นำเข้าผลสอบจากไฟล์ Excel
/**
 * =========================
 * Exam Results
 * =========================
 */

/**
 * @openapi
 * /api/exam-results/import:
 *   post:
 *     summary: Import exam results from Excel
 *     tags: [Exam Results]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Imported
 *       400:
 *         description: Invalid file or data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  "/exam-results/import",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  excelUploadOne,
  examController.importExamExcel
);

// รายการผลสอบที่นำเข้าไว้
/**
 * @openapi
 * /api/exam-results:
 *   get:
 *     summary: List exam results
 *     tags: [Exam Results]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         required: false
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List returned
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/exam-results",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  examController.listExamResults
);

// สรุปคะแนนเฉลี่ยรายกองพัน/กองร้อย
/**
 * @openapi
 * /api/exam-results/summary:
 *   get:
 *     summary: Summarize exam results
 *     tags: [Exam Results]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Summary returned
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/exam-results/summary",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  examController.summarizeExamResults
);

/**
 * @openapi
 * /api/exam-results/{id}:
 *   delete:
 *     summary: Delete exam result by id
 *     tags: [Exam Results]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.delete(
  "/exam-results/:id",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  examController.deleteExamResult
);

// ลบผลสอบทั้งหมด
/**
 * @openapi
 * /api/exam-results:
 *   delete:
 *     summary: Delete all exam results
 *     tags: [Exam Results]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete(
  "/exam-results",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  examController.deleteAllExamResults
);

// สรุปภาพรวม (จำนวนทั้งหมด, ค่าเฉลี่ย, รายการล่าสุด)
/**
 * @openapi
 * /api/exam-results/overview:
 *   get:
 *     summary: Exam results overview
 *     tags: [Exam Results]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overview returned
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/exam-results/overview",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  examController.getExamOverview
);

// ส่งออกผลสอบเป็นไฟล์ Excel (แยก sheet ตามกองร้อย)
/**
 * @openapi
 * /api/exam-results/export:
 *   get:
 *     summary: Export exam results as Excel
 *     tags: [Exam Results]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel file
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/exam-results/export",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  examController.exportExamResults
);

module.exports = router;
