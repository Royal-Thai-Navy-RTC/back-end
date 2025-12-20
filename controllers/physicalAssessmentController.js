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

const MIN_HEADER_ROW = 0; // start scanning from the first row

const getMergedCellValue = (rowIndex, colIndex, rows, worksheet, merges) => {
  const row = rows[rowIndex];
  const direct = row ? row[colIndex] : undefined;
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
      const startAddress = XLSX.utils.encode_cell({
        r: merge.s.r,
        c: merge.s.c,
      });
      const startCell = worksheet[startAddress];
      if (startCell && startCell.v !== undefined && startCell.v !== null) {
        return startCell.v;
      }
      const fallbackRow = rows[merge.s.r];
      const fallbackValue = fallbackRow ? fallbackRow[merge.s.c] : undefined;
      if (
        fallbackValue !== undefined &&
        fallbackValue !== null &&
        fallbackValue !== ""
      ) {
        return fallbackValue;
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
  const mergeMax = merges.reduce(
    (max, merge) => Math.max(max, merge.e.c + 1),
    0
  );
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

const findPhysicalSheetName = (workbook) => {
  const target = "ด้านร่างกาย";
  return workbook.SheetNames.find((name) => {
    if (!name) return false;
    return normalizeText(name).replace(/\s+/g, "") === target;
  });
};

const containsAll = (text, keywords) =>
  keywords.every((word) => text.includes(word));

const containsAny = (text, keywords) =>
  keywords.some((word) => word && text.includes(word));

const HEADER_KEYWORDS = [
  "สถานี",
  "หัวข้อ",
  "สังกัด",
  "กองร้อย",
  "กองพัน",
  "คะแนนรวม",
  "หมายเหตุ",
  "ลำดับ",
  "station",
  "topic",
  "company",
  "battalion",
  "score",
  "total",
  "note",
  "remarks",
  "order",
];
const NOTE_HEADER_KEYWORDS = ["หมายเหตุ", "note", "remarks"];
const SCORE_HEADER_KEYWORDS = ["คะแนน", "score"];

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
  for (
    let rowIndex = Math.max(primaryHeaderRow - 1, 0);
    rowIndex >= 0;
    rowIndex--
  ) {
    addRow(rowIndex);
  }

  for (const rowIndex of rowCandidates) {
    const rawValue = getMergedCellValue(
      rowIndex,
      colIndex,
      rows,
      worksheet,
      merges
    );
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

const findHeaderRowIndex = (rows, worksheet, merges, maxCols) => {
  if (!Array.isArray(rows)) return -1;
  for (let index = MIN_HEADER_ROW; index < rows.length; index++) {
    const normalized = getNormalizedRow(
      index,
      worksheet,
      rows,
      merges,
      maxCols
    );
    if (normalized.some((cell) => containsAny(cell, HEADER_KEYWORDS))) {
      return index;
    }
  }
  return -1;
};

const buildColumnMap = (headerRows, worksheet, rows, merges, maxCols) => {
  const map = {};
  if (!Array.isArray(headerRows) || headerRows.length === 0) return map;

  for (let col = 0; col < maxCols; col++) {
    const normalized = headerRows
      .map((rowIndex) =>
        normalizeText(
          getMergedCellValue(rowIndex, col, rows, worksheet, merges)
        )
      )
      .join(" ");
    if (!normalized) continue;

    if (!map.note && containsAny(normalized, ["หมายเหตุ", "note", "remarks"])) {
      map.note = col;
      continue;
    }
    if (
      !map.average &&
      containsAny(normalized, ["คะแนนรวมเฉลี่ย", "เฉลี่ย", "average"])
    ) {
      map.average = col;
      continue;
    }
    if (!map.total && containsAny(normalized, ["คะแนนรวม", "total"])) {
      map.total = col;
      continue;
    }
    if (
      !map.sitUp &&
      containsAll(normalized, ["ลุก", "นั่ง"]) &&
      containsAny(normalized, ["สถานี", "คะแนน", "sit", "station"])
    ) {
      map.sitUp = col;
      continue;
    }
    if (!map.pushUp && containsAll(normalized, ["ดัน", "พื้น"])) {
      map.pushUp = col;
      continue;
    }
    if (!map.run && containsAny(normalized, ["วิ่ง", "กม", "กิโล"])) {
      map.run = col;
      continue;
    }
    if (!map.physicalRoutine && containsAny(normalized, ["กายบริหาร"])) {
      map.physicalRoutine = col;
      continue;
    }
    if (
      !map.company &&
      containsAny(normalized, ["กองร้อย", "สังกัด", "หน่วย", "company"])
    ) {
      map.company = col;
      continue;
    }
    if (!map.battalion && containsAny(normalized, ["กองพัน", "battalion"])) {
      map.battalion = col;
      continue;
    }
    if (!map.order && containsAny(normalized, ["ลำดับ"])) {
      map.order = col;
      continue;
    }
  }

  return map;
};

const importPhysicalAssessments = async (req, res) => {
  if (!req.file || !req.file.path) {
    return res
      .status(400)
      .json({ message: "กรุณาอัปโหลดไฟล์ Excel ในฟิลด์ 'file'" });
  }

  const filePath = req.file.path;

  try {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = findPhysicalSheetName(workbook);
    if (!sheetName) {
      return res.status(400).json({
        message: "ไม่พบ sheet 'ด้านร่างกาย' ในไฟล์ที่อัปโหลด",
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
          "ไม่พบแถวหัวตารางที่มีคำว่า 'สถานี'/'คะแนนรวม' หรือคำศัพท์หัวตารางที่คล้ายกัน",
      });
    }

    const nextRowIndex = headerRowIndex + 1;
    const nextRowNormalized =
      nextRowIndex < rows.length
        ? getNormalizedRow(nextRowIndex, worksheet, rows, merges, maxCols)
        : [];

    const hasSecondaryHeader = nextRowNormalized.some((cell) =>
      containsAny(cell, ["สถานี", "กอง", "คะแนน", "หมายเหตุ"])
    );

    const headerIndices = [headerRowIndex];
    if (hasSecondaryHeader) headerIndices.push(nextRowIndex);

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

    // สร้าง map เดิมก่อน
    const columnMap = buildColumnMap(
      headerIndices,
      worksheet,
      rows,
      merges,
      maxCols
    );

    const getCellValue = (rowIndex, colIndex) =>
      getMergedCellValue(rowIndex, colIndex, rows, worksheet, merges);

    // ============================================================
    // ✅ FIX เด็ดขาด: Override columnMap ด้วย “หัวตารางจริง”
    // ============================================================
    const normalizeHeader = (v) => {
      const s = normalizeText(safeString(v || ""));
      // บางไฟล์มีวรรณยุกต์/เว้นวรรค/ตัวเลขไทย
      return thaiDigitsToArabic(s).replace(/\s+/g, " ").trim();
    };

    const findColByHeaderKeywords = (keywords) => {
      // keywords: array of strings (already normalized-ish)
      for (const r of headerIndices) {
        for (let c = 0; c < maxCols; c++) {
          const cell = normalizeHeader(getCellValue(r, c));
          if (!cell) continue;
          for (const kw of keywords) {
            const nkw = normalizeHeader(kw);
            if (cell.includes(nkw)) return c;
          }
        }
      }
      return null;
    };

    // map ตามหัวจริงในไฟล์ด้านร่างกาย
    const colCompany = findColByHeaderKeywords(["กองร้อยฝึก", "กองร้อย"]);
    const colBattalion = findColByHeaderKeywords(["กองพันฝึก", "กองพัน"]);
    const colSitUp = findColByHeaderKeywords(["สถานีลุก-นั่ง", "ลุก-นั่ง"]);
    const colPushUp = findColByHeaderKeywords(["สถานีดันพื้น", "ดันพื้น"]);
    const colRun = findColByHeaderKeywords(["สถานีวิ่ง", "วิ่ง"]);
    const colRoutine = findColByHeaderKeywords(["กายบริหารราชนาวี", "กายบริหาร"]);
    const colTotal = findColByHeaderKeywords(["คะแนนรวม"]);
    const colAvg = findColByHeaderKeywords(["คะแนนรวมเฉลี่ย", "เฉลี่ย"]);
    const colNote = findColByHeaderKeywords(["หมายเหตุ"]);

    // ✅ override ถ้าเจอ
    if (colCompany != null) columnMap.company = colCompany;
    if (colBattalion != null) columnMap.battalion = colBattalion;
    if (colSitUp != null) columnMap.sitUp = colSitUp;
    if (colPushUp != null) columnMap.pushUp = colPushUp;
    if (colRun != null) columnMap.run = colRun;
    if (colRoutine != null) columnMap.physicalRoutine = colRoutine;
    if (colTotal != null) columnMap.total = colTotal;
    if (colAvg != null) columnMap.average = colAvg;
    if (colNote != null) columnMap.note = colNote;

    // ✅ (optional) ให้ order = company เพื่อใช้ต่อได้ถ้าโค้ดอื่นอ้าง
    if (!columnMap.order && columnMap.company != null) {
      columnMap.order = columnMap.company;
    }

    // ตรวจขั้นต่ำ
    if (columnMap.company == null || columnMap.sitUp == null || columnMap.total == null) {
      return res.status(400).json({
        message:
          "หัวตารางไม่ครบถ้วน (ต้องมีอย่างน้อย กองร้อยฝึก, สถานีลุก-นั่ง, คะแนนรวม)",
        debug: {
          company: columnMap.company,
          battalion: columnMap.battalion,
          sitUp: columnMap.sitUp,
          total: columnMap.total,
        },
      });
    }

    // ============================================================
    // ✅ parse data
    // ============================================================
    const dataStartIndex = startIndex;
    const dataRows = rows.slice(dataStartIndex);
    const totalRows = dataRows.length;

    const sourceFile =
      path.basename(req.file.originalname || req.file.filename || "") || null;

    const batchId =
      safeString(req.body?.batchId || req.query?.batchId) ||
      `physical-assessment-${Date.now()}`;

    const importerId = Number(req.userId);
    const canonicalSheetName = safeString(sheetName);

    const records = [];

    // battalion มัก merge -> carry forward
    let lastBattalionValue = null;

    for (let idx = 0; idx < dataRows.length; idx++) {
      const rowIndex = dataStartIndex + idx;

      // ✅ company: ต้องอ่าน “ทุกแถว”
      const rawCompanyText = safeString(getCellValue(rowIndex, columnMap.company));
      const companyValue = thaiDigitsToArabic(rawCompanyText) || null;

      // ✅ battalion: อาจว่างเพราะ merge -> carry forward
      const rawBattalionText =
        columnMap.battalion != null ? safeString(getCellValue(rowIndex, columnMap.battalion)) : "";
      const normalizedBattalionText = thaiDigitsToArabic(rawBattalionText) || "";
      let battalionValue = null;

      if (normalizedBattalionText) {
        battalionValue = normalizedBattalionText;
        lastBattalionValue = normalizedBattalionText;
      } else if (lastBattalionValue) {
        battalionValue = lastBattalionValue;
      }

      const sitUpScore = parseNumeric(getCellValue(rowIndex, columnMap.sitUp));
      const pushUpScore =
        columnMap.pushUp != null ? parseNumeric(getCellValue(rowIndex, columnMap.pushUp)) : null;
      const runScore =
        columnMap.run != null ? parseNumeric(getCellValue(rowIndex, columnMap.run)) : null;
      const physicalRoutineScore =
        columnMap.physicalRoutine != null
          ? parseNumeric(getCellValue(rowIndex, columnMap.physicalRoutine))
          : null;
      const totalScore = parseNumeric(getCellValue(rowIndex, columnMap.total));
      const averageScore =
        columnMap.average != null ? parseNumeric(getCellValue(rowIndex, columnMap.average)) : null;

      const rawNote =
        columnMap.note != null ? safeString(getCellValue(rowIndex, columnMap.note)) : "";
      const normalizedNote = normalizeText(rawNote);
      if (NOTE_HEADER_KEYWORDS.includes(normalizedNote)) continue;

      const note = rawNote ? thaiDigitsToArabic(rawNote) : null;
      const ranking = parseRankingFromNote(note);

      const hasScore =
        sitUpScore != null ||
        pushUpScore != null ||
        runScore != null ||
        physicalRoutineScore != null ||
        totalScore != null ||
        averageScore != null;

      if (!hasScore) continue;

      // ต้องมี location อย่างน้อยอย่างใดอย่างหนึ่ง
      const hasLocation = !!(companyValue || battalionValue);
      if (!hasLocation) continue;

      const companyInt = parseInteger(companyValue);
      const battalionInt = parseInteger(battalionValue);

      // ✅ DEBUG (ลบได้ทีหลัง)
      // console.log("DEBUG", { rowIndex, companyValue, battalionValue, totalScore });

      records.push({
        orderNumber: records.length + 1,
        battalion: battalionInt != null ? String(battalionInt) : battalionValue || null,
        company: companyInt != null ? String(companyInt) : companyValue || null,
        sitUpScore,
        pushUpScore,
        runScore,
        physicalRoutineScore,
        totalScore,
        averageScore,
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
        message: "ไม่พบข้อมูลที่ต้องการนำเข้าใน sheet 'ด้านร่างกาย'",
      });
    }

    const result = await prisma.physicalAssessment.createMany({
      data: records,
    });

    return res.status(201).json({
      message: "นำเข้าข้อมูลผลการประเมินด้านร่างกายสำเร็จ",
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
    console.error("importPhysicalAssessments failed:", err);
    return res.status(500).json({
      message: "ไม่สามารถอ่านหรือบันทึกข้อมูลได้",
      detail: err?.message,
    });
  } finally {
    fs.existsSync(filePath) && fs.unlinkSync(filePath);
  }
};


const listPhysicalAssessments = async (req, res) => {
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

    const total = await prisma.physicalAssessment.count({ where: filters });
    const items = await prisma.physicalAssessment.findMany({
      where: filters,
      orderBy: [{ orderNumber: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const formatScore = (value) =>
      value == null ? null : Number(Number(value).toFixed(2));

    const formatted = items.map((item) => ({
      ...item,
      sitUpScore: formatScore(item.sitUpScore),
      pushUpScore: formatScore(item.pushUpScore),
      runScore: formatScore(item.runScore),
      physicalRoutineScore: formatScore(item.physicalRoutineScore),
      totalScore: formatScore(item.totalScore),
      averageScore: formatScore(item.averageScore),
    }));

    const formattedItems = formatted.map((item) => ({
      ...item,
      battalion: item.battalion ? parseInt(item.battalion) : null,
      company: item.company ? parseInt(item.company) : null,
    }));

    return res.json({
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      data: formattedItems,
    });
  } catch (err) {
    console.error("listPhysicalAssessments failed:", err);
    return res.status(500).json({
      message: "ไม่สามารถดึงข้อมูลผลการประเมินด้านร่างกายได้",
      detail: err?.message,
    });
  }
};

const summarizePhysicalAssessments = async (req, res) => {
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

    const rows = await prisma.physicalAssessment.findMany({
      select: {
        battalion: true,
        company: true,
        averageScore: true,
        totalScore: true,
      },
    });

    const key = (b, c) => `${b || ""}__${c || ""}`;
    const agg = new Map();

    rows.forEach((row) => {
      const battalionCode = extractCode(row.battalion);
      const companyCode = extractCode(row.company);
      const score = row.averageScore ?? row.totalScore;
      if (!battalionCode || !companyCode) return;
      if (score == null || Number.isNaN(Number(score))) return;
      const k = key(battalionCode, companyCode);
      const prev = agg.get(k) || { sum: 0, count: 0 };
      prev.sum += Number(score);
      prev.count += 1;
      agg.set(k, prev);
    });

    const battalions = battalionCodesList.map((bCode) => {
      let battalionCompanySum = 0;
      let battalionHasAnyCompany = false;

      const companies = companyCodesList.map((cCode) => {
        const a = agg.get(key(bCode, cCode));
        const avg = a && a.count > 0 ? a.sum : null;
        if (avg != null) {
          battalionHasAnyCompany = true;
          battalionCompanySum += avg;
        }
        return {
          battalionCode: bCode,
          companyCode: cCode,
          averageScore: avg != null ? Number(avg.toFixed(2)) : null,
          total: a ? a.count : 0,
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
    console.error("summarizePhysicalAssessments failed:", err);
    return res.status(500).json({
      message: "ไม่สามารถสรุปผลการประเมินด้านร่างกายได้",
      detail: err?.message,
    });
  }
};

const deletePhysicalAssessmentById = async (req, res) => {
  const assessmentId = Number(req.params.id);
  if (!Number.isInteger(assessmentId) || assessmentId <= 0) {
    return res.status(400).json({ message: "id ไม่ถูกต้อง" });
  }
  try {
    const deleted = await prisma.physicalAssessment.delete({
      where: { id: assessmentId },
    });
    return res.json({ message: "ลบข้อมูลสำเร็จ", deleted });
  } catch (err) {
    if (err.code === "P2025") {
      return res
        .status(404)
        .json({ message: "ไม่พบข้อมูลการประเมินด้านร่างกาย" });
    }
    console.error("deletePhysicalAssessmentById failed:", err);
    return res.status(500).json({
      message: "ไม่สามารถลบข้อมูลผลการประเมินด้านร่างกายได้",
      detail: err?.message,
    });
  }
};

const deleteAllPhysicalAssessments = async (_req, res) => {
  try {
    const result = await prisma.physicalAssessment.deleteMany();
    return res.json({
      message: "ลบข้อมูลทั้งหมดสำเร็จ",
      deleted: result.count,
    });
  } catch (err) {
    console.error("deleteAllPhysicalAssessments failed:", err);
    return res.status(500).json({
      message: "ไม่สามารถลบข้อมูลได้",
      detail: err?.message,
    });
  }
};

module.exports = {
  importPhysicalAssessments,
  listPhysicalAssessments,
  summarizePhysicalAssessments,
  deletePhysicalAssessmentById,
  deleteAllPhysicalAssessments,
};
