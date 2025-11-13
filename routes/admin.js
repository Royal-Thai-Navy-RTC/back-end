const express = require("express");
const middleware = require("../middlewares/middleware");
const { avatarUploadOne } = require("../middlewares/upload");
const adminUser = require("../controllers/admin/userAdminController");

const router = express.Router();

// Admin: users management
router.put(
  "/admin/users/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminUpdateUser
);

router.get(
  "/admin/users",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminGetAllUsers
);

// Admin: list students only
router.get(
  "/admin/users/students",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminGetAllStudents
);

// Admin: list teachers only
router.get(
  "/admin/users/teachers",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminGetAllTeachers
);

router.get(
  "/admin/users/students/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminGetStudentById
);

router.get(
  "/admin/users/teachers/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminGetTeacherById
);

router.post(
  "/admin/users",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminCreateUser
);

router.get(
  "/admin/users/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminGetUserById
);

router.post(
  "/admin/users/:id/avatar",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  avatarUploadOne,
  adminUser.adminUploadAvatar
);

// Deactivate (soft delete) user
router.delete(
  "/admin/users/deactivate/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminDeactivateUser
);

// Activate user
router.patch(
  "/admin/users/activate/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminActivateUser
);

module.exports = router;
