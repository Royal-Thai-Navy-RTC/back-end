const jwt = require("jsonwebtoken"); // เรียกใช้งาน jwt เพื่อใช้ในการตรวจสอบ token
const config = require("../config"); // เรียกใช้งานไฟล์ config.js ที่เราสร้างไว้
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// next คือ callback function ที่ใช้ในการส่งต่อไปยัง middleware ถัดไป
const verifyToken = (req, res, next) => {
  // middleware สำหรับตรวจสอบ token
  let token = req.headers["authorization"]; // รับ token จาก header ของ request
  if (!token) return res.status(403).json({ message: "No token provided" });
  // รองรับทั้งรูปแบบ "<token>" และ "Bearer <token>"
  if (typeof token === "string" && token.toLowerCase().startsWith("bearer ")) {
    token = token.slice(7).trim();
  }

  jwt.verify(token, config.jwtSecret, (err, decoded) => {
    // ตรวจสอบ token
    if (err)
      return res.status(500).json({ message: "Failed to authenticate token" }); // หากไม่สามารถตรวจสอบ token ได้ให้ส่งข้อความกลับไปว่าไม่สามารถตรวจสอบ token ได้

    req.userId = decoded.id; // ถ้าตรวจสอบ token สำเร็จ ให้เก็บ id ของผู้ใช้ไว้ใน req.userId
    if (decoded.role) req.userRole = decoded.role; // แนบ role จาก token (ถ้ามี)
    next(); // ส่งต่อไปยัง middleware ถัดไป
  });
};

module.exports = {
  verifyToken,
  // ตรวจสอบสิทธิ์เฉพาะแอดมิน
  authorizeAdmin: async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: Number(req.userId) },
        select: { id: true, role: true, isActive: true },
      });
      if (!user || user.isActive === false) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (user.role !== "ADMIN") {
        return res.status(403).json({ message: "Admin only" });
      }
      next();
    } catch (e) {
      return res.status(500).json({ message: "Authorization error" });
    }
  },
  authorizeDepartmentHead: async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: Number(req.userId) },
        select: { id: true, role: true, isActive: true },
      });
      if (!user || user.isActive === false) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (user.role !== "DEPARTMENT_HEAD") {
        return res.status(403).json({ message: "Department head only" });
      }
      next();
    } catch (e) {
      return res.status(500).json({ message: "Authorization error" });
    }
  },
  authorizeTeacher: async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: Number(req.userId) },
        select: { id: true, role: true, isActive: true },
      });
      if (!user || user.isActive === false) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (user.role !== "TEACHER") {
        return res.status(403).json({ message: "Teacher only" });
      }
      next();
    } catch (e) {
      return res.status(500).json({ message: "Authorization error" });
    }
  },
};
