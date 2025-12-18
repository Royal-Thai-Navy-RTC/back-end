const express = require("express");
const middleware = require("../middlewares/middleware");
const { excelUploadOne } = require("../middlewares/upload");
const physicalAssessmentController = require("../controllers/physicalAssessmentController");

const router = express.Router();

/**
 * =========================
 * Physical Assessments
 * =========================
 */

/**
 * @openapi
 * /api/physical-assessments/import:
 *   post:
 *     summary: Import physical assessments from Excel
 *     tags: [Physical Assessments]
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
  "/physical-assessments/import",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  excelUploadOne,
  physicalAssessmentController.importPhysicalAssessments
);

/**
 * @openapi
 * /api/physical-assessments:
 *   get:
 *     summary: List physical assessments
 *     tags: [Physical Assessments]
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
  "/physical-assessments",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  physicalAssessmentController.listPhysicalAssessments
);

/**
 * @openapi
 * /api/physical-assessments/{id}:
 *   delete:
 *     summary: Delete physical assessment by id
 *     tags: [Physical Assessments]
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
  "/physical-assessments/:id",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  physicalAssessmentController.deletePhysicalAssessmentById
);

/**
 * @openapi
 * /api/physical-assessments:
 *   delete:
 *     summary: Delete all physical assessments
 *     tags: [Physical Assessments]
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
  "/physical-assessments",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  physicalAssessmentController.deleteAllPhysicalAssessments
);

module.exports = router;
