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

router.post(
  "/admin/news",
  // protect,
  middleware.verifyToken,
  middleware.authorizeAdmin,
  uploadNewsImage.single("image"), // ชื่อ field รูปต้องตรงกับ frontend
  createNews
);

// ดึงข่าวทั้งหมด (admin ดู/จัดการ)
router.get(
  "/admin/news",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  getAllNews
);

// แก้ไขข่าว
router.put(
  "/admin/news/:id",
  // protect,
  middleware.verifyToken,
  middleware.authorizeAdmin,
  uploadNewsImage.single("image"), // รองรับแก้รูปด้วย
  updateNews
);

// ลบข่าว
router.delete(
  "/admin/news/:id",
  // protect,
  middleware.verifyToken,
  middleware.authorizeAdmin,
  deleteNews
);

// ดึงข่าวไว้แสดงหน้า Home
router.get("/news/home", getNewsForHome);

// ดึงรายละเอียดข่าว
router.get("/news/:id", getNewsById);

module.exports = router;
