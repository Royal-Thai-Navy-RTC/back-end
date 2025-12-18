const express = require("express");
const middleware = require("../middlewares/middleware");
const templateController = require("../controllers/studentEvaluationTemplateController");
const evaluationController = require("../controllers/studentEvaluationController");

const router = express.Router();

/**
 * =========================
 * Student Evaluation Templates
 * =========================
 */

// Template management (Admin only)

/**
 * @openapi
 * /api/admin/student-evaluation-templates:
 *   post:
 *     summary: Create student evaluation template
 *     tags: [Student Evaluation Templates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  "/admin/student-evaluation-templates",
  middleware.verifyToken,
  middleware.authorizeTemplateManager,
  templateController.createTemplate
);

/**
 * @openapi
 * /api/admin/student-evaluation-templates:
 *   get:
 *     summary: List student evaluation templates
 *     tags: [Student Evaluation Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List returned
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/admin/student-evaluation-templates",
  middleware.verifyToken,
  middleware.authorizeTemplateViewer,
  templateController.listTemplates
);

/**
 * @openapi
 * /api/admin/student-evaluation-templates/{id}:
 *   get:
 *     summary: Get student evaluation template by id
 *     tags: [Student Evaluation Templates]
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
 *         description: Template returned
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.get(
  "/admin/student-evaluation-templates/:id",
  middleware.verifyToken,
  middleware.authorizeTemplateManager,
  templateController.getTemplateById
);

/**
 * @openapi
 * /api/admin/student-evaluation-templates/{id}:
 *   put:
 *     summary: Update student evaluation template
 *     tags: [Student Evaluation Templates]
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
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.put(
  "/admin/student-evaluation-templates/:id",
  middleware.verifyToken,
  middleware.authorizeTemplateManager,
  templateController.updateTemplate
);

/**
 * @openapi
 * /api/admin/student-evaluation-templates/{id}:
 *   delete:
 *     summary: Delete student evaluation template
 *     tags: [Student Evaluation Templates]
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
  "/admin/student-evaluation-templates/:id",
  middleware.verifyToken,
  middleware.authorizeTemplateManager,
  templateController.deleteTemplate
);

/**
 * =========================
 * Student Evaluations
 * =========================
 */

// Student evaluation submissions (Admin or Teacher)

/**
 * @openapi
 * /api/student-evaluations:
 *   post:
 *     summary: Create student evaluation (admin or teacher)
 *     tags: [Student Evaluations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  "/student-evaluations",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  evaluationController.createEvaluation
);

/**
 * @openapi
 * /api/student-evaluations:
 *   get:
 *     summary: List student evaluations (admin or teacher)
 *     tags: [Student Evaluations]
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
  "/student-evaluations",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  evaluationController.listEvaluations
);

/**
 * @openapi
 * /api/student-evaluations/comparison:
 *   get:
 *     summary: Compare student evaluations (admin or teacher)
 *     tags: [Student Evaluations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Comparison result
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/student-evaluations/comparison",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  evaluationController.getEvaluationComparison
);

/**
 * @openapi
 * /api/student-evaluations/{id}:
 *   get:
 *     summary: Get student evaluation by id
 *     tags: [Student Evaluations]
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
 *         description: Evaluation returned
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.get(
  "/student-evaluations/:id",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  evaluationController.getEvaluationById
);

/**
 * @openapi
 * /api/student-evaluations/{id}:
 *   put:
 *     summary: Update student evaluation
 *     tags: [Student Evaluations]
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
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.put(
  "/student-evaluations/:id",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  evaluationController.updateEvaluation
);

/**
 * @openapi
 * /api/student-evaluations/{id}:
 *   delete:
 *     summary: Delete student evaluation
 *     tags: [Student Evaluations]
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
  "/student-evaluations/:id",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  evaluationController.deleteEvaluation
);

module.exports = router;
