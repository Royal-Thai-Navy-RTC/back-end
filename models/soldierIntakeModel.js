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
  const allowed = new Set(["A", "B", "AB", "O", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);
  if (!allowed.has(normalized)) {
    const err = new Error("หมู่เลือดไม่ถูกต้อง (ระบุเป็น A/B/AB/O หรือมี +/-)");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return normalized;
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

  return {
    firstName,
    lastName,
    citizenId,
    birthDate,
    weightKg,
    heightCm,
    serviceYears,
    bloodGroup,
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
  };
};

const ensureModelAvailable = () => {
  if (!prisma.soldierIntake) {
    const err = new Error("โมเดล SoldierIntake ยังไม่พร้อม (รัน prisma migrate/generate ก่อน)");
    err.code = "MIGRATION_REQUIRED";
    throw err;
  }
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
    return prisma.soldierIntake.create({ data });
  },

  listIntakes: async (filters = {}) => {
    ensureModelAvailable();
    const pageSize = Math.max(1, Math.min(Number(filters.pageSize) || 20, 100));
    const page = Math.max(1, Number(filters.page) || 1);
    const skip = (page - 1) * pageSize;
    const where = {};
    if (filters.search) {
      const q = String(filters.search).trim();
      if (q) {
        where.OR = [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { citizenId: { contains: q } },
          { phone: { contains: q } },
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
    return {
      items,
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
    return record;
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

  summary: async () => {
    ensureModelAvailable();
    const [total, sixMonths, oneYear, twoYears] = await Promise.all([
      prisma.soldierIntake.count(),
      prisma.soldierIntake.count({
        where: { serviceYears: { lte: 0.6 } },
      }),
      prisma.soldierIntake.count({
        where: { serviceYears: { equals: 1 } },
      }),
      prisma.soldierIntake.count({
        where: { serviceYears: { equals: 2 } },
      }),
    ]);
    return { total, sixMonths, oneYear, twoYears };
  },
};
