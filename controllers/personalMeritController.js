const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const prisma = require("../utils/prisma");

const THAI_DIGIT_MAP = {
  "๐": "0",
  "๑": "1",
  "๒": "2",
  "๓": "3",
  "๔": "4",
  "๕": "5",
  "๖": "6",
  "๗": "7",
  "๘": "8",
  "๙": "9",
};

const thaiDigitsToArabic = (value) => {
  if (value === undefined || value === null) return "";
  return String(value)
    .split("")
    .map((char) => THAI_DIGIT_MAP[char] ?? char)
    .join("");
};

const safeString = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const roundScore = (value) => {
  if (value === undefined || value === null) return null;
  return Math.round(value * 100) / 100;
};

const parseNumeric = (value) => {
  if (value === undefined || value === null) return null;
  let normalized = thaiDigitsToArabic(String(value));
  normalized = normalized.replace(/,/g, ".").replace(/\s+/g, "");
  normalized = normalized.replace(/[^0-9.\-]/g, "");
  if (!normalized || normalized === "." || normalized === "-") return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? roundScore(num) : null;
};

const parseInteger = (value) => {
  const num = parseNumeric(value);
  return num == null ? null : Math.round(num);
};

const formatTwoDecimals = (value) =>
  typeof value === "number" ? Number(value.toFixed(2)) : null;

const extractBattalionCode = (value) => {
  const text = safeString(value).replace(/\s+/g, "");
  if (!text) return null;
  const match =
    text.match(/(?:พัน|bn|battalion)\.?(?:ฝ\.)?(\d{1,2})/i) ||
    text.match(/(\d{1,2})/);
  return match ? match[1] : null;
};

const extractCompanyCode = (value) => {
  const text = safeString(value).replace(/\s+/g, "");
  if (!text) return null;
  const match =
    text.match(/(?:ร้อย|co|company)\.?(?:ฝ\.)?(\d{1,2})/i) ||
    text.match(/(\d{1,2})/);
  return match ? match[1] : null;
};

const getExtremesByTotalScore = (companies = []) => {
  const candidates = companies.filter(
    (c) => typeof c.averageScores?.totalScore === "number"
  );
  if (!candidates.length) {
    return { highest: null, lowest: null };
  }
  const sorted = [...candidates].sort((a, b) => {
    const diff = b.averageScores.totalScore - a.averageScores.totalScore;
    if (diff !== 0) return diff;
    return String(a.company || "").localeCompare(String(b.company || ""));
  });
  return { highest: sorted[0], lowest: sorted[sorted.length - 1] };
};

const parseRankAndName = (value) => {
  const text = safeString(value);
  if (!text) return { rankTitle: null, soldierName: null };
  const normalized = text.replace(/\s+/g, " ").trim();
  const rankPattern =
    /^(พลทหาร|พลหทาร|พล[^\s]*|จ่า|นาย|สิบ(?:เอก|โท|ตรี)?|ร้อย|พัน(?:เอก|โท|ตรี)?)/i;
  const match = normalized.match(rankPattern);
  const rankTitle = match ? match[1] : "พลทหาร";
  const soldierName = match
    ? normalized.slice(match[0].length).trim() || normalized
    : normalized;
  return { rankTitle, soldierName };
};

const findTargetSheetName = (workbook) => {
  const target = "คะแนนรายบุคคล";
  const normalizedTarget = target.replace(/\s+/g, "").toLowerCase();
  return workbook.SheetNames.find((name) => {
    if (!name) return false;
    const normalized = name.trim().toLowerCase().replace(/\s+/g, "");
    return normalized === normalizedTarget;
  });
};

const findHeaderRowIndex = (rows) => {
  if (!Array.isArray(rows)) return -1;
  return rows.findIndex((row, idx) => {
    if (!Array.isArray(row)) return false;
    const normalized = row.map((cell) => safeString(cell).toLowerCase());
    const hasName = normalized.some(
      (cell) =>
        cell.includes("ยศ") && (cell.includes("ชื่อ") || cell.includes("สกุล"))
    );
    const hasTotal = normalized.some((cell) => cell.includes("คะแนนรวม"));
    const nextRow = rows[idx + 1];
    const hasTotalNext =
      Array.isArray(nextRow) &&
      nextRow
        .map((cell) => safeString(cell).toLowerCase())
        .some((cell) => cell.includes("คะแนนรวม"));
    const hasRanking = normalized.some((cell) => cell.includes("ลำดับ"));
    const hasKnowledge = normalized.some((cell) => cell.includes("ความรู้"));
    return hasName && (hasTotal || hasTotalNext || hasRanking || hasKnowledge);
  });
};

const buildColumnMap = (headerRow, nextRow = []) => {
  const map = {};
  if (!Array.isArray(headerRow)) return map;
  const primaryRow = headerRow;
  const secondaryRow = Array.isArray(nextRow) ? nextRow : [];
  primaryRow.forEach((_cell, idx) => {
    const primaryNormalized = safeString(primaryRow[idx]).toLowerCase();
    const secondaryNormalized = safeString(secondaryRow[idx]).toLowerCase();
    const normalized = [primaryNormalized, secondaryNormalized]
      .filter(Boolean)
      .join(" ");
    if (!normalized) return;
    if (!map.name && normalized.includes("ยศ") && normalized.includes("ชื่อ")) {
      map.name = idx;
      return;
    }
    if (!map.battalion && normalized.includes("กองพัน")) {
      map.battalion = idx;
      return;
    }
    if (!map.company && normalized.includes("กองร้อย")) {
      map.company = idx;
      return;
    }
    if (!map.knowledge && normalized.includes("ความรู้")) {
      map.knowledge = idx;
      return;
    }
    if (!map.discipline && normalized.includes("วินัย")) {
      map.discipline = idx;
      return;
    }
    if (!map.physical && normalized.includes("ร่างกาย")) {
      map.physical = idx;
      return;
    }
    if (!map.total && normalized.includes("คะแนนรวม")) {
      map.total = idx;
      return;
    }
    if (!map.ranking && normalized.includes("ลำดับ")) {
      map.ranking = idx;
    }
  });
  return map;
};

const getCellValue = (row, index) => {
  if (!Array.isArray(row)) return null;
  return index == null ? null : row[index];
};

const importPersonalMeritScores = async (req, res) => {
  if (!req.file || !req.file.path) {
    return res
      .status(400)
      .json({ message: "กรุณาอัปโหลดไฟล์ Excel ในฟิลด์ 'file'" });
  }

  const filePath = req.file.path;
  try {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = findTargetSheetName(workbook);
    if (!sheetName) {
      return res.status(400).json({
        message: "ไม่พบ sheet 'คะแนนรายบุคคล' ในไฟล์ที่อัปโหลด",
      });
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
    });
    const headerRowIndex = findHeaderRowIndex(rows);
    if (headerRowIndex === -1) {
      return res.status(400).json({
        message:
          "ไม่พบแถวหัวตารางสำหรับ 'ยศ ชื่อ - สกุล' หรือ 'คะแนนรวม' ใน sheet นี้",
      });
    }

    const columnMap = buildColumnMap(
      rows[headerRowIndex],
      rows[headerRowIndex + 1]
    );
    if (!columnMap.name || !columnMap.total) {
      return res.status(400).json({
        message: "หัวตารางไม่ครบถ้วน (ต้องมี 'ยศ ชื่อ - สกุล' และ 'คะแนนรวม')",
      });
    }

    const batchId =
      safeString(req.body?.batchId || req.query?.batchId) ||
      `personal-merit-${Date.now()}`;
    const sourceFile =
      path.basename(req.file.originalname || req.file.filename || "") || null;
    const importerId = Number(req.userId);
    const canonicalSheetName = sheetName.trim();

    const minDataRow = 3; // 0-based index for row 4 so we skip the title/notice rows
    const dataRows = rows.slice(Math.max(headerRowIndex + 1, minDataRow));
    const totalRows = dataRows.length;
    const records = [];

    let lastBattalion = null;
    let lastCompany = null;
    for (const row of dataRows) {
      const rawName = safeString(getCellValue(row, columnMap.name));
      if (!rawName) continue;
      const { rankTitle, soldierName } = parseRankAndName(rawName);
      const normalizedSoldierName = soldierName || rawName;
      if (!normalizedSoldierName) continue;

      let battalionVal = safeString(getCellValue(row, columnMap.battalion));
      let companyVal = safeString(getCellValue(row, columnMap.company));
      if (!battalionVal && lastBattalion) battalionVal = lastBattalion;
      if (!companyVal && lastCompany) companyVal = lastCompany;
      if (battalionVal) lastBattalion = battalionVal;
      if (companyVal) lastCompany = companyVal;

      records.push({
        rankTitle,
        soldierName: normalizedSoldierName,
        rawName,
        battalion: battalionVal || null,
        company: companyVal || null,
        knowledgeScore: parseNumeric(getCellValue(row, columnMap.knowledge)),
        disciplineScore: parseNumeric(getCellValue(row, columnMap.discipline)),
        physicalScore: parseNumeric(getCellValue(row, columnMap.physical)),
        totalScore: parseNumeric(getCellValue(row, columnMap.total)),
        ranking: parseInteger(getCellValue(row, columnMap.ranking)),
        batchId,
        sourceFile,
        sheetName: canonicalSheetName,
        importedById: Number.isFinite(importerId) ? importerId : null,
      });
    }

    if (records.length === 0) {
      return res.status(400).json({
        message: "ไม่พบข้อมูลแถวคะแนนใน sheet 'คะแนนรายบุคคล'",
      });
    }

    const result = await prisma.personalMeritScore.createMany({
      data: records,
    });
    return res.status(201).json({
      message: "นำเข้าข้อมูลคะแนนบุคคลสำเร็จ",
      summary: {
        sheetName: canonicalSheetName,
        batchId,
        totalRows,
        parsedRows: records.length,
        inserted: result.count,
        skippedRows: totalRows - records.length,
      },
    });
  } catch (err) {
    console.error("importPersonalMeritScores failed:", err);
    return res.status(500).json({
      message: "ไม่สามารถอ่านหรือบันทึกข้อมูลได้",
      detail: err?.message,
    });
  } finally {
    fs.existsSync(filePath) && fs.unlinkSync(filePath);
  }
};

const listPersonalMeritScores = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));

    const safeString = (value) =>
      value === undefined || value === null ? "" : String(value).trim();

    const filters = {};

    if (req.query.batchId) {
      filters.batchId = safeString(req.query.batchId);
    }

    // ✅ Prisma ของคุณ error เรื่อง mode -> ตัด mode ออก
    if (req.query.soldierName) {
      filters.soldierName = { contains: safeString(req.query.soldierName) };
    }

    // ✅ SEARCH รองรับ: "พัน.1", "พัน1", "BN.1", "bn1", "ร้อย.1", "CO.1", "co1", และ "1"
    const searchRaw = safeString(req.query.search);
    const s = searchRaw.replace(/\s+/g, "");

    if (s) {
      const bnMatch = s.match(/^(?:พัน|bn)\.?(?<n>\d{1,2})$/i);
      const coMatch = s.match(/^(?:ร้อย|co)\.?(?<n>\d{1,2})$/i);

      const mapped = [];
      if (bnMatch?.groups?.n) mapped.push(`BN.${Number(bnMatch.groups.n)}`);
      if (coMatch?.groups?.n) mapped.push(`CO.${Number(coMatch.groups.n)}`);

      if (/^\d{1,2}$/.test(s)) {
        mapped.push(`BN.${Number(s)}`, `CO.${Number(s)}`);
      }

      const terms = [searchRaw, s, ...mapped].filter(Boolean);

      filters.OR = terms.flatMap((t) => [
        { soldierName: { contains: t } },
        { rankTitle: { contains: t } },
        { battalion: { contains: t } },
        { company: { contains: t } },
      ]);
    }

    // ✅ sort ranking มาก->น้อย / น้อย->มาก ด้วย query: ?rankingOrder=asc|desc
    const rankingOrder = (safeString(req.query.rankingOrder) || "asc").toLowerCase();
    const rankingSort = rankingOrder === "desc" ? "desc" : "asc";

    const orderBy = [
      { ranking: rankingSort }, // ✅ ปรับตาม rankingOrder
      { totalScore: "desc" },
      { id: "asc" },
    ];

    const total = await prisma.personalMeritScore.count({ where: filters });
    const items = await prisma.personalMeritScore.findMany({
      where: filters,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const formatScore = (value) =>
      value == null ? null : Number(Number(value).toFixed(2));

    const formattedItems = items.map((item) => ({
      ...item,
      knowledgeScore: formatScore(item.knowledgeScore),
      disciplineScore: formatScore(item.disciplineScore),
      physicalScore: formatScore(item.physicalScore),
      totalScore: formatScore(item.totalScore),
      battalion: item.battalion ? parseInt(String(item.battalion).split(".")[1]) : null,
      company: item.company ? parseInt(String(item.company).split(".")[1]) : null,
    }));

    return res.json({
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      data: formattedItems,
    });
  } catch (err) {
    console.error("listPersonalMeritScores failed:", err);
    return res.status(500).json({
      message: "ไม่สามารถดึงข้อมูลคะแนนบุคคลได้",
      detail: err?.message,
    });
  }
};

const getPersonalMeritScoresOverview = async (_req, res) => {
  try {
    const [aggregate, battalionAverages, companyAverages] = await Promise.all([
      prisma.personalMeritScore.aggregate({
        _count: true,
        _avg: {
          knowledgeScore: true,
          disciplineScore: true,
          physicalScore: true,
          totalScore: true,
        },
        _min: {
          knowledgeScore: true,
          disciplineScore: true,
          physicalScore: true,
          totalScore: true,
        },
        _max: {
          knowledgeScore: true,
          disciplineScore: true,
          physicalScore: true,
          totalScore: true,
        },
      }),
      prisma.personalMeritScore.groupBy({
        by: ["battalion"],
        where: { battalion: { not: null } },
        _count: { _all: true },
        _avg: {
          knowledgeScore: true,
          disciplineScore: true,
          physicalScore: true,
          totalScore: true,
        },
      }),
      prisma.personalMeritScore.groupBy({
        by: ["battalion", "company"],
        where: { battalion: { not: null }, company: { not: null } },
        _count: { _all: true },
        _avg: {
          knowledgeScore: true,
          disciplineScore: true,
          physicalScore: true,
          totalScore: true,
        },
      }),
    ]);

    const companyMap = new Map();
    companyAverages.forEach((item) => {
      const key = item.battalion || "";
      const entry = {
        battalion: item.battalion,
        company: item.company,
        battalionCode: extractBattalionCode(item.battalion),
        companyCode: extractCompanyCode(item.company),
        total: item._count?._all ?? 0,
        averageScores: {
          knowledgeScore: formatTwoDecimals(item._avg.knowledgeScore),
          disciplineScore: formatTwoDecimals(item._avg.disciplineScore),
          physicalScore: formatTwoDecimals(item._avg.physicalScore),
          totalScore: formatTwoDecimals(item._avg.totalScore),
        },
      };
      if (!companyMap.has(key)) companyMap.set(key, []);
      companyMap.get(key).push(entry);
    });

    return res.json({
      total: aggregate._count,
      averageScores: {
        knowledgeScore: formatTwoDecimals(aggregate._avg.knowledgeScore),
        disciplineScore: formatTwoDecimals(aggregate._avg.disciplineScore),
        physicalScore: formatTwoDecimals(aggregate._avg.physicalScore),
        totalScore: formatTwoDecimals(aggregate._avg.totalScore),
      },
      averageByBattalion: battalionAverages
        .map((item) => {
          const companies = companyMap.get(item.battalion || "") || [];
          const { highest, lowest } = getExtremesByTotalScore(companies);
          return {
            battalion: item.battalion,
            battalionCode: extractBattalionCode(item.battalion),
            total: item._count?._all ?? 0,
            averageScores: {
              knowledgeScore: formatTwoDecimals(item._avg.knowledgeScore),
              disciplineScore: formatTwoDecimals(item._avg.disciplineScore),
              physicalScore: formatTwoDecimals(item._avg.physicalScore),
              totalScore: formatTwoDecimals(item._avg.totalScore),
            },
            companies,
            highestCompany: highest,
            lowestCompany: lowest,
          };
        })
        .sort((a, b) => {
          const aCode = Number(a.battalionCode);
          const bCode = Number(b.battalionCode);
          if (!Number.isNaN(aCode) && !Number.isNaN(bCode)) {
            return aCode - bCode;
          }
          return String(a.battalion || "").localeCompare(
            String(b.battalion || "")
          );
        }),
    });
  } catch (err) {
    console.error("getPersonalMeritScoresOverview failed:", err);
    return res.status(500).json({
      message: "ไม่สามารถดึงสรุปผลคะแนนบุคคลได้",
      detail: err?.message,
    });
  }
};

const deletePersonalMeritScoreById = async (req, res) => {
  const intakeId = Number(req.params.id);
  if (!Number.isInteger(intakeId) || intakeId <= 0) {
    return res.status(400).json({ message: "id ไม่ถูกต้อง" });
  }
  try {
    const deleted = await prisma.personalMeritScore.delete({
      where: { id: intakeId },
    });
    return res.json({ message: "ลบข้อมูลสำเร็จ", deleted });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ message: "ไม่พบข้อมูลคะแนนบุคคล" });
    }
    console.error("deletePersonalMeritScoreById failed:", err);
    return res.status(500).json({
      message: "ไม่สามารถลบข้อมูลคะแนนบุคคลได้",
      detail: err?.message,
    });
  }
};

const deleteAllPersonalMeritScores = async (_req, res) => {
  try {
    const result = await prisma.personalMeritScore.deleteMany();
    return res.json({
      message: "ลบข้อมูลทั้งหมดสำเร็จ",
      deleted: result.count,
    });
  } catch (err) {
    console.error("deleteAllPersonalMeritScores failed:", err);
    return res
      .status(500)
      .json({ message: "ไม่สามารถลบข้อมูลได้", detail: err?.message });
  }
};

module.exports = {
  importPersonalMeritScores,
  listPersonalMeritScores,
  deletePersonalMeritScoreById,
  deleteAllPersonalMeritScores,
  getPersonalMeritScoresOverview,
};
