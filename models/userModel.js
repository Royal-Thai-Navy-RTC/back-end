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
  BATTALION: "กองพัน",
  COMPANY: "กองร้อย",
  SEAMAN_RECRUIT: "พลฯ",
};

const ROLE_CODES = [
  "OWNER",
  "COMMANDER",
  "ADMIN",
  "SUB_ADMIN",
  "SCHEDULE_ADMIN",
  "FORM_CREATOR",
  "EXAM_UPLOADER",
  "TEACHER",
  "STUDENT",
  "BAT1_CMD",
  "BAT1_COM1",
  "BAT1_COM2",
  "BAT1_COM3",
  "BAT1_COM4",
  "BAT1_COM5",
  "BAT2_CMD",
  "BAT2_COM1",
  "BAT2_COM2",
  "BAT2_COM3",
  "BAT2_COM4",
  "BAT2_COM5",
  "BAT3_CMD",
  "BAT3_COM1",
  "BAT3_COM2",
  "BAT3_COM3",
  "BAT3_COM4",
  "BAT3_COM5",
  "BAT4_CMD",
  "BAT4_COM1",
  "BAT4_COM2",
  "BAT4_COM3",
  "BAT4_COM4",
  "BAT4_COM5",
];

const ROLE_LABELS = {
  OWNER: "Owner",
  COMMANDER: "ผู้บังคับบัญชา",
  ADMIN: "แอดมิน",
  SUB_ADMIN: "ผู้ช่วยแอดมิน",
  SCHEDULE_ADMIN: "ผู้ดูแลตารางสอน",
  FORM_CREATOR: "ผู้สร้างแบบฟอร์ม",
  EXAM_UPLOADER: "ผู้อัปโหลดคะแนนสอบ",
  TEACHER: "ครูผู้สอน",
  STUDENT: "นักเรียน",
  BAT1_CMD: "ผู้พัน 1",
  BAT1_COM1: "กองพัน 1 กองร้อย 1",
  BAT1_COM2: "กองพัน 1 กองร้อย 2",
  BAT1_COM3: "กองพัน 1 กองร้อย 3",
  BAT1_COM4: "กองพัน 1 กองร้อย 4",
  BAT1_COM5: "กองพัน 1 กองร้อย 5",
  BAT2_CMD: "ผู้พัน 2",
  BAT2_COM1: "กองพัน 2 กองร้อย 1",
  BAT2_COM2: "กองพัน 2 กองร้อย 2",
  BAT2_COM3: "กองพัน 2 กองร้อย 3",
  BAT2_COM4: "กองพัน 2 กองร้อย 4",
  BAT2_COM5: "กองพัน 2 กองร้อย 5",
  BAT3_CMD: "ผู้พัน 3",
  BAT3_COM1: "กองพัน 3 กองร้อย 1",
  BAT3_COM2: "กองพัน 3 กองร้อย 2",
  BAT3_COM3: "กองพัน 3 กองร้อย 3",
  BAT3_COM4: "กองพัน 3 กองร้อย 4",
  BAT3_COM5: "กองพัน 3 กองร้อย 5",
  BAT4_CMD: "ผู้พัน 4",
  BAT4_COM1: "กองพัน 4 กองร้อย 1",
  BAT4_COM2: "กองพัน 4 กองร้อย 2",
  BAT4_COM3: "กองพัน 4 กองร้อย 3",
  BAT4_COM4: "กองพัน 4 กองร้อย 4",
  BAT4_COM5: "กองพัน 4 กองร้อย 5",
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

const PLACEHOLDER_STRINGS = new Set(["-", "ไม่มี", "ไม่ระบุ", "n/a", "none"]);

const sanitizeStringValue = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  if (PLACEHOLDER_STRINGS.has(trimmed.toLowerCase())) return undefined;
  return trimmed;
};

const normalizeBooleanValue = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    const t = value.trim().toLowerCase();
    if (!t) return undefined;
    if (["true", "1", "yes", "y"].includes(t)) return true;
    if (["false", "0", "no", "n"].includes(t)) return false;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    return value !== 0;
  }
  return Boolean(value);
};

const normalizeOptionalInteger = (value, { fieldLabel = "field" } = {}) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const num = Number(value);
  if (!Number.isInteger(num)) {
    const err = new Error(`${fieldLabel} ต้องเป็นจำนวนเต็ม`);
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return num;
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
    "officialDutyNote",
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

const appendRankLabel = (userPayload) => {
  if (!userPayload) return userPayload;
  const rankLabel =
    userPayload.rank && rankLabelMap[userPayload.rank]
      ? rankLabelMap[userPayload.rank]
      : userPayload.rank || null;
  return { ...userPayload, rankLabel };
};

const clampScore = (val, min = 0, max = 100) =>
  Math.min(max, Math.max(min, Number.isFinite(val) ? val : 0));

const roundTwoDecimals = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Number(num.toFixed(2));
};

const computeEducationScore = (education = "") => {
  const text = String(education || "")
    .trim()
    .toLowerCase();
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
  // Base 50 points for completing annual health check; remaining 50 derived from health factors
  const base = profile.isAnnualHealthCheckDone ? 50 : 0;
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
  const normalized = clampScore(score); // 0-100
  const scaledRemaining = (normalized / 100) * 50; // convert to 0-50 band
  return clampScore(base + scaledRemaining);
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
  // const educationScore = computeEducationScore(sanitizedProfile.education);
  const educationScore = 100; // ปรับเป็นเต็ม 100 เสมอ
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
  studentClassYear: true,
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
  isOnOfficialDuty: true,
  officialDutyNote: true,
  isAnnualHealthCheckDone: true,
  avatar: true,
  createdAt: true,
  updatedAt: true,
};

const USER_PROFILE_CACHE_TTL_MS = 30 * 1000;
const USER_PROFILE_CACHE_MAX = 500;
const userProfileCache = new Map();

const cloneProfilePayload = (payload) => (payload ? { ...payload } : payload);

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
    serviceEvaluationAggregate,
    recentServiceEvaluations,
    tasksAsAssignee,
    tasksCreatedByUser,
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
          select: {
            id: true,
            section: true,
            itemCode: true,
            itemText: true,
            rating: true,
          },
        },
      },
    }),
    prisma.studentEvaluation.aggregate({
      where: {
        evaluatedPersonId: numericId,
        template: { templateType: "SERVICE" },
      },
      _count: { _all: true },
      _avg: { overallScore: true },
      _max: { submittedAt: true },
    }),
    prisma.studentEvaluation.findMany({
      where: {
        evaluatedPersonId: numericId,
        template: { templateType: "SERVICE" },
      },
      orderBy: { submittedAt: "desc" },
      take: 5,
      select: {
        id: true,
        templateId: true,
        evaluationRound: true,
        subject: true,
        overallScore: true,
        submittedAt: true,
        summary: true,
        evaluatorId: true,
        evaluator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            rank: true,
          },
        },
        template: {
          select: { id: true, name: true, templateType: true },
        },
      },
    }),
    prisma.taskAssignment.findMany({
      where: { assigneeId: numericId },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rank: true,
            position: true,
            role: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            rank: true,
            position: true,
          },
        },
      },
    }),
    prisma.taskAssignment.findMany({
      where: { createdById: numericId },
      orderBy: { createdAt: "desc" },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rank: true,
            position: true,
            role: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            rank: true,
            position: true,
          },
        },
      },
    }),
  ]);

  const tasksAsAssigneeWithRank = tasksAsAssignee.map((task) => ({
    ...task,
    assignee: appendRankLabel(task.assignee),
    creator: appendRankLabel(task.creator),
  }));
  const tasksCreatedByUserWithRank = tasksCreatedByUser.map((task) => ({
    ...task,
    assignee: appendRankLabel(task.assignee),
    creator: appendRankLabel(task.creator),
  }));

  const leaveByStatus = leaveGroups.reduce((acc, group) => {
    acc[group.status] = group._count?._all || 0;
    return acc;
  }, {});

  const closedTaskStatuses = new Set(["DONE", "CANCELLED", "CANCELED"]);
  const activeAssignedTasks = tasksAsAssignee.filter(
    (task) => !closedTaskStatuses.has(String(task.status || "").toUpperCase())
  );

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
      averageOverallScore: evaluationAggregate._avg?.overallScore ?? null,
      lastSubmittedAt: evaluationAggregate._max?.submittedAt || null,
    },
    leaveStats,
    serviceEvaluationStats: {
      total: serviceEvaluationAggregate._count?._all || 0,
      averageOverallScore:
        serviceEvaluationAggregate._avg?.overallScore ?? null,
      lastSubmittedAt: serviceEvaluationAggregate._max?.submittedAt || null,
      recentEvaluations: recentServiceEvaluations.map((ev) => ({
        id: ev.id,
        templateId: ev.templateId,
        templateName: ev.template?.name || null,
        templateType: ev.template?.templateType || null,
        evaluatorId: ev.evaluatorId,
        evaluatorName:
          [ev.evaluator?.firstName, ev.evaluator?.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() || null,
        evaluatorRole: ev.evaluator?.role || null,
        evaluatorRank: ev.evaluator?.rank || null,
        evaluatorRankLabel:
          ev.evaluator?.rank && rankLabelMap[ev.evaluator.rank]
            ? rankLabelMap[ev.evaluator.rank]
            : ev.evaluator?.rank || null,
        evaluationRound: ev.evaluationRound || null,
        subject: ev.subject || null,
        overallScore: ev.overallScore ?? null,
        submittedAt: ev.submittedAt || null,
        summary: ev.summary || null,
      })),
    },
    taskAssignments: {
      asAssignee: tasksAsAssigneeWithRank,
      createdByUser: tasksCreatedByUserWithRank,
      stats: {
        assignedTotal: tasksAsAssigneeWithRank.length,
        assignedActive: activeAssignedTasks.length,
        createdTotal: tasksCreatedByUserWithRank.length,
      },
    },
  };
};

// ตรวจสอบและจัดรูปแบบข้อมูลให้ตรงกับ schema.prisma
const normalizeAndValidateUserInput = (
  input = {},
  { allowMissingEmailPhone = false } = {}
) => {
  const requiredFields = ["username", "password", "firstName", "lastName"];
  if (!allowMissingEmailPhone) {
    requiredFields.push("email", "phone");
  }

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
    birthDateInput instanceof Date ? birthDateInput : new Date(birthDateInput);
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
  const studentClassYear = normalizeOptionalInteger(input.studentClassYear, {
    fieldLabel: "studentClassYear",
  });
  const usernameValue = String(input.username).trim();
  const emailValue = sanitizeStringValue(input.email);
  const phoneValue = sanitizeStringValue(input.phone);
  const finalEmail = emailValue || undefined;
  const finalPhone = phoneValue || undefined;

  // เตรียมข้อมูลตาม schema (field ชื่อให้ตรง)
  const fullAddressValue = sanitizeStringValue(input.fullAddress);
  const data = {
    username: usernameValue,
    // passwordHash จะถูกเติมภายหลังจาก hash
    firstName: String(input.firstName).trim(),
    lastName: String(input.lastName).trim(),
    birthDate,
    role: normalizedRole || undefined, // ใช้ค่า default ใน schema ถ้าไม่ส่งมา
    isActive:
      input.isActive !== undefined ? Boolean(input.isActive) : undefined, // default true จาก schema
    rank: rankValue || undefined, // ใช้ค่า default ใน schema ถ้าไม่ส่งมา
    fullAddress: fullAddressValue === undefined ? "" : fullAddressValue,
    education: sanitizeStringValue(input.education),
    position: sanitizeStringValue(input.position),
    division: divisionValue,
    isOnOfficialDuty: normalizeBooleanValue(input.isOnOfficialDuty),
    officialDutyNote: sanitizeStringValue(input.officialDutyNote),
    isAnnualHealthCheckDone: normalizeBooleanValue(
      input.isAnnualHealthCheckDone
    ),
    email: finalEmail,
    phone: finalPhone,
    emergencyContactName: sanitizeStringValue(input.emergencyContactName),
    emergencyContactPhone: sanitizeStringValue(input.emergencyContactPhone),
    medicalHistory: sanitizeStringValue(input.medicalHistory),
    chronicDiseases,
    drugAllergies,
    foodAllergies,
    religion: sanitizeStringValue(input.religion),
    specialSkills: sanitizeStringValue(input.specialSkills),
    secondaryOccupation: sanitizeStringValue(input.secondaryOccupation),
    studentClassYear,
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
const createUser = async (userInput, options = {}) => {
  const { data } = normalizeAndValidateUserInput(
    userInput,
    options || undefined
  );

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
      "studentClassYear",
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
      "isOnOfficialDuty",
      "officialDutyNote",
      "isAnnualHealthCheckDone",
    ]);

    const data = {};
    for (const [k, v] of Object.entries(input || {})) {
      if (!allowed.has(k)) continue;
      if (k === "studentClassYear") {
        if (typeof v === "string" && v.trim() === "") {
          continue;
        }
        const value = normalizeOptionalInteger(v, {
          fieldLabel: "studentClassYear",
        });
        if (value !== undefined) {
          data.studentClassYear = value;
        }
        continue;
      }
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
      if (k === "isOnOfficialDuty") {
        const flag = normalizeBooleanValue(v);
        if (flag !== undefined) {
          data.isOnOfficialDuty = flag;
        }
        continue;
      }
      if (k === "officialDutyNote") {
        if (v === null) {
          data.officialDutyNote = null;
        } else {
          const note = sanitizeStringValue(v);
          if (note !== undefined) {
            data.officialDutyNote = note;
          }
        }
        continue;
      }
      if (k === "isAnnualHealthCheckDone") {
        const flag = normalizeBooleanValue(v);
        if (flag !== undefined) {
          data.isAnnualHealthCheckDone = flag;
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
  listUsers: async ({
    page = 1,
    pageSize = 10,
    search,
    role,
    division,
    isOnOfficialDuty,
    isAnnualHealthCheckDone,
    onlyWithDivision = false,
  } = {}) => {
    const take = Math.max(1, Math.min(Number(pageSize) || 50, 200));
    const skip = Math.max(0, ((Number(page) || 1) - 1) * take);

    const where = {};
    const andFilters = [];

    const normalizedSearch =
      typeof search === "string" ? search.trim() : search ? String(search) : "";
    if (normalizedSearch) {
      const searchFilter = {
        contains: normalizedSearch,
      };
      where.OR = [
        { username: searchFilter },
        { firstName: searchFilter },
        { lastName: searchFilter },
        { email: searchFilter },
        { phone: searchFilter },
        { position: searchFilter },
        { division: searchFilter },
      ];
    }

    const normalizedRole =
      typeof role === "string" ? role.trim() : role ? String(role) : "";
    if (normalizedRole) {
      where.role = normalizedRole.toUpperCase();
    }

    const normalizedDivision = sanitizeStringValue(division);
    if (normalizedDivision) {
      andFilters.push({
        division: { contains: normalizedDivision },
      });
    }
    if (onlyWithDivision) {
      andFilters.push({ division: { not: null } });
      andFilters.push({ NOT: { division: "" } });
    }

    const officialDutyFlag = normalizeBooleanValue(isOnOfficialDuty);
    if (officialDutyFlag !== undefined) {
      andFilters.push({ isOnOfficialDuty: officialDutyFlag });
    }
    const annualHealthFlag = normalizeBooleanValue(isAnnualHealthCheckDone);
    if (annualHealthFlag !== undefined) {
      andFilters.push({ isAnnualHealthCheckDone: annualHealthFlag });
    }

    if (andFilters.length) {
      where.AND = andFilters;
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
          studentClassYear: true,
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
          isOnOfficialDuty: true,
          officialDutyNote: true,
          isAnnualHealthCheckDone: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    const itemsWithRadar = withThaiRank(itemsRaw).map((item) => {
      const avatarUrl = item.avatar || null;
      return {
        ...item,
        avatar: avatarUrl,
        profileImage: avatarUrl,
        photo: avatarUrl,
        profileImageUrl: avatarUrl,
        notes: item.notes ?? null,
        radarProfile: buildUserRadarProfile(item),
      };
    });
    return {
      items: itemsWithRadar,
      total,
      page: Number(page) || 1,
      pageSize: take,
    };
  },
  getDivisionSummary: async () => {
    const normalizeDivision = (value) => {
      const normalized =
        value === undefined || value === null ? "" : String(value).trim();
      return normalized || null;
    };

    const whereDivisionNotEmpty = {
      AND: [{ division: { not: null } }, { NOT: { division: "" } }],
    };

    const now = new Date();

    const [all, onDuty, healthChecked, officialDutyLeaves] = await Promise.all([
      prisma.user.groupBy({
        by: ["division"],
        where: whereDivisionNotEmpty,
        _count: { _all: true },
        orderBy: [
          { _count: { division: "desc" } },
          { division: "asc" },
        ],
      }),
      prisma.user.groupBy({
        by: ["division"],
        where: { ...whereDivisionNotEmpty, isOnOfficialDuty: true },
        _count: { _all: true },
      }),
      prisma.user.groupBy({
        by: ["division"],
        where: { ...whereDivisionNotEmpty, isAnnualHealthCheckDone: true },
        _count: { _all: true },
      }),
      prisma.teacherLeave.findMany({
        where: {
          isOfficialDuty: true,
          status: "APPROVED",
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gte: now } }],
          teacher: whereDivisionNotEmpty,
        },
        select: {
          teacher: { select: { division: true } },
        },
      }),
    ]);

    const divisionMap = new Map();
    for (const row of all) {
      const divisionKey = normalizeDivision(row.division);
      if (!divisionKey) continue;
      divisionMap.set(divisionKey, {
        division: divisionKey,
        total: row._count?._all || 0,
        onOfficialDuty: 0,
        healthChecked: 0,
        officialDutyLeaves: 0,
      });
    }

    const applyCount = (rows, field) => {
      for (const row of rows) {
        const divisionKey = normalizeDivision(row.division);
        if (!divisionKey) continue;
        const target = divisionMap.get(divisionKey);
        if (!target) continue;
        target[field] += row._count?._all || 0;
      }
    };

    applyCount(onDuty, "onOfficialDuty");
    applyCount(healthChecked, "healthChecked");

    for (const leave of officialDutyLeaves) {
      const divisionKey = normalizeDivision(leave.teacher?.division);
      if (!divisionKey) continue;
      const target = divisionMap.get(divisionKey);
      if (!target) continue;
      target.officialDutyLeaves += 1;
    }

    return Array.from(divisionMap.values()).sort(
      (a, b) => b.total - a.total || a.division.localeCompare(b.division)
    );
  },
  getRoleSummary: async () => {
    const grouped = await prisma.user.groupBy({
      by: ["role"],
      _count: { _all: true },
    });
    const countMap = grouped.reduce((acc, row) => {
      acc[row.role] = row._count?._all || 0;
      return acc;
    }, {});

    return ROLE_CODES.map((role) => ({
      role,
      label: ROLE_LABELS[role] || role,
      count: countMap[role] || 0,
    }));
  },
  searchUserPersonalInfo: async ({ query, limit = 100 } = {}) => {
    const normalizedQuery =
      typeof query === "string"
        ? query.trim()
        : query
        ? String(query).trim()
        : "";
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
      "studentClassYear",
      "isOnOfficialDuty",
      "officialDutyNote",
      "isAnnualHealthCheckDone",
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
      if (k === "studentClassYear") {
        const value = normalizeOptionalInteger(v, {
          fieldLabel: "studentClassYear",
        });
        if (value === undefined) continue;
        data.studentClassYear = value;
        continue;
      }
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
      if (k === "isOnOfficialDuty") {
        const flag = normalizeBooleanValue(v);
        if (flag !== undefined) {
          data.isOnOfficialDuty = flag;
        }
        continue;
      }
      if (k === "officialDutyNote") {
        if (v === null) {
          data.officialDutyNote = null;
        } else {
          const note = sanitizeStringValue(v);
          if (note !== undefined) {
            data.officialDutyNote = note;
          }
        }
        continue;
      }
      if (k === "isAnnualHealthCheckDone") {
        const flag = normalizeBooleanValue(v);
        if (flag !== undefined) {
          data.isAnnualHealthCheckDone = flag;
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
    if (
      finalRole === "TEACHER" &&
      (!finalDivision || !String(finalDivision).trim())
    ) {
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
