const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

// helper: สร้างชื่อไฟล์ปลายทางตาม user id
const buildUserAvatarFilename = (userId, srcExt) => {
  const ext = String(srcExt || "").toLowerCase();
  const normalized = ext === ".jpeg" ? ".jpg" : ext;
  return `user-${userId}${normalized}`;
};

// helper: พยายามอ่านไฟล์จาก path ที่ถูกส่งมาใน body (กรณี client ส่งเป็นสตริงพาธแทนไฟล์)
const tryPickupLocalFileFromBody = (body) => {
  if (!body) return null;
  const keys = ["avatar", "file", "image", "photo", "picture"]; 
  for (const k of keys) {
    if (typeof body[k] === "string" && body[k].trim() !== "") {
      let p = body[k].trim();
      if (p.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1);
      // แก้กรณีขึ้นต้นด้วย /C:/...
      if (p.startsWith("/") && /^[A-Za-z]:/.test(p.slice(1))) {
        p = p.slice(1);
      }
      // รองรับทั้ง \ และ /
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
};

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

const adminUpdateUser = async (req, res) => {
  const targetId = req.params && req.params.id;
  if (!targetId) {
    return res
      .status(400)
      .json({ message: "ต้องระบุ id ผู้ใช้ใน URL (/admin/users/:id)" });
  }
  try {
    const input = { ...req.body };
    if (input.password) {
      input.passwordHash = await bcrypt.hash(String(input.password), 10);
      delete input.password;
    }
    const updated = await User.updateUserByAdmin(targetId, input);
    res.json(updated);
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "P2002") {
      return res
        .status(409)
        .json({ message: "ข้อมูลซ้ำ (username/email/phone)" });
    }
    res.status(500).json({ message: "Error updating user" });
  }
};

const adminGetAllUsers = async (req, res) => {
  try {
    const { page, pageSize, search } = req.query || {};
    const result = await User.listUsers({ page, pageSize, search });
    const totalPages = Math.ceil(result.total / result.pageSize) || 1;
    res.json({
      data: result.items,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages,
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching users" });
  }
};

const adminGetUserById = async (req, res) => {
  const targetId = req.params && req.params.id;
  if (!targetId)
    return res.status(400).json({ message: "ต้องระบุ id ผู้ใช้ใน URL" });
  try {
    const user = await User.getUserById(targetId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Error fetching user" });
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
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        const ext = path.extname(localPath).toLowerCase();
        filenameOnDisk = buildUserAvatarFilename(req.userId, ext);
        fs.copyFileSync(localPath, path.join(uploadsDir, filenameOnDisk));
      }
    }
    if (!filenameOnDisk) {
      return res.status(400).json({ message: "ไม่พบไฟล์ที่อัปโหลด (ฟิลด์ 'avatar')" });
    }
    // เก็บ path เก่าก่อน เพื่อใช้ลบทิ้งหากชื่อไฟล์เปลี่ยน
    const before = await User.getUserById(req.userId);
    const oldPath = before && before.avatar;
    const publicPath = `/uploads/avatars/${filenameOnDisk}`;
    const updated = await User.updateUserSelf(req.userId, { avatar: publicPath });
    // หากชื่อไฟล์เปลี่ยน ให้ลบไฟล์เดิม
    if (oldPath && oldPath !== publicPath) {
      const oldFile = path.join(__dirname, "..", oldPath.replace(/^\//, ""));
      try { if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile); } catch {}
    }
    res.status(200).json({ message: "อัปโหลดรูปโปรไฟล์สำเร็จ", avatar: publicPath, profile: updated });
  } catch (err) {
    // ลบไฟล์ที่เพิ่งอัปโหลดหาก DB อัปเดตไม่สำเร็จ
    try {
      if (req.file && req.file.filename) {
        const p = path.join(__dirname, "..", "uploads", "avatars", req.file.filename);
        fs.existsSync(p) && fs.unlinkSync(p);
      }
    } catch {}
    res.status(500).json({ message: "Error uploading avatar", detail: err.message });
  }
};

// แอดมินอัปโหลด/เปลี่ยน avatar ให้ผู้ใช้อื่น
const adminUploadAvatar = async (req, res) => {
  const targetId = req.params && req.params.id;
  if (!targetId)
    return res.status(400).json({ message: "ต้องระบุ id ผู้ใช้ใน URL" });
  const idNum = Number(targetId);
  if (!Number.isInteger(idNum)) {
    return res.status(400).json({ message: "id ต้องเป็นจำนวนเต็ม" });
  }
  try {
    let filenameOnDisk = req.file && req.file.filename;
    if (!filenameOnDisk) {
      const localPath = tryPickupLocalFileFromBody(req.body);
      if (localPath) {
        const uploadsDir = path.join(__dirname, "..", "uploads", "avatars");
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        const ext = path.extname(localPath).toLowerCase();
        filenameOnDisk = buildUserAvatarFilename(idNum, ext);
        fs.copyFileSync(localPath, path.join(uploadsDir, filenameOnDisk));
      }
    }
    if (!filenameOnDisk) {
      return res.status(400).json({ message: "ไม่พบไฟล์ที่อัปโหลด (ฟิลด์ 'avatar')" });
    }
    // ตรวจว่าผู้ใช้มีอยู่จริงก่อน และจำ path เก่า
    const exists = await User.getUserById(idNum);
    if (!exists) {
      try {
        const p = path.join(__dirname, "..", "uploads", "avatars", filenameOnDisk);
        fs.existsSync(p) && fs.unlinkSync(p);
      } catch {}
      return res.status(404).json({ message: "User not found" });
    }

    const publicPath = `/uploads/avatars/${filenameOnDisk}`;
    const updated = await User.setUserAvatar(idNum, publicPath);
    // ลบไฟล์เก่าหากชื่อเปลี่ยน
    if (exists.avatar && exists.avatar !== publicPath) {
      const oldFile = path.join(__dirname, "..", exists.avatar.replace(/^\//, ""));
      try { if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile); } catch {}
    }
    res.status(200).json({
      message: "อัปโหลดรูปโปรไฟล์ผู้ใช้สำเร็จ",
      avatar: publicPath,
      user: updated,
    });
  } catch (err) {
    // ลบไฟล์ที่เพิ่งอัปโหลดหาก DB อัปเดตไม่สำเร็จ
    try {
      if (req.file && req.file.filename) {
        const p = path.join(__dirname, "..", "uploads", "avatars", req.file.filename);
        fs.existsSync(p) && fs.unlinkSync(p);
      }
    } catch {}
    if (err.code === "P2025") {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(500).json({ message: "Error uploading avatar", detail: err.message });
  }
};

module.exports = {
  getMe,
  updateMe,
  adminUpdateUser,
  adminGetAllUsers,
  adminGetUserById,
  uploadAvatar,
  adminUploadAvatar,
};
