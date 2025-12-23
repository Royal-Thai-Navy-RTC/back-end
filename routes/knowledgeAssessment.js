const express = require("express");
const middleware = require("../middlewares/middleware");
const { excelUploadOne } = require("../middlewares/upload");
const knowledgeAssessmentController = require("../controllers/knowledgeAssessmentController");

const router = express.Router();

/**
 * =========================
 * Knowledge Assessments
 * =========================
 */

/**
 * @openapi
 * /api/knowledge-assessments/import:
 *   post:
 *     summary: Import knowledge assessments from Excel
 *     tags: [Knowledge Assessments]
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
  "/knowledge-assessments/import",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  excelUploadOne,
  knowledgeAssessmentController.importKnowledgeAssessments
);

/**
 * @openapi
 * /api/knowledge-assessments:
 *   get:
 *     summary: List knowledge assessments
 *     tags: [Knowledge Assessments]
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
  "/knowledge-assessments",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  knowledgeAssessmentController.listKnowledgeAssessments
);

/**
 * @openapi
 * /api/knowledge-assessments/overview:
 *   get:
 *     summary: Knowledge assessments overview
 *     tags: [Knowledge Assessments]
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
  "/knowledge-assessments/overview",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  knowledgeAssessmentController.getKnowledgeAssessmentsOverview
);

/**
 * @openapi
 * /api/knowledge-assessments/summary:
 *   get:
 *     summary: Summarize knowledge assessments
 *     tags: [Knowledge Assessments]
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
  "/knowledge-assessments/summary",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  knowledgeAssessmentController.summarizeKnowledgeAssessments
);

/**
 * @openapi
 * /api/knowledge-assessments/{id}:
 *   delete:
 *     summary: Delete knowledge assessment by id
 *     tags: [Knowledge Assessments]
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
  "/knowledge-assessments/:id",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  knowledgeAssessmentController.deleteKnowledgeAssessmentById
);

/**
 * @openapi
 * /api/knowledge-assessments:
 *   delete:
 *     summary: Delete all knowledge assessments
 *     tags: [Knowledge Assessments]
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
  "/knowledge-assessments",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  knowledgeAssessmentController.deleteAllKnowledgeAssessments
);

module.exports = router;
