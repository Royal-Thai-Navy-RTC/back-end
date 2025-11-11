const jwt = require("jsonwebtoken"); // เรียกใช้งาน jwt เพื่อใช้ในการสร้าง token
const bcrypt = require("bcryptjs"); // เรียกใช้งาน bcryptjs เพื่อใช้ในการเข้ารหัสรหัสผ่าน
const config = require("../config"); // เรียกใช้งานไฟล์ config.js ที่เราสร้างไว้
const User = require("../models/userModel"); // เรียกใช้งาน userModel.js ที่เราสร้างไว้

const register = async (req, res) => {
  // ต้องการ field ให้ครบตาม schema.prisma
  const {
    username,
    password,
    firstName,
    lastName,
    birthDate,
    fullAddress,
    email,
    phone,
    emergencyContactName,
    emergencyContactPhone,
    // optional
    role,
    rank,
    education,
    position,
    medicalHistory,
    avatar,
    isActive,
  } = req.body;

  try {
    await User.createUser({
      username,
      password,
      firstName,
      lastName,
      birthDate,
      fullAddress,
      email,
      phone,
      emergencyContactName,
      emergencyContactPhone,
      role,
      rank,
      education,
      position,
      medicalHistory,
      avatar,
      isActive,
    });
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    // Prisma unique constraint หรือ validation อื่น ๆ
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "P2002") {
      // P2002: Unique constraint failed
      return res.status(409).json({ message: "ข้อมูล (username/email/phone) ซ้ำในระบบ" });
    }
    res.status(500).json({ message: "Error registering user" });
  }
};

const login = async (req, res) => {
  const { username, password } = req.body; // รับข้อมูล username และ password จาก body ของ request
  try {
    const user = await User.findUserByUsername(username); // ค้นหาผู้ใช้จากชื่อผู้ใช้
    if (!user) {
      // หากไม่พบผู้ใช้
      return res.status(401).json({ message: "Invalid username or password" });
    }
    // หากรหัสผ่านไม่ตรงกับที่เก็บไว้ในฐานข้อมูล
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid username or password" });
    }
    // สร้าง token และส่งกลับไปให้ผู้ใช้
    const token = jwt.sign({ id: user.id }, config.jwtSecret, {
      expiresIn: "1h",
    });
    res.json({ token });
  } catch (err) {
    // หากเกิดข้อผิดพลาดในการเข้าสู่ระบบ
    res.status(500).json({ message: "Error logging in" });
  }
};

module.exports = {
  register,
  login,
};
