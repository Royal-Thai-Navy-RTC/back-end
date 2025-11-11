const express = require("express"); // เรียกใช้งาน express
const authController = require("./controllers/authController"); // เรียกใช้งาน authController.js ที่เราสร้างไว้
const userController = require("./controllers/userController");
const middleware = require("./middlewares/middleware"); // เรียกใช้งาน middleware.js ที่เราสร้างไว้
const { avatarUploadOne } = require("./middlewares/upload");

const router = express.Router(); // สร้าง instance ของ express.Router

router.post("/register", authController.register); // สร้างเส้นทางสำหรับการลงทะเบียนผู้ใช้
router.post("/login", authController.login); // สร้างเส้นทางสำหรับการเข้าสู่ระบบ

// Protected route example
// เส้นทางแอดมินสำหรับแก้ไขข้อมูลผู้ใช้อื่น (RESTful)
router.put(
  "/admin/users/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  userController.adminUpdateUser
);

// แอดมินดึงผู้ใช้ทั้งหมด (รองรับค้นหา/แบ่งหน้า)
router.get(
  "/admin/users",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  userController.adminGetAllUsers
);

// แอดมินดึงข้อมูลผู้ใช้ตาม id
router.get(
  "/admin/users/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  userController.adminGetUserById
);

// แอดมินอัปโหลด avatar ให้ผู้ใช้อื่น
router.post(
  "/admin/users/:id/avatar",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  avatarUploadOne,
  userController.adminUploadAvatar
);

// Profile routes (ต้องล็อกอิน)
router.get("/me", middleware.verifyToken, userController.getMe);
router.put("/me", middleware.verifyToken, userController.updateMe);
router.post(
  "/me/avatar",
  middleware.verifyToken,
  avatarUploadOne,
  userController.uploadAvatar
);

module.exports = router;
