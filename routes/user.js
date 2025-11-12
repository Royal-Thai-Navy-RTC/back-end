const express = require("express");
const userController = require("../controllers/userController");
const middleware = require("../middlewares/middleware");
const { avatarUploadOne } = require("../middlewares/upload");

const router = express.Router();

// Profile routes (must be logged in)
router.get("/me", middleware.verifyToken, userController.getMe);
router.put("/me", middleware.verifyToken, userController.updateMe);
router.post(
  "/me/avatar",
  middleware.verifyToken,
  avatarUploadOne,
  userController.uploadAvatar
);

module.exports = router;

