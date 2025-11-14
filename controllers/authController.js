const jwt = require("jsonwebtoken"); // เรียกใช้งาน jwt เพื่อใช้ในการสร้าง token
const bcrypt = require("bcryptjs"); // เรียกใช้งาน bcryptjs เพื่อใช้ในการเข้ารหัสรหัสผ่าน
const config = require("../config"); // เรียกใช้งานไฟล์ config.js ที่เราสร้างไว้
const User = require("../models/userModel"); // เรียกใช้งาน userModel.js ที่เราสร้างไว้

const register = async (req, res) => {
  const {
    username,
    password,
    firstName,
    lastName,
    email,
    phone,
    rank,
    profileImage,
    birthDate,
    fullAddress,
    emergencyContactName,
    emergencyContactPhone,
    role,
    education,
    position,
    medicalHistory,
    avatar,
    isActive,
  } = req.body;

  const requiredFields = [
    { key: "username", value: username },
    { key: "password", value: password },
    { key: "firstName", value: firstName },
    { key: "lastName", value: lastName },
    { key: "email", value: email },
    { key: "phone", value: phone },
    { key: "rank", value: rank },
  ];
  const missing = requiredFields
    .filter(({ value }) => value === undefined || value === null || value === "")
    .map(({ key }) => key);
  if (!profileImage && !avatar) {
    missing.push("profileImage");
  }
  if (missing.length) {
    return res
      .status(400)
      .json({ message: `ข้อมูลไม่ครบถ้วน: ต้องมี ${missing.join(", ")}` });
  }

  try {
    await User.createUser({
      username,
      password,
      firstName,
      lastName,
      email,
      phone,
      rank,
      profileImage,
      birthDate,
      fullAddress,
      emergencyContactName,
      emergencyContactPhone,
      role,
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
      return res
        .status(409)
        .json({ message: "ข้อมูล (username/email/phone) ซ้ำในระบบ" });
    }
    console.error("Register error:", err);
    res
      .status(500)
      .json({ message: "Error registering user", detail: err.message });
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
    // บล็อกผู้ใช้ที่ถูกปิดการใช้งานไม่ให้เข้าสู่ระบบ
    if (user.isActive === false) {
      return res.status(403).json({ message: "บัญชีผู้ใช้นี้ถูกปิดการใช้งาน" });
    }
  // สร้าง token และส่งกลับไปให้ผู้ใช้ (ใส่ role ไปด้วย)
  const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: "24h",
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
