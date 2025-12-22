const express = require("express");
const middleware = require("../middlewares/middleware");
const { excelUploadOne } = require("../middlewares/upload");
const disciplineAssessmentController = require("../controllers/disciplineAssessmentController");

const router = express.Router();

/**
 * =========================
 * Discipline Assessments
 * =========================
 */

/**
 * @openapi
 * /api/discipline-assessments/import:
 *   post:
 *     summary: Import discipline assessments from Excel
 *     tags: [Discipline Assessments]
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
  "/discipline-assessments/import",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  excelUploadOne,
  disciplineAssessmentController.importDisciplineAssessments
);

/**
 * @openapi
 * /api/discipline-assessments:
 *   get:
 *     summary: List discipline assessments
 *     tags: [Discipline Assessments]
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
  "/discipline-assessments",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  disciplineAssessmentController.listDisciplineAssessments
);

/**
 * @openapi
 * /api/discipline-assessments/overview:
 *   get:
 *     summary: Discipline assessments overview
 *     tags: [Discipline Assessments]
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
  "/discipline-assessments/overview",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  disciplineAssessmentController.getDisciplineAssessmentsOverview
);

/**
 * @openapi
 * /api/discipline-assessments/summary:
 *   get:
 *     summary: Summarize discipline assessments
 *     tags: [Discipline Assessments]
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
  "/discipline-assessments/summary",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  disciplineAssessmentController.summarizeDisciplineAssessments
);

/**
 * @openapi
 * /api/discipline-assessments/{id}:
 *   delete:
 *     summary: Delete discipline assessment by id
 *     tags: [Discipline Assessments]
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
  "/discipline-assessments/:id",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  disciplineAssessmentController.deleteDisciplineAssessmentById
);

/**
 * @openapi
 * /api/discipline-assessments:
 *   delete:
 *     summary: Delete all discipline assessments
 *     tags: [Discipline Assessments]
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
  "/discipline-assessments",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  disciplineAssessmentController.deleteAllDisciplineAssessments
);

module.exports = router;
