const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcryptjs");

const rankLabelMap = {
  ADMIRAL: "พลเรือเอก",
  ADMIRAL_FEMALE: "พลเรือเอกหญิง",
  VICE_ADMIRAL: "พลเรือโท",
  VICE_ADMIRAL_FEMALE: "พลเรือโทหญิง",
  REAR_ADMIRAL: "พลเรือตรี",
  REAR_ADMIRAL_FEMALE: "พลเรือตรีหญิง",
  CAPTAIN: "นาวาเอก",
  CAPTAIN_FEMALE: "นาวาเอกหญิง",
  COMMANDER: "นาวาโท",
  COMMANDER_FEMALE: "นาวาโทหญิง",
  LIEUTENANT_COMMANDER: "นาวาตรี",
  LIEUTENANT_COMMANDER_FEMALE: "นาวาตรีหญิง",
  LIEUTENANT: "เรือเอก",
  LIEUTENANT_FEMALE: "เรือเอกหญิง",
  SUB_LIEUTENANT: "เรือโท",
  SUB_LIEUTENANT_FEMALE: "เรือโทหญิง",
  ENSIGN: "เรือตรี",
  ENSIGN_FEMALE: "เรือตรีหญิง",
  PETTY_OFFICER_1: "พันจ่าเอก",
  PETTY_OFFICER_1_FEMALE: "พันจ่าเอกหญิง",
  PETTY_OFFICER_2: "พันจ่าโท",
  PETTY_OFFICER_2_FEMALE: "พันจ่าโทหญิง",
  PETTY_OFFICER_3: "พันจ่าตรี",
  PETTY_OFFICER_3_FEMALE: "พันจ่าตรีหญิง",
  LIEUTENANT_COLONEL: "พันโท",
  LIEUTENANT_COLONEL_FEMALE: "พันโทหญิง",
  MAJOR: "พันตรี",
  MAJOR_FEMALE: "พันตรีหญิง",
  PETTY_OFFICER: "จ่าเอก",
  PETTY_OFFICER_FEMALE: "จ่าเอกหญิง",
  LEADING_RATING: "จ่าโท",
  LEADING_RATING_FEMALE: "จ่าโทหญิง",
  ABLE_SEAMAN: "จ่าตรี",
  ABLE_SEAMAN_FEMALE: "จ่าตรีหญิง",
  SEAMAN_RECRUIT: "พลฯ",
};

const rankKeySet = new Set(Object.keys(rankLabelMap));
const thaiRankToEnum = Object.entries(rankLabelMap).reduce(
  (acc, [key, label]) => {
    acc[label] = key;
    return acc;
  },
  {}
);

const normalizeRankValue = (value) => {
  if (value === undefined || value === null) return undefined;
  const rawRank = String(value).trim();
  if (!rawRank) return undefined;
  const upperRank = rawRank.toUpperCase();
  if (rankKeySet.has(rawRank)) return rawRank;
  if (rankKeySet.has(upperRank)) return upperRank;
  if (thaiRankToEnum[rawRank]) return thaiRankToEnum[rawRank];
  const err = new Error("rank ไม่ถูกต้อง");
  err.code = "VALIDATION_ERROR";
  throw err;
};

const withThaiRank = (payload) => {
  if (!payload) return payload;
  if (Array.isArray(payload)) {
    return payload.map(withThaiRank);
  }
  if (payload.rank) {
    return { ...payload, rank: rankLabelMap[payload.rank] || payload.rank };
  }
  return payload;
};

// ตรวจสอบและจัดรูปแบบข้อมูลให้ตรงกับ schema.prisma
const normalizeAndValidateUserInput = (input = {}) => {
  const requiredFields = [
    "username",
    "password", // ใช้รับจาก client แล้วจะแปลงเป็น passwordHash
    "firstName",
    "lastName",
    "email",
    "phone",
  ];

  const missing = requiredFields.filter(
    (k) => input[k] === undefined || input[k] === null || input[k] === ""
  );

  if (missing.length) {
    const err = new Error(`ข้อมูลไม่ครบถ้วน: ต้องมี ${missing.join(", ")}`);
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  // แปลง birthDate เป็น Date (ใช้วันปัจจุบันเป็นค่าเริ่มต้นถ้าไม่ได้ส่งมา)
  const birthDateInput = input.birthDate || new Date();
  const birthDate =
    birthDateInput instanceof Date
      ? birthDateInput
      : new Date(birthDateInput);
  if (isNaN(birthDate.getTime())) {
    const err = new Error("รูปแบบวันเกิด (birthDate) ไม่ถูกต้อง");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const profileImage =
    input.profileImage !== undefined ? input.profileImage : input.avatar;
  let avatarValue =
    profileImage !== undefined && profileImage !== null
      ? String(profileImage).trim()
      : undefined;

  const rankValue = normalizeRankValue(input.rank);

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
    rank: rankValue || undefined, // ใช้ค่า default ใน schema ถ้าไม่ส่งมา
    fullAddress: input.fullAddress
      ? String(input.fullAddress).trim()
      : "-",
    education: input.education ?? undefined,
    position: input.position ?? undefined,
    email: String(input.email).trim(),
    phone: input.phone ? String(input.phone).trim() : undefined,
    emergencyContactName: input.emergencyContactName
      ? String(input.emergencyContactName).trim()
      : undefined,
    emergencyContactPhone: input.emergencyContactPhone
      ? String(input.emergencyContactPhone).trim()
      : undefined,
    medicalHistory: input.medicalHistory ?? undefined,
    avatar: avatarValue,
  };

  if (data.emergencyContactName === undefined) {
    delete data.emergencyContactName;
  }
  if (data.emergencyContactPhone === undefined) {
    delete data.emergencyContactPhone;
  }

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
      refreshTokenHash: true,
      refreshTokenExpiresAt: true,
    },
  });
};

const saveRefreshTokenForUser = async (userId, tokenHash, expiresAt) => {
  return prisma.user.update({
    where: { id: Number(userId) },
    data: {
      refreshTokenHash: tokenHash,
      refreshTokenExpiresAt: expiresAt,
    },
    select: {
      id: true,
      refreshTokenExpiresAt: true,
    },
  });
};

const clearRefreshTokenForUser = async (userId) => {
  return prisma.user.update({
    where: { id: Number(userId) },
    data: {
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    },
    select: {
      id: true,
    },
  });
};

const findUserByRefreshTokenHash = async (tokenHash) => {
  if (!tokenHash) return null;
  return prisma.user.findFirst({
    where: { refreshTokenHash: String(tokenHash) },
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
      refreshTokenExpiresAt: true,
      firstName: true,
      lastName: true,
    },
  });
};

module.exports = {
  createUser,
  findUserByUsername,
  saveRefreshTokenForUser,
  clearRefreshTokenForUser,
  findUserByRefreshTokenHash,
  // เพิ่มสำหรับโปรไฟล์ตัวเอง
  getUserById: async (id) => {
    return withThaiRank(
      await prisma.user.findUnique({
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
      })
    );
  },
  updateUserSelf: async (id, input) => {
    const allowed = new Set([
      "firstName",
      "lastName",
      "birthDate",
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
      if (k === "rank") {
        if (String(v).trim() === "") continue;
        data.rank = normalizeRankValue(v);
        continue;
      }
      data[k] = typeof v === "string" ? v.trim() : v;
    }

    if (Object.keys(data).length === 0) {
      return withThaiRank(
        await prisma.user.findUnique({
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
        })
      );
    }

    return withThaiRank(
      await prisma.user.update({
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
      })
    );
  },
  changePasswordSelf: async ({ id, currentPassword, newPassword }) => {
    if (!id) {
      const err = new Error("ต้องระบุผู้ใช้ที่ต้องการเปลี่ยนรหัสผ่าน");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    if (!currentPassword || !newPassword) {
      const err = new Error("ต้องระบุ currentPassword และ newPassword");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    const current = String(currentPassword);
    const next = String(newPassword);
    if (next.length < 8) {
      const err = new Error("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    if (current === next) {
      const err = new Error("รหัสผ่านใหม่ต้องไม่เหมือนกับรหัสผ่านเดิม");
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      const err = new Error("ไม่พบผู้ใช้");
      err.code = "P2025";
      throw err;
    }

    const match = await bcrypt.compare(current, user.passwordHash);
    if (!match) {
      const err = new Error("รหัสผ่านเดิมไม่ถูกต้อง");
      err.code = "INVALID_PASSWORD";
      throw err;
    }

    const nextHash = await bcrypt.hash(next, 10);
    return prisma.user.update({
      where: { id: Number(id) },
      data: { passwordHash: nextHash },
      select: { id: true, updatedAt: true },
    });
  },
  // สำหรับแอดมิน: ดึงรายการผู้ใช้ (รองรับค้นหา/แบ่งหน้าแบบง่าย)
  listUsers: async ({ page = 1, pageSize = 50, search, role } = {}) => {
    const take = Math.max(1, Math.min(Number(pageSize) || 50, 200));
    const skip = Math.max(0, ((Number(page) || 1) - 1) * take);
    const where = {};
    if (search) {
      where.OR = [
        { username: { contains: String(search) } },
        { firstName: { contains: String(search) } },
        { lastName: { contains: String(search) } },
        { email: { contains: String(search) } },
        { phone: { contains: String(search) } },
      ];
    }
    if (role) {
      const r = String(role).toUpperCase();
      const allowed = new Set(["ADMIN", "TEACHER", "STUDENT"]);
      if (allowed.has(r)) where.role = r;
    }

    const [itemsRaw, total] = await Promise.all([
      prisma.user.findMany({
        where: Object.keys(where).length ? where : undefined,
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

    return {
      items: withThaiRank(itemsRaw),
      total,
      page: Number(page) || 1,
      pageSize: take,
    };
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
  // เปิดการใช้งานผู้ใช้ (reactivate) โดยตั้ง isActive = true
  activateUser: async (id) => {
    return prisma.user.update({
      where: { id: Number(id) },
      data: { isActive: true },
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
      if (k === "rank") {
        data.rank = normalizeRankValue(v);
        continue;
      }
      if (k === "password") continue; // controller จะจัดการ hash
      data[k] = typeof v === "string" ? v.trim() : v;
    }

    return withThaiRank(
      await prisma.user.update({
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
      })
    );
  },
};
