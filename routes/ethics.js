const express = require("express");
const middleware = require("../middlewares/middleware");
const { excelUploadOne } = require("../middlewares/upload");
const ethicsController = require("../controllers/ethicsController");

const router = express.Router();

/**
 * =========================
 * Ethics Assessments
 * =========================
 */

/**
 * @openapi
 * /api/ethics-assessments/import:
 *   post:
 *     summary: Import ethics assessments from Excel
 *     tags: [Ethics Assessments]
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
 *         description: Import success
 *       400:
 *         description: Invalid file or data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  "/ethics-assessments/import",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  excelUploadOne,
  ethicsController.importEthicsAssessments
);

/**
 * @openapi
 * /api/ethics-assessments:
 *   get:
 *     summary: List ethics assessments
 *     tags: [Ethics Assessments]
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
  "/ethics-assessments",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  ethicsController.listEthicsAssessments
);

/**
 * @openapi
 * /api/ethics-assessments/summary:
 *   get:
 *     summary: Summarize ethics assessments
 *     tags: [Ethics Assessments]
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
  "/ethics-assessments/summary",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  ethicsController.summarizeEthicsAssessments
);

/**
 * @openapi
 * /api/ethics-assessments/{id}:
 *   delete:
 *     summary: Delete ethics assessment by id
 *     tags: [Ethics Assessments]
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
  "/ethics-assessments/:id",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  ethicsController.deleteEthicsAssessmentById
);

/**
 * @openapi
 * /api/ethics-assessments:
 *   delete:
 *     summary: Delete all ethics assessments
 *     tags: [Ethics Assessments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deleted all
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete(
  "/ethics-assessments",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  ethicsController.deleteAllEthicsAssessments
);

module.exports = router;
