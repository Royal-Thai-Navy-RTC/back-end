const prisma = require("../utils/prisma");

const normalizeString = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : undefined;
};

const normalizeDate = (value, field) => {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    const err = new Error(`รูปแบบวันที่ ${field} ไม่ถูกต้อง`);
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return d;
};

const normalizeFloat = (value, field) => {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    const err = new Error(`${field} ต้องเป็นตัวเลขไม่ติดลบ`);
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return num;
};

const normalizeBool = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const t = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(t)) return true;
  if (["false", "0", "no", "n"].includes(t)) return false;
  return undefined;
};

const splitList = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const arr = Array.isArray(value)
    ? value
    : String(value)
        .split(/[,|\n\r]/)
        .map((v) => v.trim());
  const filtered = arr.filter((v) => v);
  return filtered.length ? filtered : [];
};

const normalizePostalCode = (value) => {
  const val = normalizeString(value);
  if (val && !/^\d{4,6}$/.test(val)) {
    const err = new Error("รหัสไปรษณีย์ไม่ถูกต้อง");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return val;
};

const normalizeBloodGroup = (value) => {
  const val = normalizeString(value);
  if (!val) return val;
  const normalized = val.toUpperCase();
  const allowed = new Set([
    "A",
    "B",
    "AB",
    "O",
    "A+",
    "A-",
    "B+",
    "B-",
    "AB+",
    "AB-",
    "O+",
    "O-",
  ]);
  if (!allowed.has(normalized)) {
    const err = new Error("หมู่เลือดไม่ถูกต้อง (ระบุเป็น A/B/AB/O หรือมี +/-)");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return normalized;
};

const EDUCATION_OPTIONS = [
  { value: "ปริญญาเอก", label: "ปริญญาเอก" },
  { value: "ปริญญาโท", label: "ปริญญาโท" },
  { value: "ปริญญาตรี", label: "ปริญญาตรี" },
  { value: "ปวช.", label: "ปวช." },
  { value: "ปวส.", label: "ปวส." },
  { value: "มัธยมศึกษาปีที่ 6", label: "มัธยมศึกษาปีที่ 6" },
  { value: "มัธยมศึกษาปีที่ 3", label: "มัธยมศึกษาปีที่ 3" },
  { value: "ประถมศึกษาปีที่ 6", label: "ประถมศึกษาปีที่ 6" },
  { value: "ต่ำกว่าประถมศึกษาปีที่ 6", label: "ต่ำกว่าประถมศึกษาปีที่ 6" },
];

const COMPANY_CODES = ["1", "2", "3", "4", "5"];
const BATTALION_CODES = ["1", "2", "3", "4"];

const buildOrderedCodes = (records, requested = [], key, allowExtra = true) => {
  const seen = new Set();
  const ordered = [];

  for (const code of requested || []) {
    if (code === undefined || code === null) continue;
    const normalized = String(code);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    ordered.push(normalized);
  }

  if (allowExtra) {
    for (const record of records || []) {
      const value = record?.[key];
      if (value === undefined || value === null) continue;
      const normalized = String(value);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      ordered.push(normalized);
    }
  }

  return ordered;
};

const formatComboCounts = (
  records,
  requestedBattalions = [],
  requestedCompanies = [],
  options = {}
) => {
  const battalionCodes = buildOrderedCodes(
    records,
    requestedBattalions,
    "battalionCode",
    options.allowExtraBattalions ?? true
  );
  const companyCodes = buildOrderedCodes(
    records,
    requestedCompanies,
    "companyCode",
    options.allowExtraCompanies ?? true
  );
  const countsMap = new Map();

  for (const record of records || []) {
    const battalion = record?.battalionCode;
    const company = record?.companyCode;
    if (battalion === undefined || battalion === null) continue;
    if (company === undefined || company === null) continue;
    const key = `${battalion}|||${company}`;
    const value = Number(
      record._count?.companyCode ?? record.count?.companyCode ?? 0
    );
    countsMap.set(key, Number.isFinite(value) ? value : 0);
  }

  const result = [];
  for (const battalion of battalionCodes) {
    for (const company of companyCodes) {
      const key = `${battalion}|||${company}`;
      result.push({
        battalionCode: battalion,
        companyCode: company,
        count: countsMap.get(key) ?? 0,
      });
    }
  }

  return result;
};

const formatGroupCounts = (records, fallbackCodes, key) => {
  const countsMap = new Map();

  for (const record of records) {
    const value = Number(record._count?.[key] ?? record.count?.[key] ?? 0);
    const numericValue = Number.isFinite(value) ? value : 0;
    if (record[key] === undefined || record[key] === null) continue;
    countsMap.set(String(record[key]), numericValue);
  }

  const ordered = [];
  const seen = new Set();
  const candidateCodes = [
    ...fallbackCodes,
    ...records
      .map((record) => record[key])
      .filter((code) => code !== undefined && code !== null),
  ];
  for (const code of candidateCodes) {
    const normalized = String(code);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    ordered.push(normalized);
  }

  return ordered.map((code) => ({
    [key]: code,
    count: countsMap.get(code) ?? 0,
  }));
};

const normalizePositiveInt = (value, field) => {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    const err = new Error(`${field} ต้องเป็นจำนวนเต็มบวก`);
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return num;
};

const normalizeInput = (input = {}) => {
  const firstName = normalizeString(input.firstName);
  const lastName = normalizeString(input.lastName);
  const citizenId = normalizeString(input.citizenId);
  const birthDate = normalizeDate(input.birthDate, "birthDate");

  if (!firstName || !lastName || !citizenId || !birthDate) {
    const err = new Error("ต้องระบุ firstName, lastName, citizenId, birthDate");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const weightKg = normalizeFloat(input.weightKg, "น้ำหนัก");
  const heightCm = normalizeFloat(input.heightCm, "ส่วนสูง");
  const canSwim = normalizeBool(input.canSwim);
  const serviceYears = normalizeFloat(input.serviceYears, "อายุรับราชการทหาร");
  const bloodGroup = normalizeBloodGroup(input.bloodGroup);
  const sequenceNumber = normalizePositiveInt(
    input.sequenceNumber,
    "sequenceNumber"
  );
  const platoonCode = normalizePositiveInt(input.platoonCode, "platoonCode");
  // accident: "", boolean
  //   surgery: "", boolean
  //   experience: "", int
  //   familyStatus: "", string
  const tattoo = normalizeBool(input.tattoo);
  const accidentHistory = normalizeBool(input.accidentHistory);
  const surgeryHistory = normalizeBool(input.surgeryHistory);
  const experienced = normalizePositiveInt(input.experienced, "experienced");
  const familyStatus = normalizeString(input.familyStatus);
  const certificates = splitList(input.certificates);

  return {
    firstName,
    lastName,
    citizenId,
    birthDate,
    weightKg,
    heightCm,
    serviceYears,
    bloodGroup,
    battalionCode: normalizeString(input.battalionCode),
    companyCode: normalizeString(input.companyCode),
    platoonCode,
    sequenceNumber,
    education: normalizeString(input.education),
    previousJob: normalizeString(input.previousJob),
    religion: normalizeString(input.religion),
    canSwim,
    specialSkills: normalizeString(input.specialSkills),
    addressLine: normalizeString(input.addressLine),
    province: normalizeString(input.province),
    district: normalizeString(input.district),
    subdistrict: normalizeString(input.subdistrict),
    postalCode: normalizePostalCode(input.postalCode),
    email: normalizeString(input.email),
    phone: normalizeString(input.phone),
    emergencyName: normalizeString(input.emergencyName),
    emergencyPhone: normalizeString(input.emergencyPhone),
    chronicDiseases: splitList(input.chronicDiseases),
    foodAllergies: splitList(input.foodAllergies),
    drugAllergies: splitList(input.drugAllergies),
    medicalNotes: normalizeString(input.medicalNotes),
    idCardImageUrl: normalizeString(input.idCardImageUrl),
    accidentHistory,
    surgeryHistory,
    experienced,
    familyStatus,
    certificates,
    tattoo,
  };
};

const ensureModelAvailable = () => {
  if (!prisma.soldierIntake) {
    const err = new Error(
      "โมเดล SoldierIntake ยังไม่พร้อม (รัน prisma migrate/generate ก่อน)"
    );
    err.code = "MIGRATION_REQUIRED";
    throw err;
  }
};

const clampScore = (val, min = 0, max = 100) =>
  Math.min(max, Math.max(min, Number.isFinite(val) ? val : 0));

const formatRadarScore = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(2));
};

const roundTwoDecimals = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Number(num.toFixed(2));
};

const sanitizeRadarProfile = (radarProfile) => {
  if (!radarProfile) return radarProfile;
  const normalizedValues = Array.isArray(radarProfile.values)
    ? radarProfile.values.map(formatRadarScore)
    : radarProfile.values;
  const normalizedBreakdown = Array.isArray(radarProfile.breakdown)
    ? radarProfile.breakdown.map((item) => ({
        ...item,
        score: formatRadarScore(item.score),
      }))
    : radarProfile.breakdown;
  return {
    ...radarProfile,
    values: normalizedValues,
    breakdown: normalizedBreakdown,
  };
};

const sanitizeCombatReadiness = (combatReadiness) => {
  if (!combatReadiness) return combatReadiness;
  return {
    ...combatReadiness,
    score: roundTwoDecimals(combatReadiness.score),
    percent: roundTwoDecimals(combatReadiness.percent),
  };
};

const computeBmi = (weightKg, heightCm) => {
  const w = Number(weightKg);
  const h = Number(heightCm);
  if (!w || !h) return null;
  const m = h / 100;
  if (!m) return null;
  return w / (m * m);
};

const isMeaningfulHealthValue = (v) => {
  if (v == null) return false;
  const s = v.toString().trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (["ไม่มี", "none", "no", "-", "ไม่ระบุ"].includes(lower)) return false;
  return true;
};

const normalizeListText = (value = "") =>
  String(value)
    .split(/[,|;]/)
    .map((part) => part.trim())
    .filter(Boolean);

const computeAbilityScoreFromItem = (item) => {
  const skillValues = new Set();
  normalizeListText(item.specialSkills).forEach((skill) =>
    skillValues.add(skill.toLowerCase())
  );
  normalizeListText(item.previousJob).forEach((job) =>
    skillValues.add(job.toLowerCase())
  );

  let base = 40;
  base += Math.min(skillValues.size * 8, 40);

  if (Array.isArray(item.certificates)) {
    base += Math.min(item.certificates.length * 3, 20);
  }
  if (item.experienced && Number.isFinite(Number(item.experienced))) {
    base += Math.min(Number(item.experienced) * 2, 10);
  }

  return clampScore(base);
};

// ------------------------------------------
// ฟังก์ชันคำนวณ radar profile
// ------------------------------------------
const buildRadarProfileForItem = (item) => {
  if (!item) return null;

  // ---------- สุขภาพ ----------
  const chronicList = Array.isArray(item?.chronicDiseases)
    ? item.chronicDiseases.filter(isMeaningfulHealthValue)
    : [];
  const foodList = Array.isArray(item?.foodAllergies)
    ? item.foodAllergies.filter(isMeaningfulHealthValue)
    : [];
  const drugList = Array.isArray(item?.drugAllergies)
    ? item.drugAllergies.filter(isMeaningfulHealthValue)
    : [];
  const hasHealthNote = isMeaningfulHealthValue(item?.medicalNotes);

  let healthScore = 100;
  healthScore -= chronicList.length * 10; // โรคประจำตัว
  if (hasHealthNote) healthScore -= 5; // หมายเหตุแพทย์
  const allergyCount = foodList.length + drugList.length;
  healthScore -= allergyCount * 5; // อาการแพ้
  healthScore = clampScore(healthScore, 0, 100);

  // ---------- การศึกษา ----------
  const eduText = (item.education || "").toLowerCase();
  let educationScore = 20;

  if (
    eduText.includes("phd") ||
    eduText.includes("doctor") ||
    eduText.includes("เอก") ||
    eduText.includes("โท") ||
    eduText.includes("master") ||
    eduText.includes("ma") ||
    eduText.includes("msc") ||
    eduText.includes("ตรี") ||
    eduText.includes("bachelor") ||
    eduText.includes("ป.ตรี")
  ) {
    educationScore = 100;
  } else if (eduText.includes("ปวส") || eduText.includes("diploma")) {
    educationScore = 80;
  } else if (
    eduText.includes("ม.6") ||
    eduText.includes("high school") ||
    eduText.includes("มัธยมปลาย")
  ) {
    educationScore = 60;
  } else if (eduText.includes("ม.3") || eduText.includes("มัธยมต้น")) {
    educationScore = 40;
  }
  educationScore = clampScore(educationScore, 0, 100);

  // ---------- ทักษะ ----------
  // ใช้ฟังก์ชันที่เราทำไว้ก่อนหน้า
  const abilityScore = computeAbilityScoreFromItem(item);

  // ---------- ร่างกาย ----------
  const bmi = computeBmi(item.weightKg, item.heightCm);
  let fitnessScore = 0;
  if (bmi) {
    const LOW = 18.5;
    const HIGH = 22.9;
    if (bmi >= LOW && bmi <= HIGH) {
      fitnessScore = 100;
    } else {
      const diff = bmi < LOW ? LOW - bmi : bmi - HIGH;
      fitnessScore = 100 - diff * 5;
    }
  }

  const accidentText = (item.accidentHistory ?? "")
    .toString()
    .trim()
    .toLowerCase();
  const surgeryText = (item.surgeryHistory ?? "")
    .toString()
    .trim()
    .toLowerCase();

  const yesWords = ["true", "yes", "เคย", "มี", "y"];

  const hadAccident = yesWords.some((w) => accidentText.includes(w));
  const hadSurgery = yesWords.some((w) => surgeryText.includes(w));

  if (hadAccident) fitnessScore -= 15;
  if (hadSurgery) fitnessScore -= 15;
  fitnessScore = clampScore(fitnessScore, 0, 100);

  // ---------- ครอบครัว ----------
  const famText = (item.familyStatus || "").toString().trim();
  let familyScoreBase = 70;

  if (famText.includes("บิดา–มารดาอยู่ด้วยกัน")) {
    familyScoreBase = 90;
  } else if (famText.includes("บิดา–มารดาแยกกันอยู่")) {
    familyScoreBase = 80;
  } else if (famText.includes("บิดาและมารดาเสียชีวิต")) {
    familyScoreBase = 60;
  } else if (
    famText.includes("บิดาเสียชีวิต") ||
    famText.includes("มารดาเสียชีวิต")
  ) {
    familyScoreBase = 70;
  }

  const emergencyText = (item.emergencyName || "").toString().toLowerCase();
  let familyDelta = 0;

  const closeWords = [
    "พ่อ",
    "แม่",
    "บิดา",
    "มารดา",
    "สามี",
    "ภรรยา",
    "คู่สมรส",
    "ลูก",
    "บุตร",
    "ปู่",
    "ย่า",
    "ตา",
    "ยาย",
    "พี่",
    "น้อง",
  ];
  const mediumWords = ["ป้า", "อา", "ลุง", "น้า", "ญาติ", "ครอบครัว"];
  const friendWords = ["เพื่อน"];

  if (!emergencyText) {
    familyDelta = -10;
  } else if (closeWords.some((w) => emergencyText.includes(w))) {
    familyDelta = 10;
  } else if (mediumWords.some((w) => emergencyText.includes(w))) {
    familyDelta = 0;
  } else if (friendWords.some((w) => emergencyText.includes(w))) {
    familyDelta = -5;
  } else {
    familyDelta = -5;
  }

  const familyScore = clampScore(familyScoreBase + familyDelta, 0, 100);

  const roundedHealthScore = formatRadarScore(healthScore);
  const roundedEducationScore = formatRadarScore(educationScore);
  const roundedAbilityScore = formatRadarScore(abilityScore);
  const roundedFitnessScore = formatRadarScore(fitnessScore);
  const roundedFamilyScore = formatRadarScore(familyScore);

  return {
    indicators: [
      { name: "สุขภาพ", max: 100 },
      { name: "การศึกษา", max: 100 },
      { name: "ทักษะ", max: 100 },
      { name: "ร่างกาย", max: 100 },
      { name: "ครอบครัว", max: 100 },
    ],
    values: [
      roundedHealthScore,
      roundedEducationScore,
      roundedAbilityScore,
      roundedFitnessScore,
      roundedFamilyScore,
    ],
    breakdown: [
      { label: "สุขภาพ", score: roundedHealthScore },
      { label: "การศึกษา", score: roundedEducationScore },
      { label: "ทักษะ", score: roundedAbilityScore },
      { label: "ร่างกาย", score: roundedFitnessScore },
      { label: "ครอบครัว", score: roundedFamilyScore },
    ],
  };
};

const hasChronicDisease = (item) => {
  const list = Array.isArray(item?.chronicDiseases)
    ? item.chronicDiseases.filter(isMeaningfulHealthValue)
    : [];
  return list.length > 0;
};

const hasAnyAllergy = (item) => {
  const foodList = Array.isArray(item?.foodAllergies)
    ? item.foodAllergies.filter(isMeaningfulHealthValue)
    : [];
  const drugList = Array.isArray(item?.drugAllergies)
    ? item.drugAllergies.filter(isMeaningfulHealthValue)
    : [];
  return foodList.length + drugList.length > 0;
};

const computeAge = (birthDate) => {
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// ใช้เงื่อนไข: ว่ายน้ำได้, อายุ ≤ 23, ไม่มีโรคประจำตัว, ไม่มีรอยสักในร่มผ้า
const isEligibleNcoStudent = (item) => {
  const age = computeAge(item.birthDate);
  if (age == null) return false;

  const canSwim = !!item.canSwim;
  const chronic = hasChronicDisease(item);
  const tattoo = !!item.tattoo; // ถ้า field ชื่ออื่น เปลี่ยนตรงนี้

  return canSwim && age <= 23 && !chronic && !tattoo;
};

// คะแนนความพร้อมรบแบบง่ายๆ 0–100
// (อยากผูกกับ abilityScore จริง ก็ค่อยย้ายสูตรมาใช้แทนได้)
const computeCombatReadinessScore = (item) => {
  let score = 100;

  const age = computeAge(item.birthDate);
  const chronic = hasChronicDisease(item);
  const allergy = hasAnyAllergy(item);
  const canSwim = !!item.canSwim;

  if (chronic) score -= 30;
  if (allergy) score -= 15;
  if (!canSwim) score -= 20;

  if (age != null) {
    if (age < 18 || age > 27) score -= 10;
  }

  // clamp 0–100
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return score;
};

module.exports = {
  createIntake: async (input = {}) => {
    ensureModelAvailable();
    const data = normalizeInput(input);

    const duplicate = await prisma.soldierIntake.findFirst({
      where: { citizenId: data.citizenId },
      select: { id: true },
    });
    if (duplicate) {
      const err = new Error("มีข้อมูลเลขบัตรประชาชนนี้แล้ว");
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    // ✅ คำนวณ radar chart ก่อนเก็บข้อมูล
    const radarProfile = buildRadarProfileForItem(data);

    // ถ้าใน Prisma model ใช้ field Json ชื่อ radarProfile
    data.radarProfile = radarProfile;

    const radarValues = Array.isArray(radarProfile?.values)
      ? radarProfile.values
      : [];
    const radarSum = radarValues.reduce(
      (acc, cur) => acc + (Number.isFinite(cur) ? cur : 0),
      0
    );
    const radarPercent = clampScore(
      radarValues.length ? radarSum / radarValues.length : 0,
      0,
      100
    );

    data.combatReadiness = {
      score: roundTwoDecimals(radarSum),
      percent: roundTwoDecimals(radarPercent),
    };

    // ถ้าตารางเป็น string แทน ให้ใช้แบบนี้แทน:
    // data.radarProfileJson = JSON.stringify(radarProfile);

    return prisma.soldierIntake.create({ data });
  },

  listIntakes: async (filters = {}, battalionCode, companyCode) => {
    ensureModelAvailable();
    const pageSize = Math.max(1, Math.min(Number(filters.pageSize) || 20, 100));
    const page = Math.max(1, Number(filters.page) || 1);
    const skip = (page - 1) * pageSize;

    const where = {};

    battalionCode = normalizeString(filters.battalionCode);
    if (battalionCode) {
      where.battalionCode = battalionCode;
    }

    companyCode = normalizeString(filters.companyCode);
    if (companyCode) {
      where.companyCode = companyCode;
    }
    // console.log(battalionCode, companyCode)
    if (
      filters.platoonCode !== undefined &&
      filters.platoonCode !== null &&
      String(filters.platoonCode).trim() !== ""
    ) {
      const p = Number(filters.platoonCode);
      if (Number.isInteger(p) && p > 0) {
        where.platoonCode = p;
      }
    }

    if (filters.search) {
      const q = String(filters.search).trim();
      if (q) {
        where.OR = [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { citizenId: { contains: q } },
          { phone: { contains: q } },
          { religion: { contains: q } },
          { education: { contains: q } },
        ];
      }
    }

    const [items, total] = await Promise.all([
      prisma.soldierIntake.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.soldierIntake.count({ where }),
    ]);

    const normalizedItems = items.map((item) => ({
      ...item,
      radarProfile: sanitizeRadarProfile(item.radarProfile),
      combatReadiness: sanitizeCombatReadiness(item.combatReadiness),
    }));

    return {
      items: normalizedItems,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  getIntakeById: async (id) => {
    ensureModelAvailable();
    const intakeId = Number(id);
    if (!Number.isInteger(intakeId) || intakeId <= 0) {
      const err = new Error("id ไม่ถูกต้อง");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    const record = await prisma.soldierIntake.findUnique({
      where: { id: intakeId },
    });
    if (!record) {
      const err = new Error("ไม่พบข้อมูล");
      err.code = "NOT_FOUND";
      throw err;
    }
    return {
      ...record,
      radarProfile: sanitizeRadarProfile(record.radarProfile),
      combatReadiness: sanitizeCombatReadiness(record.combatReadiness),
    };
  },

  updateIntake: async (id, input = {}) => {
    ensureModelAvailable();
    const intakeId = Number(id);
    if (!Number.isInteger(intakeId) || intakeId <= 0) {
      const err = new Error("id ไม่ถูกต้อง");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    const data = normalizeInput(input);
    // ตรวจซ้ำ citizenId ถ้ามีการเปลี่ยน
    if (data.citizenId) {
      const duplicate = await prisma.soldierIntake.findFirst({
        where: { citizenId: data.citizenId, NOT: { id: intakeId } },
        select: { id: true },
      });
      if (duplicate) {
        const err = new Error("มีข้อมูลเลขบัตรประชาชนนี้แล้ว");
        err.code = "VALIDATION_ERROR";
        throw err;
      }
    }

    // ✅ คำนวณ radar chart ก่อนเก็บข้อมูล
    const radarProfile = buildRadarProfileForItem(data);

    // ถ้าใน Prisma model ใช้ field Json ชื่อ radarProfile
    data.radarProfile = radarProfile;
    const radarValues = Array.isArray(radarProfile?.values)
      ? radarProfile.values
      : [];
    const radarSum = radarValues.reduce(
      (acc, cur) => acc + (Number.isFinite(cur) ? cur : 0),
      0
    );
    const radarPercent = clampScore(
      radarValues.length ? radarSum / radarValues.length : 0,
      0,
      100
    );

    data.combatReadiness = {
      score: roundTwoDecimals(radarSum),
      percent: roundTwoDecimals(radarPercent),
    };
    return prisma.soldierIntake.update({
      where: { id: intakeId },
      data,
    });
  },

  deleteIntake: async (id) => {
    ensureModelAvailable();
    const intakeId = Number(id);
    if (!Number.isInteger(intakeId) || intakeId <= 0) {
      const err = new Error("id ไม่ถูกต้อง");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    const exists = await prisma.soldierIntake.findUnique({
      where: { id: intakeId },
      select: { id: true },
    });
    if (!exists) {
      const err = new Error("ไม่พบข้อมูล");
      err.code = "NOT_FOUND";
      throw err;
    }
    await prisma.soldierIntake.delete({ where: { id: intakeId } });
  },

  deleteAllIntakes: async () => {
    ensureModelAvailable();
    const deleted = await prisma.soldierIntake.deleteMany({});
    return { deleted: deleted.count };
  },

  summary: async (battalionCode, companyCode) => {
    ensureModelAvailable();

    battalionCode = normalizeString(battalionCode);
    companyCode = normalizeString(companyCode);

    const requestedBattalionCodes = battalionCode
      ? [battalionCode]
      : BATTALION_CODES;
    const requestedCompanyCodes = companyCode ? [companyCode] : COMPANY_CODES;

    const [
      total,
      sixMonths,
      oneYear,
      twoYears,
      educationGroups,
      religionGroups,
    ] = await Promise.all([
      prisma.soldierIntake.count({
        where: { battalionCode, companyCode },
      }),
      prisma.soldierIntake.count({
        where: { serviceYears: { lte: 0.6 }, battalionCode, companyCode },
      }),
      prisma.soldierIntake.count({
        where: { serviceYears: { equals: 1 }, battalionCode, companyCode },
      }),
      prisma.soldierIntake.count({
        where: { serviceYears: { equals: 2 }, battalionCode, companyCode },
      }),
      prisma.soldierIntake.groupBy({
        by: ["education"],
        _count: { education: true },
        where: { education: { not: null }, battalionCode, companyCode },
      }),
      prisma.soldierIntake.groupBy({
        by: ["religion"],
        _count: { religion: true },
        where: { religion: { not: null }, battalionCode, companyCode },
      }),
    ]);

    const educationCounts = EDUCATION_OPTIONS.map((option) => {
      const matched = educationGroups.find(
        (item) => item.education === option.value
      );
      return { ...option, count: matched?._count.education || 0 };
    });

    const religionCounts = religionGroups
      .filter((item) => item.religion)
      .map((item) => ({
        value: item.religion,
        label: item.religion,
        count: item._count.religion || 0,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    const canSwimCount = await prisma.soldierIntake.count({
      where: { canSwim: true, battalionCode, companyCode },
    });

    const companyWhere = {
      companyCode: companyCode ? companyCode : { not: null },
    };
    if (battalionCode) {
      companyWhere.battalionCode = battalionCode;
    }

    const companyCountsRaw = await prisma.soldierIntake.groupBy({
      by: ["battalionCode", "companyCode"],
      _count: { companyCode: true },
      where: companyWhere,
    });

    const battalionCountsRaw = await prisma.soldierIntake.groupBy({
      by: ["battalionCode"],
      _count: { battalionCode: true },
      where: { battalionCode: { not: null } },
    });

    const companyCounts = formatComboCounts(
      companyCountsRaw,
      requestedBattalionCodes,
      requestedCompanyCodes,
      {
        allowExtraBattalions: !battalionCode,
        allowExtraCompanies: !companyCode,
      }
    );

    const battalionCounts = formatGroupCounts(
      battalionCountsRaw,
      BATTALION_CODES,
      "battalionCode"
    );

    const bloodGroupCounts = await prisma.soldierIntake
      .groupBy({
        by: ["bloodGroup"],
        _count: { bloodGroup: true },
        where: { bloodGroup: { not: null }, battalionCode, companyCode },
      })
      .then((groups) =>
        formatGroupCounts(
          groups,
          [
            "A",
            "B",
            "AB",
            "O",
            "A+",
            "A-",
            "B+",
            "B-",
            "AB+",
            "AB-",
            "O+",
            "O-",
          ],
          "bloodGroup"
        )
      );

    // ---------- สรุปอายุ/สิทธิ์ นร.จ./โรคประจำตัว/แพ้/พร้อมรบ + religion per company ----------

    const readinessRows = await prisma.soldierIntake.findMany({
      where: { battalionCode, companyCode },
      select: {
        id: true,
        battalionCode: true,
        companyCode: true,
        birthDate: true,
        chronicDiseases: true,
        foodAllergies: true,
        drugAllergies: true,
        canSwim: true,
        tattoo: true, // ถ้า field ชื่ออื่น แก้ตรงนี้
        religion: true,
        bloodGroup: true,
        serviceYears: true,
        canSwim: true,
      },
    });

    const summaryMap = new Map();

    const getKey = (bat, com) => `${bat || ""}-${com || ""}`;

    // base จาก companyCounts ให้มีทุกกองร้อย
    companyCounts.forEach((item) => {
      const key = getKey(item.battalionCode, item.companyCode);
      summaryMap.set(key, {
        battalionCode: item.battalionCode || null,
        companyCode: item.companyCode || null,
        count: item.count || 0,
        // ageTotal: 0,
        // ageMin: null,
        // ageMax: null,
        // ageCount: 0,
        ages: [],
        eligibleNcoCount: 0,
        chronicDiseaseCount: 0,
        allergyCount: 0,
        combatScoreTotal: 0,
        combatScoreCount: 0,
        combatHighCount: 0,
        religionCountsMap: new Map(),
        bloodGroupCountsMap: new Map(),
        serviceYearsCountsMap: new Map(),
        canSwimCountsMap: new Map(),
      });
    });

    readinessRows.forEach((row) => {
      const key = getKey(row.battalionCode, row.companyCode);
      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          battalionCode: row.battalionCode || null,
          companyCode: row.companyCode || null,
          count: 0,
          // ageTotal: 0,
          // ageMin: null,
          // ageMax: null,
          // ageCount: 0,
          ages: [],
          eligibleNcoCount: 0,
          chronicDiseaseCount: 0,
          allergyCount: 0,
          combatScoreTotal: 0,
          combatScoreCount: 0,
          combatHighCount: 0,
          religionCountsMap: new Map(),
          bloodGroupCountsMap: new Map(),
          serviceYearsCountsMap: new Map(),
          canSwimCountsMap: new Map(),
        });
      }

      const summary = summaryMap.get(key);

      summary.count += 1;

      const age = computeAge(row.birthDate);
      if (age != null) {
        summary.ages.push(age);
      }

      if (hasChronicDisease(row)) {
        summary.chronicDiseaseCount += 1;
      }

      if (hasAnyAllergy(row)) {
        summary.allergyCount += 1;
      }

      if (isEligibleNcoStudent(row)) {
        summary.eligibleNcoCount += 1;
      }

      const combatScore = computeCombatReadinessScore(row);
      summary.combatScoreTotal += combatScore;
      summary.combatScoreCount += 1;
      if (combatScore >= 70) {
        summary.combatHighCount += 1;
      }

      if (row.religion) {
        const current = summary.religionCountsMap.get(row.religion) || 0;
        summary.religionCountsMap.set(row.religion, current + 1);
      }

      if (row.bloodGroup) {
        const current = summary.bloodGroupCountsMap.get(row.bloodGroup) || 0;
        summary.bloodGroupCountsMap.set(row.bloodGroup, current + 1);
      }

      if (row.serviceYears != null) {
        const sy = String(row.serviceYears);
        const current = summary.serviceYearsCountsMap.get(sy) || 0;
        summary.serviceYearsCountsMap.set(sy, current + 1);
      }

      if (row.canSwim != null) {
        const cs = !!row.canSwim;
        const current = summary.canSwimCountsMap.get(cs) || 0;
        summary.canSwimCountsMap.set(cs, current + 1);
      }
    });

    const companySummaries = Array.from(summaryMap.values())
      .map((item) => {
        const avgCombat =
          item.combatScoreCount > 0
            ? item.combatScoreTotal / item.combatScoreCount
            : null;

        const religionCounts = Array.from(item.religionCountsMap.entries())
          .map(([value, count]) => ({
            value,
            label: value,
            count,
          }))
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

        const bloodGroupCounts = Array.from(item.bloodGroupCountsMap?.entries() || [])
          .map(([value, count]) => ({
            value,
            label: value,
            count,
          }))
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

        const serviceYearsCounts = Array.from(item.serviceYearsCountsMap?.entries() || [])
          .map(([value, count]) => ({
            value,
            label: value,
            count,
          }))
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

        const canSwimCounts = Array.from(item.canSwimCountsMap?.entries() || [])
          .map(([value, count]) => ({
            value,
            label: value ? "ว่ายน้ำได้" : "ว่ายน้ำไม่ได้",
            count,
          }))
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

        return {
          battalionCode: item.battalionCode,
          companyCode: item.companyCode,
          // count: item.count,

          age: item.ages,

          eligibleNcoCount: item.eligibleNcoCount, // นรจ. ที่มีสิทธิ์
          chronicDiseaseCount: item.chronicDiseaseCount, // มีโรคประจำตัว
          allergyCount: item.allergyCount, // มีอาการแพ้
          combatReadinessAvg: avgCombat, // คะแนนความพร้อมรบเฉลี่ย
          combatHighCount: item.combatHighCount, //จำนวนคนที่พร้อมรบสูง (≥ 70 คะแนน)
          religionCounts,
          bloodGroupCounts,
          serviceYearsCounts,
          canSwimCounts,
        };
      })
      .sort((a, b) => {
        const batA = Number(a.battalionCode || 0);
        const batB = Number(b.battalionCode || 0);
        if (batA !== batB) return batA - batB;

        const comA = Number(a.companyCode || 0);
        const comB = Number(b.companyCode || 0);
        return comA - comB;
      });

    return {
      total,
      sixMonths,
      oneYear,
      twoYears,
      educationCounts,
      religionCounts,
      canSwimCount,
      companyCounts,
      battalionCounts,
      bloodGroupCounts,
      companySummaries,
    };
  },

  importUnitAssignments: async (records = []) => {
    ensureModelAvailable();
    if (!Array.isArray(records) || records.length === 0) {
      const err = new Error("ไม่พบข้อมูลในไฟล์");
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const result = { updated: 0, notFound: 0, skipped: 0 };

    for (const row of records) {
      const citizenId =
        typeof row.citizenId === "string" || typeof row.citizenId === "number"
          ? String(row.citizenId).trim()
          : "";
      if (!citizenId) {
        result.skipped += 1;
        continue;
      }
      const target = await prisma.soldierIntake.findFirst({
        where: { citizenId },
        select: { id: true },
      });
      if (!target) {
        result.notFound += 1;
        continue;
      }

      const data = {};
      if (
        row.battalionCode !== undefined &&
        row.battalionCode !== null &&
        row.battalionCode !== ""
      ) {
        data.battalionCode = String(row.battalionCode).trim();
      }
      if (
        row.companyCode !== undefined &&
        row.companyCode !== null &&
        row.companyCode !== ""
      ) {
        data.companyCode = String(row.companyCode).trim();
      }
      if (
        row.platoonCode !== undefined &&
        row.platoonCode !== null &&
        row.platoonCode !== ""
      ) {
        const platoon = Number(row.platoonCode);
        if (!Number.isInteger(platoon) || platoon <= 0) {
          result.skipped += 1;
          continue;
        }
        data.platoonCode = platoon;
      }
      if (
        row.sequenceNumber !== undefined &&
        row.sequenceNumber !== null &&
        row.sequenceNumber !== ""
      ) {
        const seq = Number(row.sequenceNumber);
        if (!Number.isInteger(seq) || seq <= 0) {
          result.skipped += 1;
          continue;
        }
        data.sequenceNumber = seq;
      }

      if (Object.keys(data).length === 0) {
        result.skipped += 1;
        continue;
      }

      await prisma.soldierIntake.update({
        where: { id: target.id },
        data,
      });
      result.updated += 1;
    }

    return result;
  },
};
