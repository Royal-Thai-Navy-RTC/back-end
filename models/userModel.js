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

const normalizeStringList = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const sourceArray = Array.isArray(value)
    ? value
    : String(value)
        .split(/\r?\n|,/)
        .map((entry) => entry.trim());
  const normalized = sourceArray
    .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry || "").trim()))
    .filter((entry) => entry.length > 0);
  return normalized;
};

const USER_PROFILE_SELECT = {
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
  division: true,
  email: true,
  phone: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  medicalHistory: true,
  chronicDiseases: true,
  drugAllergies: true,
  foodAllergies: true,
  religion: true,
  specialSkills: true,
  secondaryOccupation: true,
  avatar: true,
  createdAt: true,
  updatedAt: true,
};

const USER_PROFILE_CACHE_TTL_MS = 30 * 1000;
const USER_PROFILE_CACHE_MAX = 500;
const userProfileCache = new Map();

const cloneProfilePayload = (payload) =>
  payload ? { ...payload } : payload;

const normalizeUserId = (value) => {
  const num = Number(value);
  return Number.isInteger(num) ? num : null;
};

const readUserProfileCache = (numericId) => {
  const cached = userProfileCache.get(numericId);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    userProfileCache.delete(numericId);
    return null;
  }
  return cloneProfilePayload(cached.value);
};

const evictOldestUserCacheEntry = () => {
  const oldestKey = userProfileCache.keys().next().value;
  if (oldestKey !== undefined) {
    userProfileCache.delete(oldestKey);
  }
};

const writeUserProfileCache = (numericId, profile) => {
  if (!profile) return;
  if (userProfileCache.size >= USER_PROFILE_CACHE_MAX) {
    evictOldestUserCacheEntry();
  }
  userProfileCache.set(numericId, {
    value: cloneProfilePayload(profile),
    expiresAt: Date.now() + USER_PROFILE_CACHE_TTL_MS,
  });
};

const primeUserProfileCache = (id, profile) => {
  const numericId = normalizeUserId(id);
  if (numericId === null) return;
  if (profile) {
    writeUserProfileCache(numericId, profile);
  } else {
    userProfileCache.delete(numericId);
  }
};

const fetchUserProfileFromDb = async (id) => {
  return prisma.user.findUnique({
    where: { id },
    select: USER_PROFILE_SELECT,
  });
};

const getUserProfile = async (id, { useCache = true } = {}) => {
  const numericId = normalizeUserId(id);
  if (numericId === null) return null;
  if (useCache) {
    const cached = readUserProfileCache(numericId);
    if (cached) return cached;
  }
  const record = await fetchUserProfileFromDb(numericId);
  const normalized = withThaiRank(record);
  if (normalized && useCache) {
    writeUserProfileCache(numericId, normalized);
  }
  return normalized ? { ...normalized } : normalized;
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
  const chronicDiseases = normalizeStringList(input.chronicDiseases);
  const drugAllergies = normalizeStringList(input.drugAllergies);
  const foodAllergies = normalizeStringList(input.foodAllergies);
  const roleValueRaw =
    input.role !== undefined && input.role !== null
      ? String(input.role).trim()
      : undefined;
  const normalizedRole = roleValueRaw ? roleValueRaw.toUpperCase() : undefined;
  const divisionValueRaw =
    input.division !== undefined && input.division !== null
      ? String(input.division).trim()
      : undefined;

  if (normalizedRole === "TEACHER" && !divisionValueRaw) {
    const err = new Error("ต้องระบุ division (หมวดวิชา) สำหรับครูผู้สอน");
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
    role: normalizedRole || undefined, // ใช้ค่า default ใน schema ถ้าไม่ส่งมา
    isActive:
      input.isActive !== undefined ? Boolean(input.isActive) : undefined, // default true จาก schema
    rank: rankValue || undefined, // ใช้ค่า default ใน schema ถ้าไม่ส่งมา
    fullAddress: input.fullAddress
      ? String(input.fullAddress).trim()
      : "-",
    education: input.education ?? undefined,
    position: input.position ?? undefined,
    division: divisionValueRaw || undefined,
    email: String(input.email).trim(),
    phone: input.phone ? String(input.phone).trim() : undefined,
    emergencyContactName: input.emergencyContactName
      ? String(input.emergencyContactName).trim()
      : undefined,
    emergencyContactPhone: input.emergencyContactPhone
      ? String(input.emergencyContactPhone).trim()
      : undefined,
    medicalHistory: input.medicalHistory ?? undefined,
    chronicDiseases,
    drugAllergies,
    foodAllergies,
    religion: input.religion ? String(input.religion).trim() : undefined,
    specialSkills: input.specialSkills
      ? String(input.specialSkills).trim()
      : undefined,
    secondaryOccupation: input.secondaryOccupation
      ? String(input.secondaryOccupation).trim()
      : undefined,
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
  getUserById: getUserProfile,
  updateUserSelf: async (id, input) => {
    const allowed = new Set([
      "firstName",
      "lastName",
      "birthDate",
      "rank",
      "fullAddress",
      "education",
      "position",
      "division",
      "email",
      "phone",
      "emergencyContactName",
      "emergencyContactPhone",
      "medicalHistory",
      "chronicDiseases",
      "drugAllergies",
      "foodAllergies",
      "religion",
      "specialSkills",
      "secondaryOccupation",
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
      if (
        k === "chronicDiseases" ||
        k === "drugAllergies" ||
        k === "foodAllergies"
      ) {
        const normalizedList = normalizeStringList(v);
        if (normalizedList !== undefined) {
          data[k] = normalizedList;
        }
        continue;
      }
      if (k === "division") {
        const divisionValue = String(v).trim();
        if (divisionValue) {
          data.division = divisionValue;
        }
        continue;
      }
      data[k] = typeof v === "string" ? v.trim() : v;
    }

    if (Object.keys(data).length === 0) {
      return getUserProfile(id);
    }

    const updated = withThaiRank(
      await prisma.user.update({
        where: { id: Number(id) },
        data,
        select: USER_PROFILE_SELECT,
      })
    );
    primeUserProfileCache(id, updated);
    return updated;
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
    const normalizedSearch =
      typeof search === "string" ? search.trim() : search ? String(search) : "";
    if (normalizedSearch) {
      const searchFilter = {
        contains: normalizedSearch,
        mode: "insensitive",
      };
      where.OR = [
        { username: searchFilter },
        { firstName: searchFilter },
        { lastName: searchFilter },
        { email: searchFilter },
        { phone: searchFilter },
      ];
    }
    if (role) {
      const r = String(role).toUpperCase();
      const allowed = new Set(["ADMIN", "SUB_ADMIN", "TEACHER", "STUDENT"]);
      if (allowed.has(r)) where.role = r;
    }

    const whereClause = Object.keys(where).length ? where : undefined;

    const [itemsRaw, total] = await prisma.$transaction([
      prisma.user.findMany({
        where: whereClause,
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
          division: true,
          email: true,
          phone: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
          medicalHistory: true,
          chronicDiseases: true,
          drugAllergies: true,
          foodAllergies: true,
          religion: true,
          specialSkills: true,
          secondaryOccupation: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    return {
      items: withThaiRank(itemsRaw),
      total,
      page: Number(page) || 1,
      pageSize: take,
    };
  },
  searchUserPersonalInfo: async ({ query, limit = 100 } = {}) => {
    const normalizedQuery =
      typeof query === "string" ? query.trim() : query ? String(query).trim() : "";
    if (!normalizedQuery) {
      const err = new Error("ต้องระบุ query สำหรับค้นหา");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    const take = Math.max(1, Math.min(Number(limit) || 100, 200));
    const buildContains = () => ({
      contains: normalizedQuery,
    });
    const orFilters = [
      { username: buildContains() },
      { email: buildContains() },
      { phone: buildContains() },
      { firstName: buildContains() },
      { lastName: buildContains() },
      { fullAddress: buildContains() },
      { education: buildContains() },
      { position: buildContains() },
      { division: buildContains() },
      { medicalHistory: buildContains() },
      { emergencyContactName: buildContains() },
      { religion: buildContains() },
      { specialSkills: buildContains() },
      { secondaryOccupation: buildContains() },
    ];
    const jsonStringFilter = { string_contains: normalizedQuery };
    orFilters.push({ chronicDiseases: jsonStringFilter });
    orFilters.push({ drugAllergies: jsonStringFilter });
    orFilters.push({ foodAllergies: jsonStringFilter });

    const whereClause = { OR: orFilters };

    const [itemsRaw, total] = await prisma.$transaction([
      prisma.user.findMany({
        where: whereClause,
        orderBy: { updatedAt: "desc" },
        take,
        select: USER_PROFILE_SELECT,
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    return {
      items: withThaiRank(itemsRaw),
      total,
    };
  },
  // ปิดการใช้งาน (soft delete) ผู้ใช้ โดยตั้ง isActive = false
  deactivateUser: async (id) => {
    const result = await prisma.user.update({
      where: { id: Number(id) },
      data: { isActive: false },
      select: {
        id: true,
        username: true,
        isActive: true,
        updatedAt: true,
      },
    });
    primeUserProfileCache(id);
    return result;
  },
  // เปิดการใช้งานผู้ใช้ (reactivate) โดยตั้ง isActive = true
  activateUser: async (id) => {
    const result = await prisma.user.update({
      where: { id: Number(id) },
      data: { isActive: true },
      select: {
        id: true,
        username: true,
        isActive: true,
        updatedAt: true,
      },
    });
    primeUserProfileCache(id);
    return result;
  },
  // ลบผู้ใช้ออกจากฐานข้อมูลแบบถาวร (hard delete)
  deleteUserHard: async (id) => {
    const result = await prisma.user.delete({
      where: { id: Number(id) },
      select: {
        id: true,
        username: true,
      },
    });
    primeUserProfileCache(id);
    return result;
  },
  // ตั้งค่า avatar ตาม id (สำหรับแอดมิน)
  setUserAvatar: async (id, avatarPath) => {
    const result = await prisma.user.update({
      where: { id: Number(id) },
      data: { avatar: String(avatarPath) },
      select: {
        id: true,
        username: true,
        avatar: true,
        updatedAt: true,
      },
    });
    primeUserProfileCache(id);
    return result;
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
      "division",
      "email",
      "phone",
      "emergencyContactName",
      "emergencyContactPhone",
      "medicalHistory",
      "chronicDiseases",
      "drugAllergies",
      "foodAllergies",
      "religion",
      "specialSkills",
      "secondaryOccupation",
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
      if (
        k === "chronicDiseases" ||
        k === "drugAllergies" ||
        k === "foodAllergies"
      ) {
        data[k] = normalizeStringList(v);
        continue;
      }
      if (k === "role") {
        data.role = String(v).trim().toUpperCase();
        continue;
      }
      if (k === "division") {
        const divisionValue = String(v).trim();
        if (divisionValue) {
          data.division = divisionValue;
        }
        continue;
      }
      if (k === "password") continue; // controller จะจัดการ hash
      data[k] = typeof v === "string" ? v.trim() : v;
    }

    const existing = await prisma.user.findUnique({
      where: { id: Number(id) },
      select: { role: true, division: true },
    });
    if (!existing) {
      const err = new Error("User not found");
      err.code = "P2025";
      throw err;
    }

    const finalRole = data.role || existing.role;
    const finalDivision =
      data.division !== undefined ? data.division : existing.division;
    if (finalRole === "TEACHER" && (!finalDivision || !String(finalDivision).trim())) {
      const err = new Error("ครูผู้สอนต้องระบุ division (หมวดวิชา)");
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const updated = withThaiRank(
      await prisma.user.update({
        where: { id: Number(id) },
        data,
        select: USER_PROFILE_SELECT,
      })
    );
    primeUserProfileCache(id, updated);
    return updated;
  },
};
