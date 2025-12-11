const prisma = require("../utils/prisma");
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

const PLACEHOLDER_STRINGS = new Set([
  "-",
  "ไม่มี",
  "ไม่ระบุ",
  "n/a",
  "none",
]);

const sanitizeStringValue = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  if (PLACEHOLDER_STRINGS.has(trimmed.toLowerCase())) return undefined;
  return trimmed;
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
    .map((entry) => sanitizeStringValue(entry))
    .filter((entry) => entry !== undefined);
  return normalized;
};

const sanitizeStringListOutput = (value) => {
  if (!Array.isArray(value)) return value;
  const cleaned = value
    .map((entry) => sanitizeStringValue(entry))
    .filter((entry) => entry !== undefined);
  return cleaned;
};

const sanitizeUserPayload = (payload) => {
  if (!payload) return payload;
  const cleaned = { ...payload };
  const fieldsToSanitize = [
    "fullAddress",
    "education",
    "position",
    "division",
    "email",
    "phone",
    "emergencyContactName",
    "emergencyContactPhone",
    "medicalHistory",
    "religion",
    "specialSkills",
    "secondaryOccupation",
  ];
  for (const field of fieldsToSanitize) {
    const value = cleaned[field];
    if (value !== undefined) {
      cleaned[field] = sanitizeStringValue(value);
    }
  }
  for (const listField of [
    "chronicDiseases",
    "drugAllergies",
    "foodAllergies",
  ]) {
    const value = cleaned[listField];
    if (Array.isArray(value)) {
      cleaned[listField] = sanitizeStringListOutput(value);
    }
  }
  return cleaned;
};

const withThaiRank = (payload) => {
  if (!payload) return payload;
  if (Array.isArray(payload)) {
    return payload.map(withThaiRank);
  }
  const rankLabel =
    payload.rank && rankLabelMap[payload.rank]
      ? rankLabelMap[payload.rank]
      : payload.rank;
  return sanitizeUserPayload({ ...payload, rank: rankLabel });
};

const clampScore = (val, min = 0, max = 100) =>
  Math.min(max, Math.max(min, Number.isFinite(val) ? val : 0));

const roundTwoDecimals = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Number(num.toFixed(2));
};

const computeEducationScore = (education = "") => {
  const text = String(education || "").trim().toLowerCase();
  let score = 30;
  if (
    text.includes("phd") ||
    text.includes("doctor") ||
    text.includes("เอก") ||
    text.includes("โท") ||
    text.includes("master") ||
    text.includes("msc") ||
    text.includes("bachelor") ||
    text.includes("ตรี")
  ) {
    score = 100;
  } else if (text.includes("ปวส") || text.includes("diploma")) {
    score = 80;
  } else if (
    text.includes("มัธยมปลาย") ||
    text.includes("ม.6") ||
    text.includes("high school")
  ) {
    score = 60;
  } else if (text.includes("ม.3") || text.includes("มัธยมต้น")) {
    score = 45;
  }
  return clampScore(score);
};

const normalizeSkillEntries = (value) => {
  const list = normalizeStringList(value);
  if (!list) return [];
  return list.map((item) => item.toLowerCase());
};

const computeHealthScore = (profile = {}) => {
  let score = 100;
  const chronicCount = Array.isArray(profile.chronicDiseases)
    ? profile.chronicDiseases.length
    : 0;
  const allergyCount =
    (Array.isArray(profile.foodAllergies) ? profile.foodAllergies.length : 0) +
    (Array.isArray(profile.drugAllergies) ? profile.drugAllergies.length : 0);
  if (profile.medicalHistory) score -= 10;
  score -= chronicCount * 15;
  score -= allergyCount * 5;
  return clampScore(score);
};

const computeEvaluationScore = (stats = {}) => {
  const avg = Number(stats.averageRating);
  if (!Number.isFinite(avg)) return 45;
  return clampScore((avg / 5) * 100);
};

const computeSkillScore = (profile = {}) => {
  const skills = new Set(normalizeSkillEntries(profile.specialSkills));
  const secondary = profile.secondaryOccupation
    ? String(profile.secondaryOccupation).trim()
    : "";
  let score = 30;
  score += Math.min(skills.size * 10, 40);
  if (secondary) score += 15;
  return clampScore(score);
};

const computeLeaveScore = (leaveStats = {}) => {
  const totalLeaves = Number(leaveStats.total) || 0;
  const capped = Math.min(Math.max(totalLeaves, 0), 12);
  const deduction = capped * 8;
  return clampScore(100 - deduction);
};

const USER_RADAR_INDICATORS = [
  { name: "สุขภาพ", max: 100 },
  { name: "การศึกษา", max: 100 },
  { name: "คะแนนนักเรียน", max: 100 },
  { name: "ทักษะพิเศษ", max: 100 },
  { name: "การลา", max: 100 },
];

const buildUserRadarProfile = (profile = {}, stats = {}) => {
  const sanitizedProfile = sanitizeUserPayload(profile) || {};
  const healthScore = computeHealthScore(sanitizedProfile);
  const educationScore = computeEducationScore(sanitizedProfile.education);
  const evaluationScore = computeEvaluationScore(stats?.studentEvaluationStats);
  const skillScore = computeSkillScore(sanitizedProfile);
  const leaveScore = computeLeaveScore(stats?.leaveStats);
  const rawValues = [
    healthScore,
    educationScore,
    evaluationScore,
    skillScore,
    leaveScore,
  ];
  const formatValue = (value) => roundTwoDecimals(value);

  return {
    indicators: USER_RADAR_INDICATORS,
    values: rawValues.map(formatValue),
    breakdown: USER_RADAR_INDICATORS.map((indicator, index) => ({
      label: indicator.name,
      score: formatValue(rawValues[index]),
    })),
  };
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

const getUserAdminDetail = async (id) => {
  const numericId = normalizeUserId(id);
  if (numericId === null) return null;

  const profile = await getUserProfile(numericId, { useCache: false });
  if (!profile) return null;

  const [
    evaluationAggregate,
    leaveGroups,
    latestLeave,
    teacherSheetAggregate,
    teacherRatingAggregate,
    latestTeacherSheet,
  ] = await Promise.all([
    prisma.studentEvaluation.aggregate({
      where: { evaluatorId: numericId },
      _count: { _all: true },
      _avg: { overallScore: true },
      _max: { submittedAt: true },
    }),
    prisma.teacherLeave.groupBy({
      by: ["status"],
      where: { teacherId: numericId },
      _count: { _all: true },
    }),
    prisma.teacherLeave.findFirst({
      where: { teacherId: numericId },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        leaveType: true,
        destination: true,
        reason: true,
        startDate: true,
        endDate: true,
        status: true,
        isOfficialDuty: true,
        adminApprovalStatus: true,
        ownerApprovalStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.evaluationSheet.aggregate({
      where: { teacherId: numericId },
      _count: { _all: true },
      _max: { evaluatedAt: true },
    }),
    prisma.evaluationAnswer.aggregate({
      where: { sheet: { teacherId: numericId } },
      _avg: { rating: true },
      _count: true,
    }),
    prisma.evaluationSheet.findFirst({
      where: { teacherId: numericId },
      orderBy: { evaluatedAt: "desc" },
      select: {
        id: true,
        subject: true,
        teacherName: true,
        evaluatedAt: true,
        notes: true,
        answers: {
          orderBy: { id: "asc" },
          select: { id: true, section: true, itemCode: true, itemText: true, rating: true },
        },
      },
    }),
  ]);

  const leaveByStatus = leaveGroups.reduce((acc, group) => {
    acc[group.status] = group._count?._all || 0;
    return acc;
  }, {});

  const studentStats = {
    totalSheets: teacherSheetAggregate._count?._all || 0,
    averageRating: teacherRatingAggregate._avg?.rating ?? null,
    totalRatings:
      typeof teacherRatingAggregate._count === "number"
        ? teacherRatingAggregate._count
        : teacherRatingAggregate._count?._all || 0,
    lastEvaluatedAt: teacherSheetAggregate._max?.evaluatedAt || null,
    lastSheet: latestTeacherSheet || null,
  };
  const approvedLeaveTotal = leaveGroups.reduce((sum, group) => {
    const count = group._count?._all || 0;
    return group.status === "APPROVED" ? sum + count : sum;
  }, 0);
  const leaveStats = {
    total: approvedLeaveTotal,
    byStatus: leaveByStatus,
    lastLeave: latestLeave || null,
  };
  const radarProfile = buildUserRadarProfile(profile, {
    studentEvaluationStats: studentStats,
    teacherEvaluationStats: {
      total: evaluationAggregate._count?._all || 0,
      averageOverallScore: evaluationAggregate._avg?.overallScore ?? null,
      lastSubmittedAt: evaluationAggregate._max?.submittedAt || null,
    },
    leaveStats,
  });
  return {
    ...profile,
    radarProfile,
    // evaluationStats = นักเรียนประเมินครู (sheet ที่ครูเป็นผู้ถูกประเมิน)
    studentEvaluationStats: studentStats,
    // teacherEvaluationStats = ครูประเมินนักเรียน (evaluation ที่ครูเป็นผู้ประเมิน)
    teacherEvaluationStats: {
      total: evaluationAggregate._count?._all || 0,
      averageOverallScore:
        evaluationAggregate._avg?.overallScore ?? null,
      lastSubmittedAt: evaluationAggregate._max?.submittedAt || null,
    },
    leaveStats,
  };
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

  const missing = requiredFields.filter((k) => {
    const value = input[k];
    if (value === undefined || value === null) return true;
    if (k === "password") {
      return String(value).trim().length === 0;
    }
    return sanitizeStringValue(value) === undefined;
  });

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
  const divisionValue = sanitizeStringValue(divisionValueRaw);

  if (normalizedRole === "TEACHER" && !divisionValue) {
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
    fullAddress: sanitizeStringValue(input.fullAddress),
    education: sanitizeStringValue(input.education),
    position: sanitizeStringValue(input.position),
    division: divisionValue,
    email: sanitizeStringValue(input.email),
    phone: sanitizeStringValue(input.phone),
    emergencyContactName: sanitizeStringValue(input.emergencyContactName),
    emergencyContactPhone: sanitizeStringValue(input.emergencyContactPhone),
    medicalHistory: sanitizeStringValue(input.medicalHistory),
    chronicDiseases,
    drugAllergies,
    foodAllergies,
    religion: sanitizeStringValue(input.religion),
    specialSkills: sanitizeStringValue(input.specialSkills),
    secondaryOccupation: sanitizeStringValue(input.secondaryOccupation),
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
  getUserAdminDetail,
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
      const allowed = new Set([
        "ADMIN",
        "SUB_ADMIN",
        "SCHEDULE_ADMIN",
        "FORM_CREATOR",
        "EXAM_UPLOADER",
        "TEACHER",
        "STUDENT",
      ]);
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

    const itemsWithRadar = withThaiRank(itemsRaw).map((item) => ({
      ...item,
      radarProfile: buildUserRadarProfile(item),
    }));
    return {
      items: itemsWithRadar,
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
