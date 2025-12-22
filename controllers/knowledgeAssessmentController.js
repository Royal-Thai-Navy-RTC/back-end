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

const formatTwoDecimals = (value) =>
  typeof value === "number" ? Number(value.toFixed(2)) : null;

const extractNumberCode = (value) => {
  const normalized = thaiDigitsToArabic(safeString(value));
  if (!normalized) return null;
  const match = normalized.match(/(\d+)/);
  return match ? match[1] : null;
};

const computeAverageScore = (practical, theory, total) => {
  const values = [practical, theory, total]
    .map((v) => (typeof v === "number" ? v : null))
    .filter((v) => v != null && Number.isFinite(v));
  if (!values.length) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return formatTwoDecimals(sum / values.length);
};

const getExtremesByAverageScore = (companies = []) => {
  const candidates = companies.filter(
    (c) => typeof c.averageScores?.averageScore === "number"
  );
  if (!candidates.length) return { highest: null, lowest: null };
  const sorted = [...candidates].sort((a, b) => {
    const diff = b.averageScores.averageScore - a.averageScores.averageScore;
    if (diff !== 0) return diff;
    return String(a.company || "").localeCompare(String(b.company || ""));
  });
  return { highest: sorted[0], lowest: sorted[sorted.length - 1] };
};

const parseRankingFromNote = (note) => {
  if (!note) return null;
  const normalized = safeString(note);
  const match = normalized.match(/(?:อันดับ|ลำดับ)\s*([๐-๙0-9]+)/i);
  if (!match) return null;
  const digits = thaiDigitsToArabic(match[1]);
  const num = Number(digits);
  return Number.isFinite(num) ? Math.round(num) : null;
};

const normalizeText = (value) =>
  safeString(value).toLowerCase().replace(/\s+/g, " ");

const extractDigitsFromText = (value) => {
  const text = safeString(value);
  if (!text) return null;
  const normalized = thaiDigitsToArabic(text);
  const match = normalized.match(/\d+/);
  return match ? match[0] : null;
};

const MIN_HEADER_ROW = 0;

const getMergedCellValue = (rowIndex, colIndex, rows, worksheet, merges) => {
  if (rowIndex == null || colIndex == null) return undefined;
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

const containsAny = (text, keywords) => {
  if (!text || !keywords?.length) return false;
  return keywords.some((word) => word && text.includes(word));
};

const containsAll = (text, keywords) => {
  if (!text || !keywords?.length) return false;
  return keywords.every((word) => word && text.includes(word));
};

const GENERIC_LOCATION_LABELS = [
  "สังกัด",
  "company",
  "battalion",
  "หัวข้อ",
  "สถานี",
  "score",
  "total",
  "หมายเหตุ",
  "note",
  "remarks",
];

const isGenericLocationLabel = (text) => {
  if (!text) return true;
  const trimmed = text.replace(/\s+/g, "");
  if (!trimmed) return true;
  if (/^\d+$/.test(trimmed)) {
    return true;
  }
  return GENERIC_LOCATION_LABELS.some(
    (keyword) => text === keyword || text.includes(keyword)
  );
};

const deduceLocationFromHeaderRows = (
  colIndex,
  headerRows,
  rows,
  worksheet,
  merges,
  primaryHeaderRow
) => {
  if (colIndex == null) return null;
  const seen = new Set();
  const rowCandidates = [];
  const addRow = (rowIndex) => {
    if (
      rowIndex == null ||
      rowIndex < 0 ||
      seen.has(rowIndex) ||
      rowIndex >= rows.length
    ) {
      return;
    }
    seen.add(rowIndex);
    rowCandidates.push(rowIndex);
  };
  (headerRows || [])
    .slice()
    .sort((a, b) => b - a)
    .forEach(addRow);
  for (let rowIndex = Math.max(primaryHeaderRow - 1, 0); rowIndex >= 0; rowIndex--) {
    addRow(rowIndex);
  }

  for (const rowIndex of rowCandidates) {
    const rawValue = getMergedCellValue(rowIndex, colIndex, rows, worksheet, merges);
    const safeValue = safeString(rawValue);
    if (!safeValue) continue;
    const normalized = normalizeText(safeValue);
    if (isGenericLocationLabel(normalized)) {
      continue;
    }
    return safeValue;
  }
  return null;
};

const findKnowledgeSheetName = (workbook) => {
  const target = "ความรู้";
  return workbook.SheetNames.find((name) => {
    if (!name) return false;
    return normalizeText(name).replace(/\s+/g, "") === target;
  });
};

const HEADER_KEYWORDS = [
  "สังกัด",
  "กองร้อย",
  "กองพัน",
  "ภาคปฏิบัติ",
  "ภาคทฤษฎี",
  "คะแนนรวม",
  "คะแนนเฉลี่ย",
  "หมายเหตุ",
  "ลำดับ",
  "อันดับ",
  "company",
  "battalion",
  "practical",
  "theory",
  "total",
  "average",
  "note",
  "order",
  "ranking",
];

const NOTE_HEADER_KEYWORDS = ["หมายเหตุ", "note", "remarks"];
const SCORE_HEADER_KEYWORDS = ["คะแนน", "score"];

const findHeaderRowIndex = (rows, worksheet, merges, maxCols) => {
  if (!Array.isArray(rows)) return -1;
  for (let index = MIN_HEADER_ROW; index < rows.length; index++) {
    const normalized = getNormalizedRow(index, worksheet, rows, merges, maxCols);
    const matches = normalized.some((cell) => containsAny(cell, HEADER_KEYWORDS));
    if (matches) {
      return index;
    }
  }
  return -1;
};

const buildColumnMap = (headerRows, worksheet, rows, merges, maxCols) => {
  const map = {};
  if (!Array.isArray(headerRows) || headerRows.length === 0) return map;

  for (let col = 0; col < maxCols; col++) {
    const combined = headerRows
      .map((rowIndex) =>
        normalizeText(getMergedCellValue(rowIndex, col, rows, worksheet, merges))
      )
      .filter(Boolean)
      .join(" ");
    if (!combined) continue;

    if (
      map.note === undefined &&
      containsAny(combined, ["หมายเหตุ", "note", "remarks"])
    ) {
      map.note = col;
      continue;
    }
    if (
      map.average === undefined &&
      containsAny(combined, [
        "คะแนนรวมเฉลี่ย",
        "เฉลี่ย",
        "average",
        "ร้อยละ",
        "percentage",
      ])
    ) {
      map.average = col;
      continue;
    }
    if (map.total === undefined && containsAny(combined, ["คะแนนรวม", "total"])) {
      map.total = col;
      continue;
    }
    if (
      map.practical === undefined &&
      containsAny(combined, ["ภาคปฏิบัติ", "ปฏิบัติ", "practical"])
    ) {
      map.practical = col;
      continue;
    }
    if (
      map.theory === undefined &&
      containsAny(combined, ["ภาคทฤษฎี", "ทฤษฎี", "theory"])
    ) {
      map.theory = col;
      continue;
    }
    if (
      map.company === undefined &&
      containsAny(combined, [
        "กองร้อย",
        "company",
        "หน่วย",
        "สังกัด",
        "ร้อยฝึก",
      ])
    ) {
      map.company = col;
      continue;
    }
    if (
      map.battalion === undefined &&
      containsAny(combined, ["กองพัน", "พันฝึก", "battalion"])
    ) {
      map.battalion = col;
      continue;
    }
    if (
      map.order === undefined &&
      containsAny(combined, ["ลำดับ", "order"])
    ) {
      map.order = col;
      continue;
    }
    if (
      map.ranking === undefined &&
      containsAny(combined, ["อันดับ", "ranking"])
    ) {
      map.ranking = col;
    }
  }

  return map;
};

const importKnowledgeAssessments = async (req, res) => {
  if (!req.file || !req.file.path) {
    return res
      .status(400)
      .json({ message: "กรุณาอัปโหลดไฟล์ Excel ในฟิลด์ 'file'" });
  }

  const filePath = req.file.path;
  try {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = findKnowledgeSheetName(workbook);
    if (!sheetName) {
      return res.status(400).json({
        message: "ไม่พบ sheet 'ความรู้' ในไฟล์ที่อัปโหลด",
      });
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
    });
    const merges = Array.isArray(worksheet["!merges"]) ? worksheet["!merges"] : [];
    const maxCols = getMaxColumns(rows, merges);
    const headerRowIndex = findHeaderRowIndex(rows, worksheet, merges, maxCols);
    if (headerRowIndex === -1) {
      return res.status(400).json({
        message:
          "ไม่พบแถวหัวตารางที่มีคำว่า 'สังกัด'/'คะแนนรวม' หรือคำศัพท์หัวตารางที่คล้ายกัน",
      });
    }

    const nextRowIndex = headerRowIndex + 1;
    const nextRowNormalized =
      nextRowIndex < rows.length
        ? getNormalizedRow(nextRowIndex, worksheet, rows, merges, maxCols)
        : [];
    const hasSecondaryHeader = nextRowNormalized.some((cell) =>
      containsAny(cell, ["สังกัด", "กอง", "คะแนน", "หมายเหตุ", "ภาค"])
    );
    const headerIndices = [headerRowIndex];
    if (hasSecondaryHeader) {
      headerIndices.push(nextRowIndex);
    }

    let startIndex = headerRowIndex + (hasSecondaryHeader ? 2 : 1);
    const isScoreHeaderRow = (rowIndex) => {
      const normalized = getNormalizedRow(
        rowIndex,
        worksheet,
        rows,
        merges,
        maxCols
      );
      const keywordCount = normalized.filter((cell) =>
        containsAny(cell, SCORE_HEADER_KEYWORDS)
      ).length;
      return keywordCount >= 3;
    };
    while (startIndex < rows.length && isScoreHeaderRow(startIndex)) {
      startIndex += 1;
    }

    const columnMap = buildColumnMap(
      headerIndices,
      worksheet,
      rows,
      merges,
      maxCols
    );
    const hasRequiredColumns =
      columnMap.company != null &&
      columnMap.practical != null &&
      columnMap.total != null;
    if (!hasRequiredColumns) {
      return res.status(400).json({
        message:
          "หัวตารางไม่ครบถ้วน (ต้องมีอย่างน้อย กองร้อยฝึก, ภาคปฏิบัติ, คะแนนรวม)",
      });
    }

    const dataStartIndex = startIndex;
    const dataRows = rows.slice(dataStartIndex);
    const totalRows = dataRows.length;
    const getCellValue = (rowIndex, colIndex) =>
      getMergedCellValue(rowIndex, colIndex, rows, worksheet, merges);

    const sourceFile =
      path.basename(req.file.originalname || req.file.filename || "") || null;
    const batchId =
      safeString(req.body?.batchId || req.query?.batchId) ||
      `knowledge-assessment-${Date.now()}`;
    const importerId = Number(req.userId);
    const canonicalSheetName = safeString(sheetName);
    const fallbackOrderLabel = deduceLocationFromHeaderRows(
      columnMap.order,
      headerIndices,
      rows,
      worksheet,
      merges,
      headerRowIndex
    );
    const fallbackCompanyColumnRaw = deduceLocationFromHeaderRows(
      columnMap.company,
      headerIndices,
      rows,
      worksheet,
      merges,
      headerRowIndex
    );
    const fallbackCompanyColumn = extractDigitsFromText(
      fallbackCompanyColumnRaw
    );
    const fallbackBattalionColumn = deduceLocationFromHeaderRows(
      columnMap.battalion,
      headerIndices,
      rows,
      worksheet,
      merges,
      headerRowIndex
    );

    const records = [];
    let lastOrderLabel = null;
    let lastCompanyValue = null;
    let lastBattalionValue = null;
    for (let idx = 0; idx < dataRows.length; idx++) {
      const rowIndex = dataStartIndex + idx;
      const rawOrderLabelText = columnMap.order
        ? safeString(getCellValue(rowIndex, columnMap.order))
        : "";
      const normalizedOrderLabelText =
        thaiDigitsToArabic(rawOrderLabelText) || "";
      let orderLabelValue = null;
      if (normalizedOrderLabelText) {
        orderLabelValue = normalizedOrderLabelText;
        lastOrderLabel = normalizedOrderLabelText;
      } else if (lastOrderLabel) {
        orderLabelValue = lastOrderLabel;
      } else if (fallbackOrderLabel) {
        orderLabelValue = fallbackOrderLabel;
      }
      const companyCellValue = getCellValue(rowIndex, columnMap.company);
      const companyDigits = extractDigitsFromText(companyCellValue);
      let companyValue = null;
      if (companyDigits) {
        companyValue = companyDigits;
        lastCompanyValue = companyDigits;
      } else if (lastCompanyValue) {
        companyValue = lastCompanyValue;
      } else if (fallbackCompanyColumn) {
        companyValue = fallbackCompanyColumn;
      }
      const rawBattalionText = columnMap.battalion
        ? safeString(getCellValue(rowIndex, columnMap.battalion))
        : "";
      const normalizedBattalionText = thaiDigitsToArabic(rawBattalionText) || "";
      let battalionValue = null;
      if (normalizedBattalionText) {
        battalionValue = normalizedBattalionText;
        lastBattalionValue = normalizedBattalionText;
      } else if (lastBattalionValue) {
        battalionValue = lastBattalionValue;
      } else if (fallbackBattalionColumn) {
        battalionValue = fallbackBattalionColumn;
      }
      const practicalScore = columnMap.practical
        ? parseNumeric(getCellValue(rowIndex, columnMap.practical))
        : null;
      const theoryScore = columnMap.theory
        ? parseNumeric(getCellValue(rowIndex, columnMap.theory))
        : null;
      const totalScore = columnMap.total
        ? parseNumeric(getCellValue(rowIndex, columnMap.total))
        : null;
      const averageScore = columnMap.average
        ? parseNumeric(getCellValue(rowIndex, columnMap.average))
        : null;
      const rawNote = columnMap.note
        ? safeString(getCellValue(rowIndex, columnMap.note))
        : "";
      const normalizedNote = normalizeText(rawNote);
      if (NOTE_HEADER_KEYWORDS.includes(normalizedNote)) {
        continue;
      }
      const note = rawNote ? thaiDigitsToArabic(rawNote) : null;
      const rankingFromColumn =
        columnMap.ranking != null
          ? parseInteger(getCellValue(rowIndex, columnMap.ranking))
          : null;
      const rankingFromNote = parseRankingFromNote(note);
      const ranking =
        rankingFromColumn ?? rankingFromNote ?? null;

      const hasScore =
        practicalScore != null ||
        theoryScore != null ||
        totalScore != null ||
        averageScore != null;
      if (!hasScore) {
        continue;
      }
      const hasLocation = !!(companyValue || battalionValue);
      if (!hasLocation) {
        continue;
      }

      const parsedOrder = parseInteger(orderLabelValue);
      const orderNumber =
        parsedOrder != null ? parsedOrder : records.length + 1;

      const companyResult = companyValue || null;

      records.push({
        orderNumber,
        battalion: battalionValue || null,
        company: companyResult,
        practicalScore,
        theoryScore,
        totalScore,
        averagePercentage: averageScore,
        note,
        ranking,
        batchId,
        sourceFile,
        sheetName: canonicalSheetName,
        importedById: Number.isFinite(importerId) ? importerId : null,
      });
    }

    if (records.length === 0) {
      return res.status(400).json({
        message: "ไม่พบข้อมูลที่ต้องการนำเข้าใน sheet 'ความรู้'",
      });
    }

    const result = await prisma.knowledgeAssessment.createMany({
      data: records,
    });

    return res.status(201).json({
      message: "นำเข้าข้อมูลผลการประเมินด้านความรู้สำเร็จ",
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
    console.error("importKnowledgeAssessments failed:", err);
    return res.status(500).json({
      message: "ไม่สามารถอ่านหรือบันทึกข้อมูลได้",
      detail: err?.message,
    });
  } finally {
    fs.existsSync(filePath) && fs.unlinkSync(filePath);
  }
};

const listKnowledgeAssessments = async (req, res) => {
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

    const total = await prisma.knowledgeAssessment.count({ where: filters });
    const items = await prisma.knowledgeAssessment.findMany({
      where: filters,
      orderBy: [{ orderNumber: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const formatScore = (value) =>
      value == null ? null : Number(Number(value).toFixed(2));

    const formatted = items.map((item) => ({
      ...item,
      practicalScore: formatScore(item.practicalScore),
      theoryScore: formatScore(item.theoryScore),
      totalScore: formatScore(item.totalScore),
      averagePercentage: formatScore(item.averagePercentage),
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
    console.error("listKnowledgeAssessments failed:", err);
    return res.status(500).json({
      message: "ไม่สามารถดึงข้อมูลผลการประเมินด้านความรู้ได้",
      detail: err?.message,
    });
  }
};

const getKnowledgeAssessmentsOverview = async (_req, res) => {
  try {
    const [aggregate, battalionAverages, companyAverages] = await Promise.all([
      prisma.knowledgeAssessment.aggregate({
        _count: true,
        _avg: {
          practicalScore: true,
          theoryScore: true,
          totalScore: true,
          averagePercentage: true,
        },
      }),
      prisma.knowledgeAssessment.groupBy({
        by: ["battalion"],
        where: { battalion: { not: null } },
        _count: { _all: true },
        _avg: {
          practicalScore: true,
          theoryScore: true,
          totalScore: true,
          averagePercentage: true,
        },
      }),
      prisma.knowledgeAssessment.groupBy({
        by: ["battalion", "company"],
        where: { battalion: { not: null }, company: { not: null } },
        _count: { _all: true },
        _avg: {
          practicalScore: true,
          theoryScore: true,
          totalScore: true,
          averagePercentage: true,
        },
      }),
    ]);

    const companyMap = new Map();
    companyAverages.forEach((item) => {
      const key = item.battalion || "";
      const avgPractical = formatTwoDecimals(item._avg.practicalScore);
      const avgTheory = formatTwoDecimals(item._avg.theoryScore);
      const avgTotal = formatTwoDecimals(item._avg.totalScore);
      const avgPercentage = formatTwoDecimals(item._avg.averagePercentage);
      const averageScore = computeAverageScore(
        avgPractical,
        avgTheory,
        avgTotal
      );
      const entry = {
        battalion: item.battalion,
        company: item.company,
        battalionCode: extractNumberCode(item.battalion),
        companyCode: extractNumberCode(item.company),
        total: item._count?._all ?? 0,
        averageScores: {
          practicalScore: avgPractical,
          theoryScore: avgTheory,
          totalScore: avgTotal,
          averagePercentage: avgPercentage,
          averageScore,
        },
      };
      if (!companyMap.has(key)) companyMap.set(key, []);
      companyMap.get(key).push(entry);
    });

    return res.json({
      total: aggregate._count,
      averageScores: {
        practicalScore: formatTwoDecimals(aggregate._avg.practicalScore),
        theoryScore: formatTwoDecimals(aggregate._avg.theoryScore),
        totalScore: formatTwoDecimals(aggregate._avg.totalScore),
        averagePercentage: formatTwoDecimals(aggregate._avg.averagePercentage),
        averageScore: computeAverageScore(
          aggregate._avg.practicalScore,
          aggregate._avg.theoryScore,
          aggregate._avg.totalScore
        ),
      },
      averageByBattalion: battalionAverages
        .map((item) => {
          const companies = companyMap.get(item.battalion || "") || [];
          const { highest, lowest } = getExtremesByAverageScore(companies);
          const avgPractical = formatTwoDecimals(item._avg.practicalScore);
          const avgTheory = formatTwoDecimals(item._avg.theoryScore);
          const avgTotal = formatTwoDecimals(item._avg.totalScore);
          const avgPercentage = formatTwoDecimals(item._avg.averagePercentage);
          const battalionAverageScore = computeAverageScore(
            avgPractical,
            avgTheory,
            avgTotal
          );
          return {
            battalion: item.battalion,
            battalionCode: extractNumberCode(item.battalion),
            total: item._count?._all ?? 0,
            averageScores: {
              practicalScore: avgPractical,
              theoryScore: avgTheory,
              totalScore: avgTotal,
              averagePercentage: avgPercentage,
              averageScore: battalionAverageScore,
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
    console.error("getKnowledgeAssessmentsOverview failed:", err);
    return res.status(500).json({
      message: "ไม่สามารถดึงสรุปผลการประเมินด้านความรู้ได้",
      detail: err?.message,
    });
  }
};

const deleteKnowledgeAssessmentById = async (req, res) => {
  const assessmentId = Number(req.params.id);
  if (!Number.isInteger(assessmentId) || assessmentId <= 0) {
    return res.status(400).json({ message: "id ไม่ถูกต้อง" });
  }
  try {
    const deleted = await prisma.knowledgeAssessment.delete({
      where: { id: assessmentId },
    });
    return res.json({ message: "ลบข้อมูลสำเร็จ", deleted });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ message: "ไม่พบข้อมูลการประเมินด้านความรู้" });
    }
    console.error("deleteKnowledgeAssessmentById failed:", err);
    return res.status(500).json({
      message: "ไม่สามารถลบข้อมูลผลการประเมินด้านความรู้ได้",
      detail: err?.message,
    });
  }
};

const summarizeKnowledgeAssessments = async (req, res) => {
  const extractCode = (value) => {
    const normalized = thaiDigitsToArabic(safeString(value));
    if (!normalized) return null;
    const match = normalized.match(/(\d+)/);
    return match ? match[1] : null;
  };

  try {
    const { battalionCodes, companyCodes } = req.query || {};
    const battalionCodesList =
      typeof battalionCodes === "string" && battalionCodes
        ? battalionCodes.split(",").map(safeString).filter(Boolean)
        : ["1", "2", "3", "4"];
    const companyCodesList =
      typeof companyCodes === "string" && companyCodes
        ? companyCodes.split(",").map(safeString).filter(Boolean)
        : ["1", "2", "3", "4", "5"];

    const rows = await prisma.knowledgeAssessment.findMany({
      select: {
        battalion: true,
        company: true,
        practicalScore: true,
        theoryScore: true,
        totalScore: true,
        averagePercentage: true,
      },
    });

    const key = (b, c) => `${b || ""}__${c || ""}`;
    const agg = new Map();

    rows.forEach((row) => {
      const battalionCode = extractCode(row.battalion);
      const companyCode = extractCode(row.company);
      if (!battalionCode || !companyCode) return;
      const k = key(battalionCode, companyCode);
      const prev =
        agg.get(k) || {
          practicalScore: { sum: 0, count: 0 },
          theoryScore: { sum: 0, count: 0 },
          totalScore: { sum: 0, count: 0 },
        };

      const metrics = [
        ["practicalScore", row.practicalScore],
        ["theoryScore", row.theoryScore],
        ["totalScore", row.totalScore],
      ];

      metrics.forEach(([field, value]) => {
        const num = Number(value);
        if (Number.isFinite(num)) {
          prev[field].sum += num;
          prev[field].count += 1;
        }
      });

      agg.set(k, prev);
    });

    const battalions = battalionCodesList.map((bCode) => {
      let battalionCompanySum = 0;
      let battalionHasAnyCompany = false;

      const companies = companyCodesList.map((cCode) => {
        const a = agg.get(key(bCode, cCode));
        const avgPractical =
          a && a.practicalScore.count > 0
            ? a.practicalScore.sum / a.practicalScore.count
            : null;
        const avgTheory =
          a && a.theoryScore.count > 0
            ? a.theoryScore.sum / a.theoryScore.count
            : null;
        const avgTotal =
          a && a.totalScore.count > 0
            ? a.totalScore.sum / a.totalScore.count
            : null;

        const averageScore = computeAverageScore(
          avgPractical,
          avgTheory,
          avgTotal
        );

        if (averageScore != null) {
          battalionHasAnyCompany = true;
          battalionCompanySum += averageScore;
        }
        return {
          battalionCode: bCode,
          companyCode: cCode,
          averageScore,
          total: Math.max(
            a?.practicalScore.count || 0,
            a?.theoryScore.count || 0,
            a?.totalScore.count || 0
          ),
        };
      });

      const averageScore = battalionHasAnyCompany
        ? Number((battalionCompanySum / companyCodesList.length).toFixed(2))
        : null;
      const total = companies.reduce((acc, c) => acc + (c.total || 0), 0);

      return {
        battalionCode: bCode,
        averageScore,
        total,
        companies,
      };
    });

    return res.json({ battalions });
  } catch (err) {
    console.error("summarizeKnowledgeAssessments failed:", err);
    return res.status(500).json({
      message: "ไม่สามารถสรุปผลการประเมินด้านความรู้ได้",
      detail: err?.message,
    });
  }
};

const deleteAllKnowledgeAssessments = async (_req, res) => {
  try {
    const result = await prisma.knowledgeAssessment.deleteMany();
    return res.json({ message: "ลบข้อมูลทั้งหมดสำเร็จ", deleted: result.count });
  } catch (err) {
    console.error("deleteAllKnowledgeAssessments failed:", err);
    return res.status(500).json({
      message: "ไม่สามารถลบข้อมูลได้",
      detail: err?.message,
    });
  }
};

module.exports = {
  importKnowledgeAssessments,
  listKnowledgeAssessments,
  getKnowledgeAssessmentsOverview,
  summarizeKnowledgeAssessments,
  deleteKnowledgeAssessmentById,
  deleteAllKnowledgeAssessments,
};
