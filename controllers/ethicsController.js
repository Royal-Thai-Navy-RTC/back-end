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
  thaiDigitsToArabic(
    safeString(value).toLowerCase().replace(/\s+/g, " ")
  );

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
  const normalized = normalizeText(note);
  const match = normalized.match(/(?:อันดับ|ลำดับ)\s*([๐-๙0-9]+)/i);
  if (!match) return null;
  const digits = thaiDigitsToArabic(match[1]);
  const num = Number(digits);
  return Number.isFinite(num) ? Math.round(num) : null;
};

const containsAny = (text, keywords) => {
  if (!text || !keywords?.length) return false;
  return keywords.some((word) => word && text.includes(word));
};

const getMergedCellValue = (rowIndex, colIndex, rows, worksheet, merges) => {
  if (rowIndex == null || colIndex == null) return null;
  const row = rows[rowIndex];
  const direct = Array.isArray(row) ? row[colIndex] : undefined;
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

const getNormalizedRow = (rowIndex, worksheet, rows, merges, maxCols) => {
  const normalized = [];
  for (let col = 0; col < maxCols; col++) {
    const value = getMergedCellValue(rowIndex, col, rows, worksheet, merges);
    normalized.push(normalizeText(value));
  }
  return normalized;
};

const findEthicsSheetName = (workbook) => {
  const target = "ด้านจริยธรรม";
  return workbook.SheetNames.find((name) => {
    if (!name) return false;
    return normalizeText(name).replace(/\s+/g, "") === target;
  });
};

const HEADER_KEYWORDS = [
  "สังกัด",
  "กองร้อย",
  "กองพัน",
  "company",
  "battalion",
  "ร้อยละ",
  "คิดเป็น",
  "คะแนน",
  "หมายเหตุ",
];

const findHeaderRowIndex = (rows, worksheet, merges, maxCols) => {
  if (!Array.isArray(rows)) return -1;
  for (let index = 0; index < rows.length; index++) {
    const normalized = getNormalizedRow(index, worksheet, rows, merges, maxCols);
    const matches = normalized.some((cell) => containsAny(cell, HEADER_KEYWORDS));
    if (matches) {
      return index;
    }
  }
  return -1;
};

const buildColumnMap = (headerRows, worksheet, rows, merges, maxCols) => {
  const map = {
    averageCandidates: [],
  };
  if (!Array.isArray(headerRows) || headerRows.length === 0) return map;

  for (let col = 0; col < maxCols; col++) {
    const combined = headerRows
      .map((rowIndex) =>
        normalizeText(
          getMergedCellValue(rowIndex, col, rows, worksheet, merges)
        )
      )
      .filter(Boolean)
      .join(" ");
    if (!combined) continue;

    if (map.company === undefined && containsAny(combined, ["กองร้อย", "company", "หน่วย", "สังกัด"])) {
      map.company = col;
      continue;
    }
    if (map.battalion === undefined && containsAny(combined, ["กองพัน", "battalion"])) {
      map.battalion = col;
      continue;
    }
    if (map.score20 === undefined && containsAny(combined, ["คุณธรรม", "จริยธรรม", "20"])) {
      map.score20 = col;
      continue;
    }
    if (map.percentage === undefined && containsAny(combined, ["ร้อยละ", "percent"])) {
      map.percentage = col;
      continue;
    }
    if (containsAny(combined, ["คะแนนรวม", "average"])) {
      if (map.average === undefined) {
        map.average = col;
      }
      if (!map.averageCandidates.includes(col)) {
        map.averageCandidates.push(col);
      }
      continue;
    }
    if (map.note === undefined && containsAny(combined, ["หมายเหตุ", "note", "remarks", "อันดับ"])) {
      map.note = col;
      continue;
    }
  }

  if (map.average && map.averageCandidates.length === 0) {
    map.averageCandidates.push(map.average);
  }
  return map;
};

const isSecondaryHeaderRow = (rowValues) =>
  rowValues.some((cell) =>
    containsAny(cell, [
      "คะแนน",
      "average",
      "คิดเป็น",
      "status",
      "station",
      "topic",
      "หัวข้อ",
      "สถานี",
      "หมายเหตุ",
      "order",
    ])
  );

const NOTE_HEADER_KEYWORDS = ["หมายเหตุ", "note", "remarks"];

const importEthicsAssessments = async (req, res) => {
  if (!req.file || !req.file.path) {
    return res
      .status(400)
      .json({ message: "กรุณาอัปโหลดไฟล์ Excel ในฟิลด์ 'file'" });
  }

  const filePath = req.file.path;
  try {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = findEthicsSheetName(workbook);
    if (!sheetName) {
      return res.status(400).json({
        message: "ไม่พบ sheet 'ด้านจริยธรรม' ในไฟล์ที่อัปโหลด",
      });
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
    });
    const merges = Array.isArray(worksheet["!merges"])
      ? worksheet["!merges"]
      : [];
    const maxCols = getMaxColumns(rows, merges);
    const headerRowIndex = findHeaderRowIndex(rows, worksheet, merges, maxCols);
    if (headerRowIndex === -1) {
      return res.status(400).json({
        message:
          "ไม่พบแถวหัวตารางที่มีคำว่า 'กองร้อย'/'คุณธรรม'/'หมายเหตุ' หรือคำอื่นที่เกี่ยวข้อง",
      });
    }

    const headerRows = [headerRowIndex];
    const nextRowIndex = headerRowIndex + 1;
    if (nextRowIndex < rows.length) {
      const nextRowNormalized = getNormalizedRow(
        nextRowIndex,
        worksheet,
        rows,
        merges,
        maxCols
      );
      if (isSecondaryHeaderRow(nextRowNormalized)) {
        headerRows.push(nextRowIndex);
      }
    }

    const dataStartIndex = headerRowIndex + headerRows.length;
    const columnMap = buildColumnMap(
      headerRows,
      worksheet,
      rows,
      merges,
      maxCols
    );
    const headerRowValues = Array.isArray(rows[headerRowIndex])
      ? rows[headerRowIndex]
      : [];
    const needsColumnFallback =
      columnMap.company == null || columnMap.score20 == null;
    if (needsColumnFallback) {
      headerRowValues.forEach((cell, idx) => {
        const normalized = normalizeText(cell);
        if (
          columnMap.company == null &&
          containsAny(normalized, ["สังกัด", "กองร้อย", "company"])
        ) {
          columnMap.company = idx;
        }
        if (
          columnMap.score20 == null &&
          containsAny(normalized, ["คุณธรรม", "จริยธรรม", "20", "(20)"])
        ) {
          columnMap.score20 = idx;
        }
      });
    }

    if (columnMap.company == null || columnMap.score20 == null) {
      return res.status(400).json({
        message:
          "หัวตารางไม่ครบถ้วน (ต้องมีอย่างน้อย กองร้อยฝึก และคะแนนด้านจริยธรรม)",
      });
    }

    const sourceFile =
      path.basename(req.file.originalname || req.file.filename || "") || null;
    const batchId =
      safeString(req.body?.batchId || req.query?.batchId) ||
      `ethics-assessment-${Date.now()}`;
    const importerId = Number(req.userId);
    const canonicalSheetName = safeString(sheetName);

    const records = [];
    let lastCompanyValue = null;
    let lastBattalionValue = null;

    const totalRows = Math.max(0, rows.length - dataStartIndex);

    for (let rowIndex = dataStartIndex; rowIndex < rows.length; rowIndex++) {
      const companyText = safeString(
        getMergedCellValue(
          rowIndex,
          columnMap.company,
          rows,
          worksheet,
          merges
        )
      );
      const companyValue = companyText || lastCompanyValue;
      if (companyText) {
        lastCompanyValue = companyText;
      }

      const battalionText = columnMap.battalion
        ? safeString(
            getMergedCellValue(
              rowIndex,
              columnMap.battalion,
              rows,
              worksheet,
              merges
            )
          )
        : "";
      const battalionValue = battalionText || lastBattalionValue;
      if (battalionText) {
        lastBattalionValue = battalionText;
      }

      const score20 = parseNumeric(
        getMergedCellValue(
          rowIndex,
          columnMap.score20,
          rows,
          worksheet,
          merges
        )
      );
      const percentage = columnMap.percentage
        ? parseNumeric(
            getMergedCellValue(
              rowIndex,
              columnMap.percentage,
              rows,
              worksheet,
              merges
            )
          )
        : null;

      let average100 = null;
      for (const candidate of columnMap.averageCandidates || []) {
        const candidateValue = parseNumeric(
          getMergedCellValue(rowIndex, candidate, rows, worksheet, merges)
        );
        if (candidateValue != null) {
          average100 = candidateValue;
          break;
        }
      }

      const rawNote = columnMap.note
        ? safeString(
            getMergedCellValue(
              rowIndex,
              columnMap.note,
              rows,
              worksheet,
              merges
            )
          )
        : "";
      const normalizedNote = normalizeText(rawNote);
      if (
        NOTE_HEADER_KEYWORDS.includes(normalizedNote) ||
        !companyValue && !battalionValue && !score20 && !percentage && !average100
      ) {
        continue;
      }

      const hasScore = score20 != null || percentage != null || average100 != null;
      if (!hasScore) {
        continue;
      }

      const noteValue = rawNote || null;
      const ranking = parseRankingFromNote(noteValue);
      const parsedOrder = parseInteger(companyValue);
      const orderNumber =
        parsedOrder != null ? parsedOrder : records.length + 1;

      records.push({
        orderNumber,
        battalion: battalionValue || null,
        company: companyValue || null,
        score20,
        percentage,
        average100,
        note: noteValue,
        ranking,
        batchId,
        sourceFile,
        sheetName: canonicalSheetName,
        importedById: Number.isFinite(importerId) ? importerId : null,
      });
    }

    if (records.length === 0) {
      return res.status(400).json({
        message: "ไม่พบข้อมูลที่สามารถนำเข้าได้ใน sheet 'ด้านจริยธรรม'",
      });
    }

    const result = await prisma.ethicsAssessment.createMany({
      data: records,
    });

    return res.status(201).json({
      message: "นำเข้าข้อมูลผลการประเมินด้านจริยธรรมสำเร็จ",
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
    console.error("importEthicsAssessments failed:", err);
    return res.status(500).json({
      message: "ไม่สามารถอ่านหรือบันทึกข้อมูลได้",
      detail: err?.message,
    });
  } finally {
    fs.existsSync(filePath) && fs.unlinkSync(filePath);
  }
};

const listEthicsAssessments = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(
      200,
      Math.max(1, Number(req.query.pageSize) || 50)
    );
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

    const total = await prisma.ethicsAssessment.count({ where: filters });
    const items = await prisma.ethicsAssessment.findMany({
      where: filters,
      orderBy: [
        { battalion: "asc" },
        { company: "asc" },
        { orderNumber: "asc" },
        { id: "asc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const formatScore = (value) =>
      value == null ? null : Number(Number(value).toFixed(2));

    const formatted = items.map((item) => ({
      ...item,
      score20: formatScore(item.score20),
      percentage: formatScore(item.percentage),
      average100: formatScore(item.average100),
    }));

    const formattedItems = formatted.map(item => ({
      ...item,
      battalion: item.battalion ? parseInt(item.battalion) : null,
      company: item.company ? parseInt(item.company) : null
    }));

    return res.json({
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      data: formattedItems,
    });
  } catch (err) {
    console.error("listEthicsAssessments failed:", err);
    return res.status(500).json({
      message: "ไม่สามารถดึงข้อมูลการประเมินด้านจริยธรรมได้",
      detail: err?.message,
    });
  }
};

module.exports = {
  importEthicsAssessments,
  listEthicsAssessments,
};
