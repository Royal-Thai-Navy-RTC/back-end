const express = require("express");
const {
  importEvaluationExcel,
  listEvaluationSheets,
  getEvaluationSheetById,
  updateEvaluationSheet,
  deleteEvaluationSheet,
  downloadEvaluationTemplate,
} = require("../controllers/evaluationController");
const middleware = require("../middlewares/middleware");
const { excelUploadOne } = require("../middlewares/upload");

const router = express.Router();

// นำเข้าไฟล์ Excel เพื่อบันทึกคะแนนแบบประเมิน
/**
 * =========================
 * Evaluations
 * =========================
 */

/**
 * @openapi
 * /api/evaluations/import:
 *   post:
 *     summary: Import evaluation scores from Excel
 *     tags: [Evaluations]
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
 */
router.post(
  "/evaluations/import",
  middleware.verifyToken,
  excelUploadOne,
  importEvaluationExcel
);

/**
 * @openapi
 * /api/evaluations:
 *   get:
 *     summary: List evaluation sheets
 *     tags: [Evaluations]
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
 */
router.get(
  "/evaluations",
  middleware.verifyToken,
  listEvaluationSheets
);

/**
 * @openapi
 * /api/evaluations/{id}:
 *   get:
 *     summary: Get evaluation sheet by id
 *     tags: [Evaluations]
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
 *         description: Sheet returned
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.get(
  "/evaluations/:id",
  middleware.verifyToken,
  getEvaluationSheetById
);

/**
 * @openapi
 * /api/evaluations/{id}:
 *   put:
 *     summary: Update evaluation sheet
 *     tags: [Evaluations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.put(
  "/evaluations/:id",
  middleware.verifyToken,
  updateEvaluationSheet
);

/**
 * @openapi
 * /api/evaluations/{id}:
 *   delete:
 *     summary: Delete evaluation sheet
 *     tags: [Evaluations]
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
 *       404:
 *         description: Not found
 */
router.delete(
  "/evaluations/:id",
  middleware.verifyToken,
  deleteEvaluationSheet
);

/**
 * @openapi
 * /api/evaluations/template/download:
 *   get:
 *     summary: Download evaluation Excel template
 *     tags: [Evaluations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Template file
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/evaluations/template/download",
  middleware.verifyToken,
  downloadEvaluationTemplate
);

module.exports = router;
