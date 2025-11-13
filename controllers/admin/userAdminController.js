const User = require("../../models/userModel");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const {
  buildUserAvatarFilename,
  tryPickupLocalFileFromBody,
} = require("../../utils/avatar");

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
    const { page, pageSize, search, role } = req.query || {};
    const result = await User.listUsers({ page, pageSize, search, role });
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

// Admin: list only STUDENT
const adminGetAllStudents = async (req, res) => {
  try {
    const { page, pageSize, search } = req.query || {};
    const result = await User.listUsers({ page, pageSize, search, role: "STUDENT" });
    const totalPages = Math.ceil(result.total / result.pageSize) || 1;
    res.json({ data: result.items, page: result.page, pageSize: result.pageSize, total: result.total, totalPages });
  } catch (err) {
    res.status(500).json({ message: "Error fetching students" });
  }
};

// Admin: list only TEACHER
const adminGetAllTeachers = async (req, res) => {
  try {
    const { page, pageSize, search } = req.query || {};
    const result = await User.listUsers({ page, pageSize, search, role: "TEACHER" });
    const totalPages = Math.ceil(result.total / result.pageSize) || 1;
    res.json({ data: result.items, page: result.page, pageSize: result.pageSize, total: result.total, totalPages });
  } catch (err) {
    res.status(500).json({ message: "Error fetching teachers" });
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

const buildRoleDetailGetter =
  ({ expectRole, roleLabel, errorMessage }) =>
  async (req, res) => {
    const targetId = req.params && req.params.id;
    if (!targetId) {
      return res.status(400).json({ message: "ต้องระบุ id ผู้ใช้ใน URL" });
    }
    try {
      const user = await User.getUserById(targetId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.role !== expectRole) {
        return res.status(400).json({ message: errorMessage });
      }
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: `Error fetching ${roleLabel}` });
    }
  };

const adminGetTeacherById = buildRoleDetailGetter({
  expectRole: "TEACHER",
  roleLabel: "teacher",
  errorMessage: "ผู้ใช้นี้ไม่ได้มีบทบาทครูผู้สอน",
});

const adminGetStudentById = buildRoleDetailGetter({
  expectRole: "STUDENT",
  roleLabel: "student",
  errorMessage: "ผู้ใช้นี้ไม่ได้มีบทบาทนักเรียน",
});

const adminCreateUser = async (req, res) => {
  try {
    const created = await User.createUser(req.body);
    const user = await User.getUserById(created.id);
    res.status(201).json(user);
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "P2002") {
      return res
        .status(409)
        .json({ message: "ข้อมูลซ้ำ (username/email/phone)" });
    }
    res.status(500).json({ message: "Error creating user" });
  }
};

const adminDeactivateUser = async (req, res) => {
  const targetId = req.params && req.params.id;
  if (!targetId)
    return res.status(400).json({ message: "ต้องระบุ id ผู้ใช้ใน URL" });
  const idNum = Number(targetId);
  if (!Number.isInteger(idNum))
    return res.status(400).json({ message: "id ต้องเป็นจำนวนเต็ม" });
  try {
    const user = await User.deactivateUser(idNum);
    res.json({ message: "ปิดการใช้งานผู้ใช้สำเร็จ", user });
  } catch (err) {
    if (err.code === "P2025")
      return res.status(404).json({ message: "User not found" });
    res.status(500).json({ message: "Error deactivating user" });
  }
};

const adminActivateUser = async (req, res) => {
  const targetId = req.params && req.params.id;
  if (!targetId)
    return res.status(400).json({ message: "ต้องระบุ id ผู้ใช้ใน URL" });
  const idNum = Number(targetId);
  if (!Number.isInteger(idNum))
    return res.status(400).json({ message: "id ต้องเป็นจำนวนเต็ม" });
  try {
    const user = await User.activateUser(idNum);
    res.json({ message: "เปิดการใช้งานผู้ใช้สำเร็จ", user });
  } catch (err) {
    if (err.code === "P2025")
      return res.status(404).json({ message: "User not found" });
    res.status(500).json({ message: "Error activating user" });
  }
};

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
        const uploadsDir = path.join(__dirname, "..", "..", "uploads", "avatars");
        if (!fs.existsSync(uploadsDir))
          fs.mkdirSync(uploadsDir, { recursive: true });
        const ext = path.extname(localPath).toLowerCase();
        filenameOnDisk = buildUserAvatarFilename(idNum, ext);
        fs.copyFileSync(localPath, path.join(uploadsDir, filenameOnDisk));
      }
    }
    if (!filenameOnDisk) {
      return res
        .status(400)
        .json({ message: "ไม่พบไฟล์ที่อัปโหลด (ฟิลด์ 'avatar')" });
    }
    const exists = await User.getUserById(idNum);
    if (!exists) {
      try {
        const p = path.join(
          __dirname,
          "..",
          "..",
          "uploads",
          "avatars",
          filenameOnDisk
        );
        fs.existsSync(p) && fs.unlinkSync(p);
      } catch {}
      return res.status(404).json({ message: "User not found" });
    }

    const publicPath = `/uploads/avatars/${filenameOnDisk}`;
    const updated = await User.setUserAvatar(idNum, publicPath);
    if (exists.avatar && exists.avatar !== publicPath) {
      const oldFile = path.join(
        __dirname,
        "..",
        "..",
        exists.avatar.replace(/^\//, "")
      );
      try {
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      } catch {}
    }
    res.status(200).json({
      message: "อัปโหลดรูปโปรไฟล์ผู้ใช้สำเร็จ",
      avatar: publicPath,
      user: updated,
    });
  } catch (err) {
    try {
      if (req.file && req.file.filename) {
        const p = path.join(
          __dirname,
          "..",
          "..",
          "uploads",
          "avatars",
          req.file.filename
        );
        fs.existsSync(p) && fs.unlinkSync(p);
      }
    } catch {}
    if (err.code === "P2025") {
      return res.status(404).json({ message: "User not found" });
    }
    res
      .status(500)
      .json({ message: "Error uploading avatar", detail: err.message });
  }
};

module.exports = {
  adminUpdateUser,
  adminGetAllUsers,
  adminGetAllStudents,
  adminGetAllTeachers,
  adminGetTeacherById,
  adminGetStudentById,
  adminGetUserById,
  adminCreateUser,
  adminDeactivateUser,
  adminActivateUser,
  adminUploadAvatar,
};
