const fs = require("fs");
const XLSX = require("xlsx");
const prisma = require("../utils/prisma");

const HEADER_ALIASES = {
  timestamp: ["ประทับเวลา", "timestamp", "time", "datetime", "วันที่"],
  score: ["คะแนน", "score", "ผลสอบ", "ผลคะแนน"],
  fullName: [
    "ยศชื่อสกุล",
    "ยศ-ชื่อ-สกุล",
    "ชื่อ",
    "ชื่อสกุล",
    "fullname",
  ],
  navyNumber: [
    "หมายเลขทร",
    "หมายเลขทร5ตัว",
    "หมายเลขทร.5ตัว",
    "หมายเลข",
    "รหัส",
  ],
  unit: ["สังกัด", "หน่วย", "หน่วยงาน", "กองร้อย", "กองพัน"],
};

const safeString = (v) =>
  v === undefined || v === null ? "" : String(v).trim();

const normalizeHeader = (h) =>
  safeString(h)
    .replace(/[\s\-\._()/]+/g, "")
    .toLowerCase();

const findColumnIndexes = (headerRow = []) => {
  const normalized = headerRow.map(normalizeHeader);
  const result = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const aliasSet = aliases.map(normalizeHeader);
    const idx = normalized.findIndex((h) =>
      aliasSet.some((alias) => h.includes(alias))
    );
    if (idx !== -1) {
      result[key] = idx;
    }
  }
  return result;
};

const excelSerialToDate = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  // Excel serial date to JS Date (UTC)
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const ms = epoch.getTime() + num * 24 * 60 * 60 * 1000;
  return new Date(ms);
};

const parseTimestamp = (value) => {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const d = excelSerialToDate(value);
    if (d && !isNaN(d.getTime())) return d;
  }
  const str = safeString(value);
  if (!str) return null;
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

  // Try format: DD/MM/YYYY HH:mm:ss or MM/DD/YYYY HH:mm:ss
  const m = str.match(
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/
  );
  if (m) {
    const monthFirst = str.includes("/");
    const part1 = Number(m[1]);
    const part2 = Number(m[2]);
    const year = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
    const hour = Number(m[4]);
    const minute = Number(m[5]);
    const second = Number(m[6] || "0");
    const month = monthFirst ? part1 : part2;
    const day = monthFirst ? part2 : part1;
    const d = new Date(year, month - 1, day, hour, minute, second);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
};

const parseScore = (raw) => {
  const text = safeString(raw);
  if (!text) return { scoreText: null, scoreValue: null, scoreTotal: null };
  const m = text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (m) {
    return {
      scoreText: text,
      scoreValue: Number(m[1]),
      scoreTotal: Number(m[2]),
    };
  }
  const n = Number(text);
  return {
    scoreText: text,
    scoreValue: Number.isFinite(n) ? n : null,
    scoreTotal: null,
  };
};

const normalizeNavyNumber = (value) => {
  const raw = safeString(value);
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  return digits || raw;
};

// ดึงรหัสกองร้อย/กองพันจากข้อความสังกัด เช่น "ร้อย.1 พัน.1"
const parseUnitCodes = (unitText) => {
  const text = safeString(unitText).replace(/\s+/g, "");
  const companyMatch = text.match(/ร้อย\.?(\d+)/) || text.match(/company\.?(\d+)/i);
  const battalionMatch = text.match(/พัน\.?(\d+)/) || text.match(/battalion\.?(\d+)/i);
  const companyCode = companyMatch ? companyMatch[1] : null;
  const battalionCode = battalionMatch ? battalionMatch[1] : null;
  return { companyCode, battalionCode };
};

const buildExamRows = (rows, importedById) => {
  if (!Array.isArray(rows) || rows.length < 2) {
    const err = new Error("ไฟล์ต้องมีข้อมูลอย่างน้อย 1 แถวหลังส่วนหัว");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const headerIndexes = findColumnIndexes(rows[0]);
  const hasCol = (key) =>
    headerIndexes[key] !== undefined && headerIndexes[key] !== null;
  if (!hasCol("timestamp") || !hasCol("score") || !hasCol("fullName")) {
    const err = new Error(
      "ไม่พบคอลัมน์ที่ต้องใช้ (ประทับเวลา, คะแนน, ยศ - ชื่อ - สกุล)"
    );
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const data = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const fullName = safeString(row[headerIndexes.fullName]);
    const navyNumber = normalizeNavyNumber(row[headerIndexes.navyNumber]);
    const unit = safeString(row[headerIndexes.unit]) || null;
    const ts =
      parseTimestamp(row[headerIndexes.timestamp]) ||
      new Date(); // fallback to now if missing
    const score = parseScore(row[headerIndexes.score]);

    if (!fullName && !score.scoreText && !navyNumber) {
      continue;
    }

    data.push({
      timestamp: ts,
      scoreText: score.scoreText,
      scoreValue: score.scoreValue,
      scoreTotal: score.scoreTotal,
      fullName: fullName || "ไม่ระบุชื่อ",
      navyNumber: navyNumber || null,
      unit,
      importedById: importedById || null,
    });
  }

  if (data.length === 0) {
    const err = new Error("ไม่พบข้อมูลที่นำเข้าได้ในไฟล์");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  return data;
};

module.exports = {
  importExamExcel: async (filePath, importedById) => {
    if (!fs.existsSync(filePath)) {
      const err = new Error("ไม่พบไฟล์ที่อัปโหลด");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    const wb = XLSX.readFile(filePath, { cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });

    const records = buildExamRows(rows, importedById);
    const created = await prisma.examResult.createMany({
      data: records,
      skipDuplicates: true,
    });
    return {
      inserted: created.count,
      totalRows: records.length,
      duplicates: records.length - created.count,
      preview: records.slice(0, 20),
    };
  },

  listExamResults: async (filters = {}) => {
    const page = Math.max(Number(filters.page) || 1, 1);
    const pageSize = Math.max(
      1,
      Math.min(Number(filters.pageSize) || 20, 200)
    );
    const skip = (page - 1) * pageSize;

    const search = safeString(filters.search);
    const navyNumber = safeString(filters.navyNumber);
    const unit = safeString(filters.unit);

    const where = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { unit: { contains: search, mode: "insensitive" } },
        { navyNumber: { contains: search } },
      ];
    }
    if (navyNumber) {
      where.navyNumber = { contains: navyNumber };
    }
    if (unit) {
      where.unit = { contains: unit, mode: "insensitive" };
    }

    const sortRaw = safeString(filters.sort).toLowerCase();
    let orderBy = [{ timestamp: "desc" }];
    if (sortRaw) {
      const pick = sortRaw.replace(/\s+/g, "");
      if (pick === "id" || pick === "+id" || pick === "id:asc") {
        orderBy = [{ id: "asc" }];
      } else if (pick === "-id" || pick === "id:desc") {
        orderBy = [{ id: "desc" }];
      } else if (
        pick === "timestamp" ||
        pick === "+timestamp" ||
        pick === "timestamp:asc"
      ) {
        orderBy = [{ timestamp: "asc" }];
      } else if (pick === "-timestamp" || pick === "timestamp:desc") {
        orderBy = [{ timestamp: "desc" }];
      }
    }

    const [items, total] = await Promise.all([
      prisma.examResult.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.examResult.count({ where }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  summarizeExamResults: async (filters = {}) => {
    const battalionCodesList =
      Array.isArray(filters.battalionCodesList) && filters.battalionCodesList.length
        ? filters.battalionCodesList.map((c) => safeString(c)).filter(Boolean)
        : ["1", "2", "3", "4"];
    const companyCodesList =
      Array.isArray(filters.companyCodesList) && filters.companyCodesList.length
        ? filters.companyCodesList.map((c) => safeString(c)).filter(Boolean)
        : ["1", "2", "3", "4", "5"];

    const rows = await prisma.examResult.findMany({
      select: { unit: true, scoreValue: true },
    });

    const key = (b, c) => `${b || ""}__${c || ""}`;
    const agg = new Map();

    rows.forEach((row) => {
      if (row.scoreValue == null || Number.isNaN(row.scoreValue)) return;
      const { battalionCode, companyCode } = parseUnitCodes(row.unit);
      if (!battalionCode || !companyCode) return;
      const k = key(battalionCode, companyCode);
      const prev = agg.get(k) || { sum: 0, count: 0 };
      prev.sum += Number(row.scoreValue);
      prev.count += 1;
      agg.set(k, prev);
    });

    const battalions = battalionCodesList.map((bCode) => {
      const companies = companyCodesList.map((cCode) => {
        const a = agg.get(key(bCode, cCode));
        const avg = a && a.count > 0 ? a.sum / a.count : null;
        return {
          battalionCode: bCode,
          companyCode: cCode,
          averageScore: avg != null ? Number(avg.toFixed(2)) : null,
          total: a ? a.count : 0,
        };
      });
      const totals = companies.reduce(
        (acc, c) => {
          acc.count += c.total;
          acc.sum += c.averageScore != null ? c.averageScore * c.total : 0;
          return acc;
        },
        { sum: 0, count: 0 }
      );
      const averageScore =
        totals.count > 0 ? Number((totals.sum / totals.count).toFixed(2)) : null;
      return {
        battalionCode: bCode,
        averageScore,
        total: totals.count,
        companies,
      };
    });

    return { battalions };
  },

  deleteExamResult: async (id) => {
    const examId = Number(id);
    if (!Number.isInteger(examId) || examId <= 0) {
      const err = new Error("id ต้องเป็นตัวเลข");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    return prisma.examResult.delete({
      where: { id: examId },
    });
  },

  deleteAllExamResults: async () => {
    const res = await prisma.examResult.deleteMany({});
    return { deleted: res.count };
  },

  getExamOverview: async () => {
    const [aggregate, latest] = await Promise.all([
      prisma.examResult.aggregate({
        _count: true,
        _avg: { scoreValue: true },
      }),
      prisma.examResult.findFirst({
        orderBy: { timestamp: "desc" },
        select: { id: true, timestamp: true },
      }),
    ]);
    return {
      total: aggregate?._count || 0,
      averageScore:
        typeof aggregate?._avg?.scoreValue === "number"
          ? Number(aggregate._avg.scoreValue.toFixed(2))
          : null,
      latest: latest || null,
    };
  },

  getExamResultsForExport: async () => {
    const rows = await prisma.examResult.findMany({
      orderBy: [{ timestamp: "desc" }, { id: "desc" }],
    });

    const key = (b, c) => `${b || ""}__${c || ""}`;
    const groups = new Map();
    rows.forEach((row) => {
      const { battalionCode, companyCode } = parseUnitCodes(row.unit);
      if (!battalionCode || !companyCode) return;
      const k = key(battalionCode, companyCode);
      if (!groups.has(k)) {
        groups.set(k, { battalionCode, companyCode, items: [] });
      }
      groups.get(k).items.push(row);
    });

    return Array.from(groups.values()).sort((a, b) => {
      const battalionCmp = String(a.battalionCode).localeCompare(String(b.battalionCode));
      if (battalionCmp !== 0) return battalionCmp;
      return String(a.companyCode).localeCompare(String(b.companyCode));
    });
  },
};
