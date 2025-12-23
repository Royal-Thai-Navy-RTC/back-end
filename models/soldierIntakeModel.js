const prisma = require("../utils/prisma");
const { Prisma } = require("../generated/prisma");

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
  const unknownTokens = new Set([
    "ไม่ทราบ",
    "UNKNOWN",
    "NOT KNOWN",
    "N/A",
    "NA",
  ]);
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
  if (unknownTokens.has(normalized) || unknownTokens.has(val)) {
    return "ไม่ทราบ";
  }
  if (!allowed.has(normalized)) {
    const err = new Error(
      "หมู่เลือดไม่ถูกต้อง (ระบุเป็น A/B/AB/O หรือมี +/- หรือใส่ 'ไม่ทราบ')"
    );
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

const MAJOR_RELIGIONS = ["พุทธ", "อิสลาม", "คริสต์"];

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

const normalizeNonNegativeInt = (value, field) => {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) {
    const err = new Error(`${field} ต้องเป็นจำนวนเต็มศูนย์หรือบวก`);
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return num;
};

const toBuddhistYear = (yearNumber) => {
  if (!Number.isFinite(yearNumber)) return null;
  const intYear = Math.round(yearNumber);
  if (intYear < 100) return 2500 + intYear; // short form 68 -> 2568
  if (intYear < 2500) return intYear + 543; // assume Gregorian -> convert
  return intYear;
};

const parseIntakeShiftValue = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  if (!text) return null;
  const numbers = text.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;
  const shiftNum = Number(numbers[0]);
  if (!Number.isInteger(shiftNum) || shiftNum < 1 || shiftNum > 4) return null;

  let buddhistYear = null;
  if (numbers.length >= 2) {
    const candidateYear = Number(numbers[1]);
    const normalizedYear = toBuddhistYear(candidateYear);
    if (normalizedYear && Number.isInteger(normalizedYear)) {
      buddhistYear = normalizedYear;
    }
  }

  return { shift: shiftNum, buddhistYear };
};

const formatIntakeShiftValue = (shift, buddhistYear) => {
  if (!Number.isInteger(shift) || shift < 1 || shift > 4) return undefined;
  if (!Number.isInteger(buddhistYear)) return String(shift);
  const shortYear = String(buddhistYear).slice(-2);
  return `${shift}/${shortYear}`;
};

const determineIntakeShiftNumber = (date = new Date()) => {
  const ref = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(ref.getTime())) return null;
  const month = ref.getMonth() + 1; // 1-12
  if (month >= 5 && month <= 7) return 1; // พ.ค. - ก.ค.
  if (month >= 8 && month <= 10) return 2; // ส.ค. - ต.ค.
  if (month === 11 || month === 12 || month === 1) return 3; // พ.ย. - ม.ค.
  return 4; // ก.พ. - เม.ย.
};

const determineIntakeShiftYear = (date = new Date(), shiftNumber) => {
  const ref = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(ref.getTime())) return null;
  const buddhistYear = ref.getFullYear() + 543;
  const shift = Number(shiftNumber);
  if (shift === 4) {
    // ผลัด 4 ถือเป็นรุ่นของปีก่อนหน้า (รายงานตัว ก.พ. ปีถัดไป)
    return buddhistYear - 1;
  }
  return buddhistYear;
};

const normalizeIntakeShift = (value, options = {}) => {
  const parsed = parseIntakeShiftValue(value);
  if (!parsed) return undefined;
  const shift = parsed.shift;
  const refDate =
    options.referenceDate instanceof Date ? options.referenceDate : new Date();
  const year =
    parsed.buddhistYear ??
    determineIntakeShiftYear(refDate, shift) ??
    null;
  if (!Number.isInteger(shift) || shift < 1 || shift > 4) {
    const err = new Error("intakeShift ต้องเป็น 1, 2, 3 หรือ 4");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  if (year && !Number.isInteger(year)) {
    const err = new Error("intakeShift year ไม่ถูกต้อง");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return formatIntakeShiftValue(shift, year);
};

const determineIntakeShift = (date = new Date()) => {
  const shift = determineIntakeShiftNumber(date);
  if (!shift) return undefined;
  const year = determineIntakeShiftYear(date, shift);
  return formatIntakeShiftValue(shift, year);
};

const buildIntakeShiftWhere = (value) => {
  const parsed = parseIntakeShiftValue(value);
  if (!parsed) return null;
  const formatted = parsed.buddhistYear
    ? formatIntakeShiftValue(parsed.shift, parsed.buddhistYear)
    : null;
  if (formatted) {
    // รองรับรูปแบบเก่า (มีวงเล็บ) แบบ startsWith
    return {
      OR: [
        { intakeShift: { equals: formatted } },
        { intakeShift: { startsWith: `${formatted} (` } },
      ],
    };
  }
  // ถ้าไม่ได้ระบุปี ให้ filter ตามเลขผลัด (prefix)
  return { intakeShift: { startsWith: `${parsed.shift}/` } };
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
  const familyStatus = normalizeString(input.familyStatus);
  const certificates = splitList(input.certificates);
  const experienced = normalizeNonNegativeInt(input.experienced, "experienced");

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
    intakeShift: normalizeIntakeShift(input.intakeShift),
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

const applyStringContainsFilter = (where, field, value) => {
  const normalized = normalizeString(value);
  if (!normalized) return;
  where[field] = {
    contains: normalized,
  };
};

const applyJsonArrayContainsFilter = (where, field, value) => {
  const normalized = normalizeString(value);
  if (!normalized) return;
  where[field] = {
    array_contains: [normalized],
  };
};

const buildIntakeWhereClause = (filters = {}) => {
  const where = {};

  const ensureAnd = () => {
    if (!where.AND) where.AND = [];
    return where.AND;
  };

  const battalionCode = normalizeString(filters?.battalionCode);
  if (battalionCode) {
    where.battalionCode = battalionCode;
  }

  const companyCode = normalizeString(filters?.companyCode);
  if (companyCode) {
    where.companyCode = companyCode;
  }

  const intakeShiftWhere = buildIntakeShiftWhere(filters?.intakeShift);
  if (intakeShiftWhere) {
    const and = ensureAnd();
    and.push(intakeShiftWhere);
  }

  if (
    filters?.platoonCode !== undefined &&
    filters?.platoonCode !== null &&
    String(filters.platoonCode).trim() !== ""
  ) {
    const platoonValue = Number(filters.platoonCode);
    if (Number.isInteger(platoonValue) && platoonValue > 0) {
      where.platoonCode = platoonValue;
    }
  }

  if (
    filters?.sequenceNumber !== undefined &&
    filters?.sequenceNumber !== null &&
    String(filters.sequenceNumber).trim() !== ""
  ) {
    const seqValue = Number(filters.sequenceNumber);
    if (Number.isInteger(seqValue) && seqValue > 0) {
      where.sequenceNumber = seqValue;
    }
  }

  if (filters?.search) {
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
  if (filters?.hasSpecialSkills === true) {
    where.specialSkills = { not: null };
  } else if (filters?.hasSpecialSkills === false) {
    where.specialSkills = null;
  }

  if (filters?.hasChronicDiseases === true) {
    const and = ensureAnd();
    and.push({ chronicDiseases: { not: null } });
    and.push({ chronicDiseases: { not: [] } });
  } else if (filters?.hasChronicDiseases === false) {
    const and = ensureAnd();
    and.push({
      OR: [
        { chronicDiseases: { equals: null } },
        { chronicDiseases: { equals: [] } },
      ],
    });
  }

  if (filters?.religionOther) {
    where.religion = {
      notIn: MAJOR_RELIGIONS,
    };
  } else {
    applyStringContainsFilter(where, "religion", filters.religion);
  }
  // province: now expect numeric code; if digits, match exact; else fallback to contains
  if (filters?.province !== undefined && filters?.province !== null) {
    const provinceText = String(filters.province).trim();
    if (provinceText) {
      if (/^\d+$/.test(provinceText)) {
        where.province = provinceText;
      } else {
        applyStringContainsFilter(where, "province", provinceText);
      }
    }
  }
  applyStringContainsFilter(where, "education", filters.education);
  applyStringContainsFilter(where, "bloodGroup", filters.bloodGroup);

  if (
    filters?.serviceYears !== undefined &&
    filters?.serviceYears !== null &&
    Number.isFinite(Number(filters.serviceYears))
  ) {
    where.serviceYears = Number(filters.serviceYears);
  }

  return where;
};

const buildEducationCountsFromMap = (countsMap = new Map()) => {
  const mapInstance = countsMap instanceof Map ? countsMap : new Map();
  const baseCounts = EDUCATION_OPTIONS.map((option) => ({
    ...option,
    count: mapInstance.get(option.value) || 0,
  }));
  const extraCounts = [];
  for (const [value, count] of mapInstance.entries()) {
    if (!value) continue;
    if (EDUCATION_OPTIONS.some((option) => option.value === value)) continue;
    extraCounts.push({ value, label: value, count });
  }
  extraCounts.sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label)
  );
  return extraCounts.length ? baseCounts.concat(extraCounts) : baseCounts;
};

const parseCombatReadinessSort = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  const descKeywords = new Set([
    "desc",
    "descending",
    "high-to-low",
    "high to low",
    "from-high",
    "มากไปน้อย",
    "มาก",
    "max",
    "high",
  ]);
  const ascKeywords = new Set([
    "asc",
    "ascending",
    "low-to-high",
    "low to high",
    "from-low",
    "น้อยไปมาก",
    "น้อย",
    "min",
    "low",
  ]);
  if (descKeywords.has(normalized)) return "desc";
  if (ascKeywords.has(normalized)) return "asc";
  return null;
};

const normalizeIntakeRecords = (records = []) =>
  records.map((record) => ({
    ...record,
    radarProfile: sanitizeRadarProfile(record.radarProfile),
    combatReadiness: sanitizeCombatReadiness(record.combatReadiness),
  }));

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

// เทียบเท่า isMeaningfulHealthValue แบบใช้งานจริง
const isMeaningfulHealthValue = (v) => {
  if (v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  if (!s) return false;

  // ค่าที่ถือว่า "ไม่มี/ไม่ระบุ"
  const NO = new Set([
    "-",
    "ไม่",
    "ไม่มี",
    "ไม่มีโรค",
    "ไม่มีโรคประจำตัว",
    "none",
    "n/a",
    "na",
    "null",
  ]);

  return !NO.has(s);
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
  const bd = new Date(birthDate);
  if (Number.isNaN(bd.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
  return age;
};

const EDUCATION_MIN_M6 = [
  "ม.6",
  "ม 6",
  "มัธยมศึกษาปีที่ 6",
  "มัธยมปลาย",
  "ปวช",
  "ปวช.",
  "ปวส",
  "ปวส.",
  "อนุปริญญา",
  "ปริญญาตรี",
  "ปริญญาโท",
  "ปริญญาเอก",
];

const isEducationEligible = (item) => {
  const edu = (item?.education ?? "").toString().trim();
  if (!edu) return false;
  return EDUCATION_MIN_M6.some((kw) => edu.includes(kw));
};

const isEligibleNcoStudent = (item) => {
  const age = computeAge(item.birthDate);
  if (age == null) return false;

  const canSwim = !!item.canSwim;
  const chronic = hasChronicDisease(item);
  const tattoo = !!item.tattoo;

  const eduOk = isEducationEligible(item);

  return canSwim && age <= 24 && !chronic && !tattoo && eduOk;
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
      const err = new Error(
        "มีข้อมูลเลขบัตรประชาชนนี้แล้ว, คุณเพิ่มข้อมูลไปก่อนหน้าแล้ว"
      );
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

    if (!data.intakeShift) {
      data.intakeShift = determineIntakeShift(new Date());
    }

    // ถ้าตารางเป็น string แทน ให้ใช้แบบนี้แทน:
    // data.radarProfileJson = JSON.stringify(radarProfile);

    return prisma.soldierIntake.create({ data });
  },

  listIntakes: async (filters = {}) => {
    ensureModelAvailable();

    const combatReadinessSort = parseCombatReadinessSort(
      filters.combatReadinessSort
    );
    // const pageSize = Math.max(1, Math.min(Number(filters.pageSize) || 10, 100));
    // ไม่จำกัด pageSize ตอนนี้
    const pageSize = Math.max(1, Math.min(Number(filters.pageSize) || 10, 3000));
    const page = Math.max(1, Number(filters.page) || 1);
    const skip = (page - 1) * pageSize;

    const whereFilters = { ...filters };
    delete whereFilters.combatReadinessSort;

    const eligibleNcoMode = whereFilters.eligibleNcoMode; // "eligible" | "ineligible"
    delete whereFilters.eligibleNcoMode;

    // Prisma where ปกติ (ตาม filter ทั่วไป)
    const where = buildIntakeWhereClause(whereFilters);

    // -----------------------------
    // Summary/Graph-equivalent logic
    // -----------------------------
    const isMeaningfulHealthValue = (v) => {
      if (v === undefined || v === null) return false;
      const s = String(v).trim().toLowerCase();
      if (!s) return false;

      const NO = new Set([
        "-",
        "ไม่",
        "ไม่มี",
        "ไม่มีโรค",
        "ไม่มีโรคประจำตัว",
        "none",
        "n/a",
        "na",
        "null",
      ]);

      return !NO.has(s);
    };

    const hasChronicDisease = (item) => {
      const list = Array.isArray(item?.chronicDiseases)
        ? item.chronicDiseases.filter(isMeaningfulHealthValue)
        : [];
      return list.length > 0;
    };

    const computeAge = (birthDate) => {
      if (!birthDate) return null;
      const bd = new Date(birthDate);
      if (Number.isNaN(bd.getTime())) return null;

      const today = new Date();
      let age = today.getFullYear() - bd.getFullYear();
      const m = today.getMonth() - bd.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
      return age;
    };

    const EDUCATION_MIN_M6 = [
      "ม.6",
      "ม 6",
      "มัธยมศึกษาปีที่ 6",
      "มัธยมปลาย",
      "ปวช",
      "ปวช.",
      "ปวส",
      "ปวส.",
      "อนุปริญญา",
      "ปริญญาตรี",
      "ปริญญาโท",
      "ปริญญาเอก",
    ];

    const isEducationEligible = (item) => {
      const edu = (item?.education ?? "").toString().trim();
      if (!edu) return false;
      return EDUCATION_MIN_M6.some((kw) => edu.includes(kw));
    };

    // ✅ เงื่อนไขจริง: ว่ายน้ำได้, อายุ ≤ 24, ไม่มีโรคประจำตัว(meaningful), ไม่มีรอยสัก, การศึกษา ม.6 ขึ้นไป
    const isEligibleNcoStudent = (item) => {
      const age = computeAge(item.birthDate);
      if (age == null) return false;

      const canSwim = !!item.canSwim; // null/false => false
      const chronic = hasChronicDisease(item); // meaningful array => true
      const tattoo = !!item.tattoo; // null/false => false
      const eduOk = isEducationEligible(item);

      return canSwim && age <= 24 && !chronic && !tattoo && eduOk;
    };

    // -----------------------------
    // 1) Combat readiness sort (ต้องเอาทั้งชุดมาจัดเรียง)
    // -----------------------------
    if (combatReadinessSort) {
      // ดึงทั้งหมดตาม where ก่อน แล้วค่อย sort+filter+paginate ใน JS
      const items = await prisma.soldierIntake.findMany({ where });
      let normalizedItems = normalizeIntakeRecords(items);

      // คำนวณ eligibility ให้ตรงกับกราฟ
      normalizedItems = normalizedItems.map((it) => ({
        ...it,
        isEligibleNcoStudent: isEligibleNcoStudent(it),
      }));

      if (eligibleNcoMode === "eligible") {
        normalizedItems = normalizedItems.filter((x) => x.isEligibleNcoStudent);
      } else if (eligibleNcoMode === "ineligible") {
        normalizedItems = normalizedItems.filter(
          (x) => !x.isEligibleNcoStudent
        );
      }

      const getScore = (row) => {
        const rawScore = row?.combatReadiness?.score;
        if (Number.isFinite(rawScore)) return rawScore;
        const rawPercent = row?.combatReadiness?.percent;
        if (Number.isFinite(rawPercent)) return rawPercent;
        return 0;
      };

      const sortedItems = normalizedItems.sort((a, b) => {
        const diff = getScore(a) - getScore(b);
        return combatReadinessSort === "asc" ? diff : -diff;
      });

      const pagedItems = sortedItems.slice(skip, skip + pageSize);
      const total = sortedItems.length;

      return {
        items: pagedItems,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    }

    // hasSpecialSkills filter hasSpecialSkills
    if (filters.hasSpecialSkills === true) {
      const and = where.AND || [];
      and.push({ specialSkills: { not: null } });
      and.push({ specialSkills: { not: "" } });
      and.push({ specialSkills: { not: "-" } });
      and.push({ specialSkills: { not: "ไม่มี" } });
      where.AND = and;
    } else if (filters.hasSpecialSkills === false) {
      const and = where.AND || [];
      and.push({ specialSkills: null });
      where.AND = and;
    }

    // -----------------------------
    // 2) Normal list (ให้ตารางตรงกับกราฟ)
    // -----------------------------
    // ดึงทั้งหมดตาม where ก่อน แล้ว filter eligible/ineligible ใน JS เพื่อให้ตรงกับ meaningful logic
    const items = await prisma.soldierIntake.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    let normalizedItems = normalizeIntakeRecords(items);

    normalizedItems = normalizedItems.map((it) => ({
      ...it,
      isEligibleNcoStudent: isEligibleNcoStudent(it),
    }));

    if (eligibleNcoMode === "eligible") {
      normalizedItems = normalizedItems.filter((x) => x.isEligibleNcoStudent);
    } else if (eligibleNcoMode === "ineligible") {
      normalizedItems = normalizedItems.filter((x) => !x.isEligibleNcoStudent);
    }

    const total = normalizedItems.length;
    const pagedItems = normalizedItems.slice(skip, skip + pageSize);

    return {
      items: pagedItems,
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

  getIntakeByCitizenId: async (citizenId, filters = {}) => {
    ensureModelAvailable();
    const normalizedCitizenId = normalizeString(citizenId);
    if (!normalizedCitizenId) {
      const err = new Error("citizenId ไม่ถูกต้อง");
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const where = { citizenId: normalizedCitizenId };
    const battalion = normalizeString(filters.battalionCode);
    const company = normalizeString(filters.companyCode);
    if (battalion) where.battalionCode = battalion;
    if (company) where.companyCode = company;

    const record = await prisma.soldierIntake.findFirst({
      where,
      orderBy: { createdAt: "desc" },
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

  getIntakeByUnitCode: async (unitCode, filters = {}) => {
    ensureModelAvailable();
    const code = normalizeString(unitCode);
    if (!code || !/^\d{5}$/.test(code)) {
      const err = new Error("unitCode ต้องเป็นตัวเลข 5 หลัก");
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const battalionCode = code[0];
    const companyCode = code[1];
    const platoonCode = Number(code[2]);
    const sequenceNumber = Number(code.slice(3));

    if (!Number.isInteger(platoonCode) || platoonCode <= 0) {
      const err = new Error("platoonCode ไม่ถูกต้อง");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    if (!Number.isInteger(sequenceNumber) || sequenceNumber <= 0) {
      const err = new Error("sequenceNumber ไม่ถูกต้อง");
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const where = {
      battalionCode,
      companyCode,
      platoonCode,
      sequenceNumber,
    };

    const unitBattalion = normalizeString(filters.battalionCode);
    const unitCompany = normalizeString(filters.companyCode);
    if (unitBattalion) where.battalionCode = unitBattalion;
    if (unitCompany) where.companyCode = unitCompany;

    const record = await prisma.soldierIntake.findFirst({
      where,
      orderBy: { createdAt: "desc" },
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
      select: { id: true, idCardImageUrl: true },
    });
    if (!exists) {
      const err = new Error("ไม่พบข้อมูล");
      err.code = "NOT_FOUND";
      throw err;
    }
    await prisma.soldierIntake.delete({ where: { id: intakeId } });
    return { idCardImageUrl: exists.idCardImageUrl || null };
  },

  deleteAllIntakes: async () => {
    ensureModelAvailable();
    const rows = await prisma.soldierIntake.findMany({
      select: { idCardImageUrl: true },
    });
    const deleted = await prisma.soldierIntake.deleteMany({});
    const idCardImageUrls = rows
      .map((row) => row?.idCardImageUrl)
      .filter((url) => url != null && String(url).trim() !== "");
    return { deleted: deleted.count, idCardImageUrls };
  },

  getIntakesForExport: async (filters = {}) => {
    ensureModelAvailable();
    const where = buildIntakeWhereClause(filters);
    const items = await prisma.soldierIntake.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return items.map((item) => ({
      ...item,
      radarProfile: sanitizeRadarProfile(item.radarProfile),
      combatReadiness: sanitizeCombatReadiness(item.combatReadiness),
    }));
  },

  summary: async (battalionCode, companyCode) => {
    ensureModelAvailable();

    battalionCode = normalizeString(battalionCode);
    companyCode = normalizeString(companyCode);

    const requestedBattalionCodes = battalionCode
      ? [battalionCode]
      : BATTALION_CODES;
    const requestedCompanyCodes = companyCode ? [companyCode] : COMPANY_CODES;

    // ดึงข้อมูลครั้งเดียวแล้วรวมสถิติในหน่วยความจำ ลดรอบ query ให้เร็วขึ้น
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
        tattoo: true,
        religion: true,
        bloodGroup: true,
        serviceYears: true,
        education: true,
      },
    });

    const total = readinessRows.length;
    if (total === 0) {
      return {
        total: 0,
        sixMonths: 0,
        oneYear: 0,
        twoYears: 0,
        educationCounts: buildEducationCountsFromMap(new Map()),
        religionCounts: [],
        canSwimCount: 0,
        companyCounts: formatComboCounts(
          [],
          requestedBattalionCodes,
          requestedCompanyCodes,
          {
            allowExtraBattalions: !battalionCode,
            allowExtraCompanies: !companyCode,
          }
        ),
        battalionCounts: formatGroupCounts([], BATTALION_CODES, "battalionCode"),
        bloodGroupCounts: formatGroupCounts(
          [],
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
        ),
        companySummaries: [],
      };
    }

    let sixMonths = 0;
    let oneYear = 0;
    let twoYears = 0;
    let canSwimCount = 0;

    const educationCountsMap = new Map();
    const religionCountsMap = new Map();
    const bloodGroupCountsMap = new Map();
    const battalionCountsMap = new Map();
    const companyCountsMap = new Map();

    const summaryMap = new Map();

    const getKey = (bat, com) => `${bat || ""}-${com || ""}`;

    // เตรียมช่องว่างสำหรับกองพัน/กองร้อยที่ร้องขอทั้งหมด
    requestedBattalionCodes.forEach((bat) => {
      requestedCompanyCodes.forEach((com) => {
        const key = getKey(bat, com);
        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            battalionCode: bat || null,
            companyCode: com || null,
            count: 0,
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
            educationCountsMap: new Map(),
          });
        }
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
          educationCountsMap: new Map(),
        });
      }

      const summary = summaryMap.get(key);

      summary.count += 1;

      // รวม count กลางไปด้วย (ลดรอบ query)
      if (row.serviceYears != null) {
        const sy = Number(row.serviceYears);
        if (Number.isFinite(sy)) {
          if (sy <= 0.6) sixMonths += 1;
          if (sy === 1) oneYear += 1;
          if (sy === 2) twoYears += 1;
        }
      }

      if (row.education) {
        const normalized = String(row.education).trim();
        if (normalized) {
          educationCountsMap.set(
            normalized,
            (educationCountsMap.get(normalized) || 0) + 1
          );
        }
      }

      if (row.religion) {
        const normalized = String(row.religion).trim();
        if (normalized) {
          religionCountsMap.set(normalized, (religionCountsMap.get(normalized) || 0) + 1);
        }
      }

      if (row.bloodGroup) {
        const normalized = String(row.bloodGroup).trim();
        if (normalized) {
          bloodGroupCountsMap.set(
            normalized,
            (bloodGroupCountsMap.get(normalized) || 0) + 1
          );
        }
      }

      if (row.battalionCode) {
        const normalized = String(row.battalionCode).trim();
        if (normalized) {
          battalionCountsMap.set(
            normalized,
            (battalionCountsMap.get(normalized) || 0) + 1
          );
        }
      }

      if (row.battalionCode && row.companyCode) {
        const bat = String(row.battalionCode).trim();
        const com = String(row.companyCode).trim();
        if (bat && com) {
          const keyCompany = `${bat}|||${com}`;
          companyCountsMap.set(
            keyCompany,
            (companyCountsMap.get(keyCompany) || 0) + 1
          );
        }
      }

      if (row.canSwim === true) {
        canSwimCount += 1;
      }

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

      if (row.education) {
        const normalized = String(row.education).trim();
        if (normalized) {
          const current = summary.educationCountsMap.get(normalized) || 0;
          summary.educationCountsMap.set(normalized, current + 1);
        }
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

        const bloodGroupCounts = Array.from(
          item.bloodGroupCountsMap?.entries() || []
        )
          .map(([value, count]) => ({
            value,
            label: value,
            count,
          }))
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

        const educationCounts = buildEducationCountsFromMap(
          item.educationCountsMap
        );

        const serviceYearsCounts = Array.from(
          item.serviceYearsCountsMap?.entries() || []
        )
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
          educationCounts,
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

    const educationCounts = buildEducationCountsFromMap(educationCountsMap);

    const religionCounts = Array.from(religionCountsMap.entries())
      .map(([value, count]) => ({
        value,
        label: value,
        count,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    const companyCountsRaw = Array.from(companyCountsMap.entries()).map(
      ([key, countValue]) => {
        const [bat, com] = key.split("|||");
        return { battalionCode: bat, companyCode: com, _count: { companyCode: countValue } };
      }
    );

    const battalionCountsRaw = Array.from(battalionCountsMap.entries()).map(
      ([bat, countValue]) => ({
        battalionCode: bat,
        _count: { battalionCode: countValue },
      })
    );

    const bloodGroupCounts = formatGroupCounts(
      Array.from(bloodGroupCountsMap.entries()).map(([bg, countValue]) => ({
        bloodGroup: bg,
        _count: { bloodGroup: countValue },
      })),
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
    );

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
