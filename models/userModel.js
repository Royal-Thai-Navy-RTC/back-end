const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcryptjs");

// ตรวจสอบและจัดรูปแบบข้อมูลให้ตรงกับ schema.prisma
const normalizeAndValidateUserInput = (input) => {
  const requiredFields = [
    "username",
    "password", // ใช้รับจาก client แล้วจะแปลงเป็น passwordHash
    "firstName",
    "lastName",
    "birthDate",
    "fullAddress",
    "email",
    "phone",
    "emergencyContactName",
    "emergencyContactPhone",
  ];

  const missing = requiredFields.filter(
    (k) => input[k] === undefined || input[k] === null || input[k] === ""
  );
  if (missing.length) {
    const err = new Error(`ข้อมูลไม่ครบถ้วน: ต้องมี ${missing.join(", ")}`);
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  // แปลง birthDate เป็น Date
  const birthDate =
    input.birthDate instanceof Date
      ? input.birthDate
      : new Date(input.birthDate);
  if (isNaN(birthDate.getTime())) {
    const err = new Error("รูปแบบวันเกิด (birthDate) ไม่ถูกต้อง");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  // เตรียมข้อมูลตาม schema (field ชื่อให้ตรง)
  const data = {
    username: String(input.username).trim(),
    // passwordHash จะถูกเติมภายหลังจาก hash
    firstName: String(input.firstName).trim(),
    lastName: String(input.lastName).trim(),
    birthDate,
    role: input.role || undefined, // ใช้ค่า default ใน schema ถ้าไม่ส่งมา
    isActive:
      input.isActive !== undefined ? Boolean(input.isActive) : undefined, // default true จาก schema
    rank: input.rank || undefined, // ใช้ค่า default ใน schema ถ้าไม่ส่งมา
    fullAddress: String(input.fullAddress).trim(),
    education: input.education ?? undefined,
    position: input.position ?? undefined,
    email: String(input.email).trim(),
    phone: String(input.phone).trim(),
    emergencyContactName: String(input.emergencyContactName).trim(),
    emergencyContactPhone: String(input.emergencyContactPhone).trim(),
    medicalHistory: input.medicalHistory ?? undefined,
    avatar: input.avatar ?? undefined,
  };

  return { data };
};

// สร้างผู้ใช้ใหม่ให้ตรงกับ schema.prisma (บังคับ field ที่จำเป็น และบันทึก passwordHash)
const createUser = async (userInput) => {
  const { data } = normalizeAndValidateUserInput(userInput);

  const passwordHash = await bcrypt.hash(String(userInput.password), 10);

  return prisma.user.create({
    data: {
      ...data,
      passwordHash,
    },
  });
};

// ค้นหาผู้ใช้จาก username (รวม passwordHash เพื่อใช้ตรวจสอบรหัสผ่านตอน login)
const findUserByUsername = async (username) => {
  return prisma.user.findUnique({
    where: { username: String(username).trim() },
    select: {
      id: true,
      username: true,
      passwordHash: true,
      role: true,
      isActive: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  });
};

module.exports = {
  createUser,
  findUserByUsername,
  // เพิ่มสำหรับโปรไฟล์ตัวเอง
  getUserById: async (id) => {
    return prisma.user.findUnique({
      where: { id: Number(id) },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        rank: true,
        fullAddress: true,
        education: true,
        position: true,
        email: true,
        phone: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        medicalHistory: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },
  updateUserSelf: async (id, input) => {
    const allowed = new Set([
      "firstName",
      "lastName",
      "birthDate",
      "fullAddress",
      "education",
      "position",
      "email",
      "phone",
      "emergencyContactName",
      "emergencyContactPhone",
      "medicalHistory",
      "avatar",
    ]);

    const data = {};
    for (const [k, v] of Object.entries(input || {})) {
      if (!allowed.has(k)) continue;
      if (v === undefined || v === null) continue;
      if (k === "birthDate") {
        const d = v instanceof Date ? v : new Date(v);
        if (!isNaN(d.getTime())) data.birthDate = d;
        else {
          const err = new Error("รูปแบบวันเกิด (birthDate) ไม่ถูกต้อง");
          err.code = "VALIDATION_ERROR";
          throw err;
        }
        continue;
      }
      data[k] = typeof v === "string" ? v.trim() : v;
    }

    if (Object.keys(data).length === 0) {
      return prisma.user.findUnique({
        where: { id: Number(id) },
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
          firstName: true,
          lastName: true,
          birthDate: true,
          rank: true,
          fullAddress: true,
          education: true,
          position: true,
          email: true,
          phone: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
          medicalHistory: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    return prisma.user.update({
      where: { id: Number(id) },
      data,
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        rank: true,
        fullAddress: true,
        education: true,
        position: true,
        email: true,
        phone: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        medicalHistory: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },
  // สำหรับแอดมิน: ดึงรายการผู้ใช้ (รองรับค้นหา/แบ่งหน้าแบบง่าย)
  listUsers: async ({ page = 1, pageSize = 50, search } = {}) => {
    const take = Math.max(1, Math.min(Number(pageSize) || 50, 200));
    const skip = Math.max(0, ((Number(page) || 1) - 1) * take);
    const where = search
      ? {
          OR: [
            { username: { contains: String(search) } },
            { firstName: { contains: String(search) } },
            { lastName: { contains: String(search) } },
            { email: { contains: String(search) } },
            { phone: { contains: String(search) } },
          ],
        }
      : undefined;

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
          firstName: true,
          lastName: true,
          birthDate: true,
          rank: true,
          fullAddress: true,
          education: true,
          position: true,
          email: true,
          phone: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
          medicalHistory: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { items, total, page: Number(page) || 1, pageSize: take };
  },
  // ปิดการใช้งาน (soft delete) ผู้ใช้ โดยตั้ง isActive = false
  deactivateUser: async (id) => {
    return prisma.user.update({
      where: { id: Number(id) },
      data: { isActive: false },
      select: {
        id: true,
        username: true,
        isActive: true,
        updatedAt: true,
      },
    });
  },
  // ลบผู้ใช้ออกจากฐานข้อมูลแบบถาวร (hard delete)
  deleteUserHard: async (id) => {
    return prisma.user.delete({
      where: { id: Number(id) },
      select: {
        id: true,
        username: true,
      },
    });
  },
  // ตั้งค่า avatar ตาม id (สำหรับแอดมิน)
  setUserAvatar: async (id, avatarPath) => {
    return prisma.user.update({
      where: { id: Number(id) },
      data: { avatar: String(avatarPath) },
      select: {
        id: true,
        username: true,
        avatar: true,
        updatedAt: true,
      },
    });
  },
  // สำหรับแอดมิน: อนุญาตแก้ไขฟิลด์กว้างขึ้น และรีเซ็ตรหัสผ่านได้
  updateUserByAdmin: async (id, input) => {
    const allowed = new Set([
      "username",
      "firstName",
      "lastName",
      "birthDate",
      "role",
      "isActive",
      "rank",
      "fullAddress",
      "education",
      "position",
      "email",
      "phone",
      "emergencyContactName",
      "emergencyContactPhone",
      "medicalHistory",
      "avatar",
      // "password" จะถูกแปลงเป็น passwordHash
      "password",
      // สำหรับ controller ส่งเข้ามาหลัง hash แล้วเท่านั้น
      "passwordHash",
    ]);

    const data = {};
    for (const [k, v] of Object.entries(input || {})) {
      if (!allowed.has(k)) continue;
      if (v === undefined || v === null || v === "") continue;
      if (k === "birthDate") {
        const d = v instanceof Date ? v : new Date(v);
        if (!isNaN(d.getTime())) data.birthDate = d;
        else {
          const err = new Error("รูปแบบวันเกิด (birthDate) ไม่ถูกต้อง");
          err.code = "VALIDATION_ERROR";
          throw err;
        }
        continue;
      }
      if (k === "password") continue; // controller จะจัดการ hash
      data[k] = typeof v === "string" ? v.trim() : v;
    }

    return prisma.user.update({
      where: { id: Number(id) },
      data,
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        rank: true,
        fullAddress: true,
        education: true,
        position: true,
        email: true,
        phone: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        medicalHistory: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },
};
