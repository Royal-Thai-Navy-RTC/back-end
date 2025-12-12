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

const normalizeText = (value) =>
  safeString(value).toLowerCase().replace(/\s+/g, " ");

const parseNumeric = (value) => {
  if (value === undefined || value === null) return null;
  let normalized = safeString(value);
  if (!normalized) return null;
  normalized = thaiDigitsToArabic(normalized);
  normalized = normalized.replace(/,/g, ".").replace(/\s+/g, "");
  normalized = normalized.replace(/[^0-9.\-]/g, "");
  if (!normalized || normalized === "." || normalized === "-") return null;
  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100) / 100;
};

const parseInteger = (value) => {
  const num = parseNumeric(value);
  return num == null ? null : Math.round(num);
};

const parseRankingFromNote = (note) => {
  if (!note) return null;
  const normalized = thaiDigitsToArabic(safeString(note));
  const match = normalized.match(/(?:อันดับ|ลำดับ)\s*([0-9๐-๙]+)/i);
  if (!match) return null;
  const digits = match[1] || "";
  const num = Number(thaiDigitsToArabic(digits));
  return Number.isFinite(num) ? Math.round(num) : null;
};

const RANGE_START_COL_INDEX = 6; // Column G
const RANGE_END_COL_INDEX = 13; // Column N
const RANGE_END_ROW_INDEX = 22; // Row 23 (0-based)

const getMergedCellValue = (rowIndex, colIndex, rows, worksheet, merges) => {
  if (rowIndex == null || colIndex == null) return null;
  const row = rows[rowIndex];
  const direct =
    Array.isArray(row) && row[colIndex] !== undefined && row[colIndex] !== null
      ? row[colIndex]
      : undefined;
  if (direct !== undefined && direct !== null && direct !== "") {
    return direct;
  }
  for (const merge of merges) {
    if (
      merge.s.r <= rowIndex &&
      rowIndex <= merge.e.r &&
      merge.s.c <= colIndex &&
      colIndex <= merge.e.c
    ) {
      const startAddress = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
      const startCell = worksheet[startAddress];
      if (startCell && startCell.v !== undefined && startCell.v !== null) {
        return startCell.v;
      }
      const fallbackRow = rows[merge.s.r];
      if (Array.isArray(fallbackRow)) {
        const fallbackValue = fallbackRow[merge.s.c];
        if (fallbackValue !== undefined && fallbackValue !== null && fallbackValue !== "") {
          return fallbackValue;
        }
      }
    }
  }
  return direct;
};

const getMaxColumns = (rows, merges) => {
  const rowMax = rows.reduce((max, row) => {
    if (!Array.isArray(row)) return max;
    return Math.max(max, row.length);
  }, 0);
  const mergeMax = merges.reduce((max, merge) => Math.max(max, merge.e.c + 1), 0);
  return Math.max(rowMax, mergeMax, 1);
};

const getNormalizedRow = (
  rowIndex,
  worksheet,
  rows,
  merges,
  maxCols,
  options = {}
) => {
  const normalized = [];
  const startCol = Math.max(options.startCol ?? 0, 0);
  const endCol = Math.min(options.endCol ?? maxCols - 1, maxCols - 1);
  if (startCol > endCol) return normalized;
  for (let col = startCol; col <= endCol; col++) {
    const value = getMergedCellValue(rowIndex, col, rows, worksheet, merges);
    normalized.push(normalizeText(value));
  }
  return normalized;
};

const containsAny = (text, keywords) => {
  if (!text || !keywords?.length) return false;
  return keywords.some((keyword) => keyword && text.includes(keyword));
};

const findDisciplineSheetName = (workbook) => {
  const target = "ด้านวินัย";
  return workbook.SheetNames.find((name) => {
    if (!name) return false;
    return normalizeText(name).replace(/\s+/g, "") === target;
  });
};

const HEADER_KEYWORDS = [
  "กองร้อย",
  "กองพัน",
  "ภาคปฏิบัติ",
  "ระเบียบ",
  "คะแนนรวม",
  "คะแนนเฉลี่ย",
  "หมายเหตุ",
];
const NOTE_HEADER_KEYWORDS = ["หมายเหตุ", "note", "remarks"];

const FALLBACK_COLUMN_INDEXES = {
  company: 6,
  battalion: 7,
  infantry: 8,
  drill: 9,
  regulation: 10,
  total: 11,
  average: 12,
  note: 13,
};

const findHeaderRowIndex = (
  rows,
  worksheet,
  merges,
  maxCols,
  rangeOptions = {}
) => {
  if (!Array.isArray(rows)) return -1;
  const lastRow = Math.min(rows.length - 1, RANGE_END_ROW_INDEX);
  for (let index = 0; index <= lastRow; index++) {
    const normalized = getNormalizedRow(
      index,
      worksheet,
      rows,
      merges,
      maxCols,
      rangeOptions
    );
    const combined = normalized.join(" ");
    const matches = HEADER_KEYWORDS.filter((keyword) => combined.includes(keyword));
    if (matches.length >= 2) {
      return index;
    }
  }
  return -1;
};

const buildColumnMap = (
  headerRows,
  worksheet,
  rows,
  merges,
  maxCols,
  rangeOptions = {}
) => {
  const map = {};
  if (!Array.isArray(headerRows) || headerRows.length === 0) return map;

  const startCol = Math.max(rangeOptions.startCol ?? 0, 0);
  const endCol = Math.min(rangeOptions.endCol ?? maxCols - 1, maxCols - 1);
  const lastCol = Math.min(endCol, maxCols - 1);
  for (let col = startCol; col <= lastCol; col++) {
    const combined = headerRows
      .map((rowIndex) =>
        normalizeText(getMergedCellValue(rowIndex, col, rows, worksheet, merges))
      )
      .filter(Boolean)
      .join(" ");
    if (!combined) continue;

    if (!map.company && containsAny(combined, ["กองร้อย", "company", "ร้อยฝึก"])) {
      map.company = col;
      continue;
    }
    if (!map.battalion && containsAny(combined, ["กองพัน", "battalion", "พันฝึก"])) {
      map.battalion = col;
      continue;
    }
    if (!map.infantry && containsAny(combined, ["วิชาทหารราบ", "ราบ"])) {
      map.infantry = col;
      continue;
    }
    if (!map.drill && containsAny(combined, ["สวนสนาม", "drill", "march"])) {
      map.drill = col;
      continue;
    }
    if (!map.regulation && containsAny(combined, ["ระเบียบ", "regulation"])) {
      map.regulation = col;
      continue;
    }
    if (!map.total && containsAny(combined, ["คะแนนรวม", "total"])) {
      map.total = col;
      continue;
    }
    if (!map.average && containsAny(combined, ["คะแนนเฉลี่ย", "average"])) {
      map.average = col;
      continue;
    }
    if (
      !map.note &&
      containsAny(combined, ["หมายเหตุ", "note", "remarks", "อันดับ"])
    ) {
      map.note = col;
    }
  }

  Object.entries(FALLBACK_COLUMN_INDEXES).forEach(([key, index]) => {
    if (map[key] == null && index >= startCol && index <= lastCol) {
      map[key] = index;
    }
  });

  return map;
};

const importDisciplineAssessments = async (req, res) => {
  if (!req.file || !req.file.path) {
    return res
      .status(400)
      .json({ message: "กรุณาอัปโหลดไฟล์ Excel ในฟิลด์ 'file'" });
  }

  const filePath = req.file.path;
  try {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = findDisciplineSheetName(workbook);
    if (!sheetName) {
      return res.status(400).json({
        message: "ไม่พบ sheet 'ด้านวินัย' ในไฟล์ที่อัปโหลด",
      });
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
    });
    const merges = Array.isArray(worksheet["!merges"]) ? worksheet["!merges"] : [];
    const maxCols = getMaxColumns(rows, merges);
    const rangeOptions = {
      startCol: RANGE_START_COL_INDEX,
      endCol: RANGE_END_COL_INDEX,
    };
    const headerRowIndex = findHeaderRowIndex(
      rows,
      worksheet,
      merges,
      maxCols,
      rangeOptions
    );
    if (headerRowIndex === -1) {
      return res.status(400).json({
        message:
          "ไม่พบแถวหัวตารางที่มีคำว่า 'กองร้อย'/'ภาคปฏิบัติ'/'ระเบียบข้อบังคับ' หรือคำที่คล้ายกัน",
      });
    }

    const headerRows = [headerRowIndex];
    const nextRowIndex = headerRowIndex + 1;
    if (nextRowIndex < rows.length && nextRowIndex <= RANGE_END_ROW_INDEX) {
      const nextNormalized = getNormalizedRow(
        nextRowIndex,
        worksheet,
        rows,
        merges,
        maxCols,
        rangeOptions
      );
      if (
        nextNormalized.some((cell) =>
          containsAny(cell, HEADER_KEYWORDS)
        )
      ) {
        headerRows.push(nextRowIndex);
      }
    }

    const columnMap = buildColumnMap(
      headerRows,
      worksheet,
      rows,
      merges,
      maxCols,
      rangeOptions
    );
    if (!columnMap.company || !columnMap.regulation || !columnMap.total) {
      return res.status(400).json({
        message:
          "หัวตารางไม่ครบถ้วน (ต้องมีอย่างน้อย กองร้อยฝึก, ระเบียบข้อบังคับ, คะแนนรวม)",
      });
    }

    const dataStartIndex = headerRowIndex + headerRows.length;
    const dataEndIndex = Math.min(rows.length - 1, RANGE_END_ROW_INDEX);
    const totalRows = Math.max(0, dataEndIndex - dataStartIndex + 1);
    const getCellValue = (rowIndex, columnIndex) =>
      getMergedCellValue(rowIndex, columnIndex, rows, worksheet, merges);

    const sourceFile =
      path.basename(req.file.originalname || req.file.filename || "") || null;
    const batchId =
      safeString(req.body?.batchId || req.query?.batchId) ||
      `discipline-assessment-${Date.now()}`;
    const importerId = Number(req.userId);
    const canonicalSheetName = safeString(sheetName);

    const records = [];
    let lastCompany = null;
    let lastBattalion = null;

    for (let rowIndex = dataStartIndex; rowIndex <= dataEndIndex; rowIndex++) {
      const rawCompany = safeString(
        getCellValue(rowIndex, columnMap.company)
      );
      const normalizedCompany = rawCompany
        ? thaiDigitsToArabic(rawCompany)
        : "";
      let companyValue = normalizedCompany || rawCompany;
      if (companyValue) {
        lastCompany = companyValue;
      } else if (lastCompany) {
        companyValue = lastCompany;
      }

      const rawBattalion = columnMap.battalion
        ? safeString(getCellValue(rowIndex, columnMap.battalion))
        : "";
      const normalizedBattalion = rawBattalion
        ? thaiDigitsToArabic(rawBattalion)
        : "";
      let battalionValue = normalizedBattalion || rawBattalion;
      if (battalionValue) {
        lastBattalion = battalionValue;
      } else if (lastBattalion) {
        battalionValue = lastBattalion;
      }

      companyValue = companyValue ? companyValue.trim() || null : null;
      battalionValue = battalionValue ? battalionValue.trim() || null : null;

      const infantryScore = columnMap.infantry
        ? parseNumeric(getCellValue(rowIndex, columnMap.infantry))
        : null;
      const drillScore = columnMap.drill
        ? parseNumeric(getCellValue(rowIndex, columnMap.drill))
        : null;
      const regulationScore = parseNumeric(
        getCellValue(rowIndex, columnMap.regulation)
      );
      const totalScore = columnMap.total
        ? parseNumeric(getCellValue(rowIndex, columnMap.total))
        : null;
      const averageScore = columnMap.average
        ? parseNumeric(getCellValue(rowIndex, columnMap.average))
        : null;
      const noteValue = columnMap.note
        ? safeString(getCellValue(rowIndex, columnMap.note))
        : "";
      const normalizedNote = normalizeText(noteValue);
      if (normalizedNote && NOTE_HEADER_KEYWORDS.includes(normalizedNote)) {
        continue;
      }

      const hasScore =
        infantryScore != null ||
        drillScore != null ||
        regulationScore != null ||
        totalScore != null ||
        averageScore != null;
      if (!hasScore) {
        continue;
      }
      const hasLocation = !!(companyValue || battalionValue);
      if (!hasLocation) {
        continue;
      }

      const practiceParts = [infantryScore, drillScore].filter(
        (value) => value != null
      );
      const practiceScore =
        practiceParts.length > 0
          ? practiceParts.reduce((sum, value) => sum + value, 0)
          : null;
      const ranking = parseRankingFromNote(noteValue);
      const orderNumber = records.length + 1;

      records.push({
        orderNumber,
        battalion: battalionValue || null,
        company: companyValue || null,
        infantryScore,
        drillScore,
        practiceScore,
        regulationScore,
        totalScore,
        averageScore,
        note: noteValue || null,
        ranking,
        batchId,
        sourceFile,
        sheetName: canonicalSheetName,
        importedById: Number.isFinite(importerId) ? importerId : null,
      });
    }

    if (records.length === 0) {
      return res.status(400).json({
        message:
          "ไม่พบข้อมูลที่สามารถนำเข้าได้ใน sheet 'ด้านวินัย'",
      });
    }

    const result = await prisma.disciplineAssessment.createMany({
      data: records,
    });

    return res.status(201).json({
      message: "นำเข้าข้อมูลผลการประเมินด้านวินัยสำเร็จ",
      summary: {
        sheetName: canonicalSheetName,
        batchId,
        totalRows,
        parsedRows: records.length,
        inserted: result.count,
        skippedRows: Math.max(totalRows - records.length, 0),
      },
    });
  } catch (err) {
    console.error("importDisciplineAssessments failed:", err);
    return res.status(500).json({
      message: "ไม่สามารถอ่านหรือบันทึกข้อมูลได้",
      detail: err?.message,
    });
  } finally {
    fs.existsSync(filePath) && fs.unlinkSync(filePath);
  }
};

const listDisciplineAssessments = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));
    const filters = {};
    if (req.query.batchId) {
      filters.batchId = safeString(req.query.batchId);
    }
    if (req.query.battalion) {
      filters.battalion = {
        contains: safeString(req.query.battalion),
        mode: "insensitive",
      };
    }
    if (req.query.company) {
      filters.company = {
        contains: safeString(req.query.company),
        mode: "insensitive",
      };
    }

    const total = await prisma.disciplineAssessment.count({ where: filters });
    const items = await prisma.disciplineAssessment.findMany({
      where: filters,
      orderBy: [{ orderNumber: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const formatScore = (value) => (value == null ? null : Number(Number(value).toFixed(2)));

    const formatted = items.map((item) => ({
      ...item,
      infantryScore: formatScore(item.infantryScore),
      drillScore: formatScore(item.drillScore),
      practiceScore: formatScore(item.practiceScore),
      regulationScore: formatScore(item.regulationScore),
      totalScore: formatScore(item.totalScore),
      averageScore: formatScore(item.averageScore),
    }));

    return res.json({
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      data: formatted,
    });
  } catch (err) {
    console.error("listDisciplineAssessments failed:", err);
    return res.status(500).json({
      message: "ไม่สามารถดึงข้อมูลผลการประเมินด้านวินัยได้",
      detail: err?.message,
    });
  }
};

module.exports = {
  importDisciplineAssessments,
  listDisciplineAssessments,
};
