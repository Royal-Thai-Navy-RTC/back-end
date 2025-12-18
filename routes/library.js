const express = require("express");
const middleware = require("../middlewares/middleware");
const { libraryUploadOne } = require("../middlewares/upload");
const libraryController = require("../controllers/libraryController");

const router = express.Router();

// Public listing
/**
 * =========================
 * Library
 * =========================
 */

/**
 * @openapi
 * /api/library:
 *   get:
 *     summary: List library items (public)
 *     tags: [Library]
 *     security: []
 *     responses:
 *       200:
 *         description: List returned
 */
router.get("/library", libraryController.listLibraryItems);

// Admin/Owner only
/**
 * @openapi
 * /api/library:
 *   post:
 *     summary: Create library item (admin)
 *     tags: [Library]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Invalid input or file
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  "/library",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  libraryUploadOne,
  libraryController.createLibraryItem
);

/**
 * @openapi
 * /api/library/{id}:
 *   put:
 *     summary: Update library item (admin)
 *     tags: [Library]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         description: Invalid input or file
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.put(
  "/library/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  libraryUploadOne,
  libraryController.updateLibraryItem
);

/**
 * @openapi
 * /api/library/{id}:
 *   delete:
 *     summary: Delete library item (admin)
 *     tags: [Library]
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
  "/library/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  libraryController.deleteLibraryItem
);

module.exports = router;
