const express = require("express");
const middleware = require("../middlewares/middleware");
const { excelUploadOne } = require("../middlewares/upload");
const personalMeritController = require("../controllers/personalMeritController");

const router = express.Router();

/**
 * =========================
 * Personal Merit Scores
 * =========================
 */

/**
 * @openapi
 * /api/personal-merit-scores/import:
 *   post:
 *     summary: Import personal merit scores from Excel
 *     tags: [Personal Merit Scores]
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
  "/personal-merit-scores/import",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  excelUploadOne,
  personalMeritController.importPersonalMeritScores
);

/**
 * @openapi
 * /api/personal-merit-scores:
 *   get:
 *     summary: List personal merit scores
 *     tags: [Personal Merit Scores]
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
  "/personal-merit-scores",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  personalMeritController.listPersonalMeritScores
);

/**
 * @openapi
 * /api/personal-merit-scores/overview:
 *   get:
 *     summary: Personal merit scores overview
 *     tags: [Personal Merit Scores]
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
  "/personal-merit-scores/overview",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  personalMeritController.getPersonalMeritScoresOverview
);

/**
 * @openapi
 * /api/personal-merit-scores/{id}:
 *   delete:
 *     summary: Delete personal merit score by id
 *     tags: [Personal Merit Scores]
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
  "/personal-merit-scores/:id",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  personalMeritController.deletePersonalMeritScoreById
);

/**
 * @openapi
 * /api/personal-merit-scores:
 *   delete:
 *     summary: Delete all personal merit scores
 *     tags: [Personal Merit Scores]
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
  "/personal-merit-scores",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  personalMeritController.deleteAllPersonalMeritScores
);

module.exports = router;
