const express = require("express");
const {
    createNews,
    getAllNews,
    getNewsForHome,
    getNewsById,
    updateNews,
    deleteNews,
} = require("../controllers/newsController");

const { uploadNewsImage } = require("../middlewares/uploadNewsImage");
const middleware = require("../middlewares/middleware");

const router = express.Router();

// สร้างข่าว (หลังบ้าน)
// ตัวอย่าง: ใช้ auth ถ้าต้องการ
// router.post("/admin/news", protect, restrictTo("ADMIN", "OWNER"), ...)

/**
 * =========================
 * News
 * =========================
 */

/**
 * @openapi
 * /api/admin/news:
 *   post:
 *     summary: Create news (admin)
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
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
  "/admin/news",
  // protect,
  middleware.verifyToken,
  middleware.authorizeNewsManager,
  uploadNewsImage.single("image"), // ชื่อ field รูปต้องตรงกับ frontend
  createNews
);

// ดึงข่าวทั้งหมด (admin ดู/จัดการ)
/**
 * @openapi
 * /api/admin/news:
 *   get:
 *     summary: List all news (admin)
 *     tags: [News]
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
  "/admin/news",
  middleware.verifyToken,
  middleware.authorizeNewsManager,
  getAllNews
);

// แก้ไขข่าว
/**
 * @openapi
 * /api/admin/news/{id}:
 *   put:
 *     summary: Update news (admin)
 *     tags: [News]
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
 *               image:
 *                 type: string
 *                 format: binary
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
  "/admin/news/:id",
  // protect,
  middleware.verifyToken,
  middleware.authorizeNewsManager,
  uploadNewsImage.single("image"), // รองรับแก้รูปด้วย
  updateNews
);

// ลบข่าว
/**
 * @openapi
 * /api/admin/news/{id}:
 *   delete:
 *     summary: Delete news (admin)
 *     tags: [News]
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
  "/admin/news/:id",
  // protect,
  middleware.verifyToken,
  middleware.authorizeNewsManager,
  deleteNews
);

// ดึงข่าวไว้แสดงหน้า Home
/**
 * @openapi
 * /api/news/home:
 *   get:
 *     summary: Get news for home page (public)
 *     tags: [News]
 *     security: []
 *     responses:
 *       200:
 *         description: Home news returned
 */
router.get("/news/home", getNewsForHome);

// ดึงรายละเอียดข่าว
/**
 * @openapi
 * /api/news/{id}:
 *   get:
 *     summary: Get news by id (public)
 *     tags: [News]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: News returned
 *       404:
 *         description: Not found
 */
router.get("/news/:id", getNewsById);

module.exports = router;
