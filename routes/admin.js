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

router.delete(
  "/admin/users/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  adminUser.adminDeleteUser
);

module.exports = router;

