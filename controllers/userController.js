const User = require("../models/userModel");
const fs = require("fs");
const path = require("path");
const {
  buildUserAvatarFilename,
  tryPickupLocalFileFromBody,
} = require("../utils/avatar");

const getMe = async (req, res) => {
  try {
    const me = await User.getUserById(req.userId);
    if (!me) return res.status(404).json({ message: "User not found" });
    res.json(me);
  } catch (err) {
    res.status(500).json({ message: "Error fetching profile" });
  }
};

const updateMe = async (req, res) => {
  try {
    const updated = await User.updateUserSelf(req.userId, req.body);
    res.json(updated);
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "P2002") {
      return res
        .status(409)
        .json({ message: "ข้อมูล (email/phone) ซ้ำในระบบ" });
    }
    res.status(500).json({ message: "Error updating profile" });
  }
};

// อัปโหลด/เปลี่ยน avatar ของตัวเอง
const uploadAvatar = async (req, res) => {
  try {
    let filenameOnDisk = req.file && req.file.filename;
    // fallback: ถ้าไม่มีไฟล์ใน multipart ให้ลองอ่านจาก path ที่ส่งมาเป็นสตริง
    if (!filenameOnDisk) {
      const localPath = tryPickupLocalFileFromBody(req.body);
      if (localPath) {
        const uploadsDir = path.join(__dirname, "..", "uploads", "avatars");
        if (!fs.existsSync(uploadsDir))
          fs.mkdirSync(uploadsDir, { recursive: true });
        const ext = path.extname(localPath).toLowerCase();
        filenameOnDisk = buildUserAvatarFilename(req.userId, ext);
        fs.copyFileSync(localPath, path.join(uploadsDir, filenameOnDisk));
      }
    }
    if (!filenameOnDisk) {
      return res
        .status(400)
        .json({ message: "ไม่พบไฟล์ที่อัปโหลด (ฟิลด์ 'avatar')" });
    }
    // เก็บ path เก่าก่อน เพื่อใช้ลบทิ้งหากชื่อไฟล์เปลี่ยน
    const before = await User.getUserById(req.userId);
    const oldPath = before && before.avatar;
    const publicPath = `/uploads/avatars/${filenameOnDisk}`;
    const updated = await User.updateUserSelf(req.userId, {
      avatar: publicPath,
    });
    // หากชื่อไฟล์เปลี่ยน ให้ลบไฟล์เดิม
    if (oldPath && oldPath !== publicPath) {
      const oldFile = path.join(__dirname, "..", oldPath.replace(/^\//, ""));
      try {
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      } catch {}
    }
    res
      .status(200)
      .json({
        message: "อัปโหลดรูปโปรไฟล์สำเร็จ",
        avatar: publicPath,
        profile: updated,
      });
  } catch (err) {
    // ลบไฟล์ที่เพิ่งอัปโหลดหาก DB อัปเดตไม่สำเร็จ
    try {
      if (req.file && req.file.filename) {
        const p = path.join(
          __dirname,
          "..",
          "uploads",
          "avatars",
          req.file.filename
        );
        fs.existsSync(p) && fs.unlinkSync(p);
      }
    } catch {}
    res
      .status(500)
      .json({ message: "Error uploading avatar", detail: err.message });
  }
};

const changeMyPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    await User.changePasswordSelf({
      id: req.userId,
      currentPassword,
      newPassword,
    });
    res.json({ message: "เปลี่ยนรหัสผ่านสำเร็จ" });
  } catch (err) {
    if (err.code === "VALIDATION_ERROR" || err.code === "INVALID_PASSWORD") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(500).json({
      message: "ไม่สามารถเปลี่ยนรหัสผ่านได้",
    });
  }
};

module.exports = {
  getMe,
  updateMe,
  changeMyPassword,
  uploadAvatar,
};
