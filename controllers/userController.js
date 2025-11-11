const User = require("../models/userModel");
const bcrypt = require("bcryptjs");

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
      return res.status(409).json({ message: "ข้อมูล (email/phone) ซ้ำในระบบ" });
    }
    res.status(500).json({ message: "Error updating profile" });
  }
};

const adminUpdateUser = async (req, res) => {
  const targetId = req.params && req.params.id;
  if (!targetId) {
    return res.status(400).json({ message: "ต้องระบุ id ผู้ใช้ใน URL (/admin/users/:id)" });
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
      return res.status(409).json({ message: "ข้อมูลซ้ำ (username/email/phone)" });
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
  if (!targetId) return res.status(400).json({ message: "ต้องระบุ id ผู้ใช้ใน URL" });
  try {
    const user = await User.getUserById(targetId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Error fetching user" });
  }
};

module.exports = { getMe, updateMe, adminUpdateUser, adminGetAllUsers, adminGetUserById };
