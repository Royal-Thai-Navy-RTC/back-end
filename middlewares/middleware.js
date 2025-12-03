const jwt = require("jsonwebtoken"); // เรียกใช้งาน jwt เพื่อใช้ในการตรวจสอบ token
const rateLimit = require("express-rate-limit");
const config = require("../config"); // เรียกใช้งานไฟล์ config.js ที่เราสร้างไว้
const prisma = require("../utils/prisma");
const {
  loginBruteForceGuard,
} = require("../utils/loginAttemptLimiter");

const teacherRoleSet = new Set(["TEACHER", "SUB_ADMIN"]);
const adminRoleSet = new Set(["ADMIN", "OWNER"]);
const generalLeaveApproverRoleSet = new Set([
  ...adminRoleSet,
  "SUB_ADMIN",
]);

const normalizeRole = (role) =>
  typeof role === "string" ? role.trim().toUpperCase() : "";

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
    if (decoded.role) req.userRole = normalizeRole(decoded.role); // แนบ role จาก token (ถ้ามี)
    next(); // ส่งต่อไปยัง middleware ถัดไป
  });
};

const authRateLimiter = rateLimit({
  windowMs: config.authRateLimitWindowMs,
  max: config.authRateLimitMaxAttempts,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      message:
        "มีการพยายามเข้าสู่ระบบ/ลงทะเบียนถี่เกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง",
    });
  },
});

// สำหรับ endpoint อ่านตารางสอนแบบ public จำกัดความถี่
const scheduleReadRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 นาที
  max: 60, // 60 ครั้งต่อ IP ต่อ 1 นาที
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      message: "ขอดูตารางสอนถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
    });
  },
});

module.exports = {
  authRateLimiter,
  scheduleReadRateLimiter,
  loginBruteForceGuard,
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
      const role = normalizeRole(user.role);
      req.userRole = role;
      if (!adminRoleSet.has(role)) {
        return res.status(403).json({ message: "Admin only" });
      }
      next();
    } catch (e) {
      return res.status(500).json({ message: "Authorization error" });
    }
  },
  authorizeOwner: async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: Number(req.userId) },
        select: { id: true, role: true, isActive: true },
      });
      if (!user || user.isActive === false) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const role = normalizeRole(user.role);
      req.userRole = role;
      if (role !== "OWNER") {
        return res.status(403).json({ message: "Owner only" });
      }
      next();
    } catch (e) {
      return res.status(500).json({ message: "Authorization error" });
    }
  },
  authorizeAdminOrTeacher: async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: Number(req.userId) },
        select: { id: true, role: true, isActive: true },
      });
      if (!user || user.isActive === false) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const role = normalizeRole(user.role);
      req.userRole = role;
      if (!(adminRoleSet.has(role) || teacherRoleSet.has(role))) {
        return res.status(403).json({ message: "Admin/Teacher only" });
      }
      // Attach latest role for downstream handlers/validators
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
      const role = normalizeRole(user.role);
      req.userRole = role;
      if (!teacherRoleSet.has(role)) {
        return res.status(403).json({ message: "Teacher only" });
      }
      next();
    } catch (e) {
      return res.status(500).json({ message: "Authorization error" });
    }
  },
  authorizeGeneralLeaveApprover: async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: Number(req.userId) },
        select: { id: true, role: true, isActive: true },
      });
      if (!user || user.isActive === false) {
        return res.status(403).json({ message: "Forbidden" });
      }
      // Ensure downstream handlers know the actual role (JWT may be stale)
      const role = normalizeRole(user.role);
      req.userRole = role;
      if (!generalLeaveApproverRoleSet.has(role)) {
        return res.status(403).json({ message: "Leave approver only" });
      }
      next();
    } catch (e) {
      return res.status(500).json({ message: "Authorization error" });
    }
  },
};
