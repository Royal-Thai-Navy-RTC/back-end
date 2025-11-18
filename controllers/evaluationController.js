const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const evaluationSheetInclude = {
  answers: { orderBy: { id: "asc" } },
  teacher: {
    select: { id: true, firstName: true, lastName: true, rank: true },
  },
};

const validationError = (message) => {
  const err = new Error(message);
  err.code = "VALIDATION_ERROR";
  return err;
};

const normalizeManualAnswers = (rawAnswers) => {
  if (!Array.isArray(rawAnswers) || rawAnswers.length === 0) {
    throw validationError("ต้องระบุ answers อย่างน้อย 1 ข้อ");
  }
  return rawAnswers.map((answer, index) => {
    const itemText = safeString(answer?.itemText);
    if (!itemText) {
      throw validationError(`itemText ของข้อที่ ${index + 1} ต้องไม่ว่าง`);
    }
    const rating = Number(answer?.rating);
    if (!Number.isFinite(rating)) {
      throw validationError(`rating ของข้อที่ ${index + 1} ต้องเป็นตัวเลข`);
    }
    const section = safeString(answer?.section);
    const itemCode = safeString(answer?.itemCode);
    return {
      section: section || null,
      itemCode: itemCode || null,
      itemText,
      rating: Math.max(0, Math.min(5, Math.round(rating))),
    };
  });
};

// แผนที่เดือนภาษาไทย (ย่อ/เต็ม/ไม่มีจุด) -> เดือนเลข
const THAI_MONTHS = {
  // ย่อมีจุด
  "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6,
  "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12,
  // ย่อไม่มีจุด
  "ม.ค": 1, "ก.พ": 2, "มี.ค": 3, "เม.ย": 4, "พ.ค": 5, "มิ.ย": 6,
  "ก.ค": 7, "ส.ค": 8, "ก.ย": 9, "ต.ค": 10, "พ.ย": 11, "ธ.ค": 12,
  // ย่อแบบตัดจุดทั้งหมด
  "มค": 1, "กพ": 2, "มีค": 3, "เมย": 4, "พค": 5, "มิย": 6,
  "กค": 7, "สค": 8, "กย": 9, "ตค": 10, "พย": 11, "ธค": 12,
  // เต็ม
  "มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4, "พฤษภาคม": 5, "มิถุนายน": 6,
  "กรกฎาคม": 7, "สิงหาคม": 8, "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12,
};

const safeString = (v) => (v === undefined || v === null ? "" : thaiDigitsToArabic(String(v)).trim());

const parseNumericInput = (value) => {
  if (value === undefined || value === null) return null;
  let raw = thaiDigitsToArabic(String(value)).trim();
  raw = raw.replace(/^\s*["']+|["']+\s*$/g, "");
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
};

// แปลงเลขไทย -> อารบิก
function thaiDigitsToArabic(s) {
  return String(s)
    .replace(/๐/g, "0")
    .replace(/๑/g, "1")
    .replace(/๒/g, "2")
    .replace(/๓/g, "3")
    .replace(/๔/g, "4")
    .replace(/๕/g, "5")
    .replace(/๖/g, "6")
    .replace(/๗/g, "7")
    .replace(/๘/g, "8")
    .replace(/๙/g, "9");
}

function normalizeMonthToken(token) {
  let t = safeString(token);
  if (!t) return "";
  t = t.replace(/\s+/g, "");
  t = t.replace(/เดือน/g, "");
  if (THAI_MONTHS[t] != null) return t;
  const noDot = t.replace(/\./g, "");
  return noDot;
}

function monthToNumber(token) {
  const t = normalizeMonthToken(token);
  if (THAI_MONTHS[t] != null) return THAI_MONTHS[t];
  if (THAI_MONTHS[`${t}.`] != null) return THAI_MONTHS[`${t}.`];
  return null;
}

function makeDateFromDMY(d, mToken, y) {
  const day = Number(thaiDigitsToArabic(d));
  if (!(day >= 1 && day <= 31)) return null;
  let month = monthToNumber(mToken);
  if (month == null) {
    const mNum = Number(thaiDigitsToArabic(mToken));
    if (mNum >= 1 && mNum <= 12) month = mNum;
  }
  if (month == null) return null;
  let year = Number(thaiDigitsToArabic(y));
  // year 2 หลัก -> เดาเป็น พ.ศ. 25xx
  if (year < 100) year = 2500 + year;
  // กำหนด isoYear: ถ้าเป็น พ.ศ. (>=2400) ให้ลบ 543, ถ้าเป็น ค.ศ. ให้ใช้ตรง ๆ
  const isoYear = year >= 2400 ? year - 543 : year;
  // ใช้ UTC midnight เพื่อหลีกเลี่ยงการขยับวันตาม timezone
  const jsDate = new Date(Date.UTC(isoYear, month - 1, day, 0, 0, 0));
  return isNaN(jsDate.getTime()) ? null : jsDate;
}

function tryParseThaiDateFromString(s) {
  const str = thaiDigitsToArabic(safeString(s));
  // ต้องมีคำเดือนภาษาไทยอย่างน้อยหนึ่งตัว เพื่อกันชนกับข้อมูลตัวเลขอื่น
  const hasThaiMonth = Object.keys(THAI_MONTHS).some((k) => str.includes(k.replace(/\./g, "")) || str.includes(k));
  const m = str.match(/(\d{1,2})\s*[\/\-\s]?\s*([ก-ฮ\.]+|\d{1,2})\s*[\/\-\s]?\s*(\d{2,4})/);
  if (!m) return null;
  // ถ้าไม่มีคำเดือนเลยและใช้เดือนเป็นตัวเลข อาจชนกับข้อมูลอื่น ให้ข้าม
  if (!hasThaiMonth && /^(\d{1,2})$/.test(m[2])) return null;
  if (!m) return null;
  return makeDateFromDMY(m[1], m[2], m[3]);
}

function tryParseThaiDateFromRow(row) {
  const tokens = [];
  for (const cell of row || []) {
    const s = thaiDigitsToArabic(safeString(cell));
    if (!s) continue;
    for (const t of s.split(/[\s/\-]+/)) {
      if (t) tokens.push(t);
    }
  }
  for (let i = 0; i < tokens.length - 2; i++) {
    const d = tokens[i];
    const m = tokens[i + 1];
    const y = tokens[i + 2];
    // ป้องกันชนกับตัวเลขอื่น ๆ: ถ้าเดือนไม่ใช่คำไทย ให้ยอมรับเฉพาะกรณีปี 2 หลัก
    const monthIsThaiWord = monthToNumber(m) != null && isNaN(Number(thaiDigitsToArabic(m)));
    const yNum = Number(thaiDigitsToArabic(y));
    if (!monthIsThaiWord) {
      if (!(yNum < 100)) continue; // ปีเป็นเลขยาว 4 หลักแต่เดือนเป็นตัวเลข -> ข้าม
    }
    const dt = makeDateFromDMY(d, m, y);
    if (dt) return dt;
  }
  return null;
}

function pickHeaderInfo(rows) {
  // พยายามหา รายวิชา และ ครูผู้สอน จาก 15 แถวแรก (ยืดหยุ่นทั้งแบบอยู่บรรทัดเดียว/หลายเซลล์)
  let subject = "";
  let teacherName = "";
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const r = rows[i] || [];
    const tokens = r.map(safeString).filter(Boolean);
    const line = tokens.join(" ");

    // ดึงวิชา: ถ้าอยู่บรรทัดเดียวกับครูผู้สอน ให้ตัดก่อนคำว่า ครูผู้สอน
    if (!subject && /รายวิชา/.test(line)) {
      const m1 = line.match(/รายวิชา\s+(.+?)(?:\s+ครูผู้สอน|$)/);
      if (m1) subject = safeString(m1[1]);
    }
    // กรณีแยกคอลัมน์: [..., 'รายวิชา', 'การปืน', 'ครูผู้สอน', 'กอไก่', 'ขอไข่']
    if (!subject && tokens.includes("รายวิชา")) {
      const idx = tokens.indexOf("รายวิชา");
      if (idx !== -1 && tokens[idx + 1]) {
        subject = safeString(tokens[idx + 1]);
      }
    }

    // ดึงครูผู้สอน
    if (!teacherName && /ครูผู้สอน/.test(line)) {
      const m2 = line.match(/ครูผู้สอน\s+(.+)/);
      if (m2) teacherName = safeString(m2[1]);
    }
    if (!teacherName && tokens.includes("ครูผู้สอน")) {
      const idx2 = tokens.indexOf("ครูผู้สอน");
      if (idx2 !== -1 && tokens[idx2 + 1]) {
        teacherName = tokens.slice(idx2 + 1).join(" ").trim();
      }
    }
  }
  return { subject: subject || "ไม่ระบุ", teacherName: teacherName || "ไม่ระบุ" };
}

function extractDateFromTextAndClean(text) {
  const str = thaiDigitsToArabic(safeString(text));
  const m = str.match(/(\d{1,2})\s*[\/\-\s]?\s*([ก-ฮ\.]+|\d{1,2})\s*[\/\-\s]?\s*(\d{2,4})/);
  if (!m) return { cleaned: str, date: null };
  const dt = makeDateFromDMY(m[1], m[2], m[3]);
  const cleaned = (str.slice(0, m.index) + str.slice(m.index + m[0].length)).trim();
  return { cleaned, date: dt };
}

function pickEvaluatorInfo(rows) {
  // หาแถวที่มีคำว่า "สังกัด" และ/หรือวันที่ไทย
  let evaluatorName = "";
  let evaluatorUnit = "";
  let evaluatedAt = null;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    const line = r.map(safeString).join(" ");
    if (!evaluatorName && /สังกัด/.test(line)) {
      const parts = line.split(/สังกัด/);
      evaluatorName = safeString(parts[0]).trim();
      let unitRaw = safeString(parts[1]).trim();
      // ถ้าวันที่ติดอยู่ใน unit ให้ดึงออกและตั้ง evaluatedAt พร้อมทำความสะอาด unit
      const { cleaned, date } = extractDateFromTextAndClean(unitRaw);
      evaluatorUnit = cleaned;
      if (!evaluatedAt && date) evaluatedAt = date;
    }
    // เลือกวันที่ที่พบล่าสุด (โดยทั่วไปวันที่อยู่ท้าย ๆ เอกสาร)
    const d1 = tryParseThaiDateFromRow(r);
    const d2 = d1 || tryParseThaiDateFromString(line);
    if (d2) evaluatedAt = d2;
  }
  return {
    evaluatorName: evaluatorName || "ไม่ระบุ",
    evaluatorUnit: evaluatorUnit || null,
    evaluatedAt: evaluatedAt || new Date(),
  };
}

/* ===================== โค้ดใหม่ที่สำคัญ: เริ่ม ===================== */

// ดึงเลขออกจากเซลล์ (เช่น "คะแนน 5" -> "5") เพื่อช่วยตรวจหัวคอลัมน์
function normalizeCell(v) {
  const s = safeString(v).replace(/\s+/g, "");
  const m = s.match(/\d+/);
  return m ? m[0] : s;
}

// ค้นหา "กลุ่มคอลัมน์คะแนน" ที่ติดกัน 5 ช่อง และประกอบด้วย 1..5 หรือ 5..1
function findScaleColumns(rows) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    const norm = row.map(normalizeCell);

    for (let c = 0; c <= norm.length - 5; c++) {
      const slice = norm.slice(c, c + 5);
      const nums = slice.map((x) => Number(x));
      // ต้องเป็นเลขทั้งหมด และครบ 1..5
      if (!nums.every((n) => [1,2,3,4,5].includes(n))) continue;
      const set = new Set(nums);
      if (set.size !== 5) continue; // ห้ามซ้ำ

      const asc = nums.join(",") === "1,2,3,4,5";
      const desc = nums.join(",") === "5,4,3,2,1";
      if (asc || desc) {
        return { headerRowIdx: r, scaleCols: [c, c+1, c+2, c+3, c+4], orderDesc: desc };
      }
    }
  }
  return null;
}

// รองรับการ "ติ๊ก" ได้หลายรูปแบบ
function isMarked(v) {
  const s = safeString(v).toLowerCase();
  if (!s) return false;
  if (s === "1" || s === "true") return true;
  if (/[✓✔x■●☑☒]/.test(s)) return true;
  if (s.includes("ถูก")) return true;
  return false;
}

// เวอร์ชันใหม่: ยืดหยุ่นตำแหน่งหัวคอลัมน์ + รองรับติ๊ก/กรอกเลข
function extractAnswers(rows) {
  const found = findScaleColumns(rows);
  if (!found) return [];

  const { headerRowIdx, scaleCols, orderDesc } = found;
  const firstScoreCol = Math.min(...scaleCols);
  const ratingsByIndex = orderDesc ? [5,4,3,2,1] : [1,2,3,4,5];

  const answers = [];
  let itemSeq = 1;

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const textPart = safeString(
      row
        .slice(0, firstScoreCol)
        .map(safeString)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    );

    const scoreCells = scaleCols.map((c) => row[c]);

    const rowLooksEmpty = !textPart && scoreCells.every((v) => safeString(v) === "");
    if (rowLooksEmpty) continue;
    if (/รวม|สรุป|เฉลี่ย/i.test(textPart)) continue;

    // 1) ถ้ามี "ติ๊ก" ชัดเจนอยู่คอลัมน์เดียว ให้ใช้คอลัมน์นั้น
    let markIdx = -1;
    const flags = scoreCells.map(isMarked);
    if (flags.filter(Boolean).length === 1) {
      markIdx = flags.findIndex(Boolean);
    }

    // 2) ถ้าไม่พบ "ติ๊ก" ให้ลองดูว่ามี "ตัวเลขคะแนน (1..5)" ใต้หัวเพียงคอลัมน์เดียวไหม
    if (markIdx === -1) {
      const nums = scoreCells.map((v) => {
        const m = safeString(v).match(/\d+/);
        const n = m ? Number(m[0]) : NaN;
        return [1,2,3,4,5].includes(n) ? n : null;
      });
      const indicesWithNum = nums
        .map((n, i) => (n ? i : -1))
        .filter((i) => i !== -1);
      if (indicesWithNum.length === 1) {
        markIdx = indicesWithNum[0];
      }
    }

    // 3) ถ้ายังเดาไม่ได้ ให้ข้ามแถวนี้ (ไม่ใช่แถวคำถามหรือไม่มีคะแนน)
    if (markIdx === -1) continue;

    const rating = ratingsByIndex[markIdx];

    // itemText: ถ้า textPart ว่าง ลองหาคอลัมน์ก่อนหน้าที่เป็นข้อความจริง ๆ
    let itemText = textPart;
    if (!itemText) {
      const pick = (row.slice(0, firstScoreCol).find((t) => {
        const s = safeString(t);
        return s && !/^\d+(\.\d+)?$/.test(s);
      }) || "").toString().trim();
      itemText = pick || "ไม่ระบุหัวข้อ";
    }

    answers.push({
      section: null,
      itemCode: String(itemSeq++),
      itemText,
      rating,
    });
  }

  return answers;
}
/* ===================== โค้ดใหม่ที่สำคัญ: จบ ===================== */

// POST /api/evaluations/import (multipart/form-data: file=.xlsx)
const importEvaluationExcel = async (req, res) => {
  if (!req.file || !req.file.path) {
    return res.status(400).json({ message: "กรุณาอัปโหลดไฟล์ Excel ในฟิลด์ 'file'" });
  }

  const filePath = req.file.path;
  try {
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    // ใช้ raw:false เพื่อให้ได้ค่าข้อความตามรูปแบบที่เห็น (เช่น วันที่ภาษาไทย)
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });

    const { subject, teacherName } = pickHeaderInfo(rows);
    const { evaluatorName, evaluatorUnit, evaluatedAt } = pickEvaluatorInfo(rows);
    const answers = extractAnswers(rows);

    if (answers.length === 0) {
      return res.status(400).json({ message: "ไม่พบรายการคำถาม/คะแนนในไฟล์ที่อัปโหลด" });
    }

    // หาก client ส่ง teacherId มา จะพยายามแนบ
    let teacherId = undefined;
    if (req.body && req.body.teacherId) {
      // รองรับกรณีถูกส่งมาเป็นสตริงมีอัญประกาศ/เลขไทย เช่น "1"/'1'/"๑"
      let raw = thaiDigitsToArabic(String(req.body.teacherId)).trim();
      raw = raw.replace(/^\s*["']+|["']+\s*$/g, "");
      const idNum = Number(raw);
      if (!Number.isNaN(idNum)) {
        const t = await prisma.user.findUnique({ where: { id: idNum }, select: { id: true } });
        if (t) teacherId = idNum;
      }
    }

    const created = await prisma.evaluationSheet.create({
      data: {
        subject,
        teacherName,
        teacherId,
        evaluatorName,
        evaluatorUnit,
        evaluatedAt,
        answers: {
          create: answers.map((a) => ({
            section: a.section,
            itemCode: a.itemCode,
            itemText: a.itemText,
            rating: a.rating,
          })),
        },
      },
      include: { answers: true },
    });

    res.status(201).json({
      message: "นำเข้าข้อมูลแบบประเมินสำเร็จ",
      sheet: created,
    });
  } catch (err) {
    res.status(500).json({ message: "นำเข้าข้อมูลล้มเหลว", detail: err.message });
  } finally {
    try {
      fs.existsSync(filePath) && fs.unlinkSync(filePath);
    } catch {}
  }
};

const listEvaluationSheets = async (req, res) => {
  try {
    const page = Math.max(parseNumericInput(req.query?.page) || 1, 1);
    let pageSize = parseNumericInput(req.query?.pageSize) || 10;
    pageSize = Math.min(Math.max(pageSize, 1), 100);

    const filters = [];
    const teacherId = parseNumericInput(req.query?.teacherId);
    if (teacherId != null) filters.push({ teacherId });

    const subject = safeString(req.query?.subject);
    if (subject) {
      filters.push({
        subject: { contains: subject, mode: "insensitive" },
      });
    }

    const teacherName = safeString(req.query?.teacherName);
    if (teacherName) {
      filters.push({
        teacherName: { contains: teacherName, mode: "insensitive" },
      });
    }

    const evaluatorName = safeString(req.query?.evaluatorName);
    if (evaluatorName) {
      filters.push({
        evaluatorName: { contains: evaluatorName, mode: "insensitive" },
      });
    }

    const search = safeString(req.query?.search);
    if (search) {
      filters.push({
        OR: [
          { subject: { contains: search, mode: "insensitive" } },
          { teacherName: { contains: search, mode: "insensitive" } },
          { evaluatorName: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    const where = filters.length ? { AND: filters } : undefined;
    const skip = (page - 1) * pageSize;

    const [total, sheets] = await Promise.all([
      prisma.evaluationSheet.count({ where }),
      prisma.evaluationSheet.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { evaluatedAt: "desc" },
        include: evaluationSheetInclude,
      }),
    ]);

    res.json({
      data: sheets,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    res.status(500).json({
      message: "ไม่สามารถดึงข้อมูลแบบประเมินได้",
      detail: err.message,
    });
  }
};

const getEvaluationSheetById = async (req, res) => {
  const sheetId = parseNumericInput(req.params?.id);
  if (sheetId == null) {
    return res.status(400).json({ message: "id ต้องเป็นตัวเลข" });
  }
  try {
    const sheet = await prisma.evaluationSheet.findUnique({
      where: { id: sheetId },
      include: evaluationSheetInclude,
    });
    if (!sheet) {
      return res.status(404).json({ message: "ไม่พบแบบประเมิน" });
    }
    res.json({ data: sheet });
  } catch (err) {
    res.status(500).json({
      message: "ไม่สามารถดึงข้อมูลแบบประเมินได้",
      detail: err.message,
    });
  }
};

const updateEvaluationSheet = async (req, res) => {
  const sheetId = parseNumericInput(req.params?.id);
  if (sheetId == null) {
    return res.status(400).json({ message: "id ต้องเป็นตัวเลข" });
  }
  try {
    const existing = await prisma.evaluationSheet.findUnique({
      where: { id: sheetId },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ message: "ไม่พบแบบประเมิน" });
    }

    const payload = {};
    if (req.body?.subject !== undefined) {
      const subject = safeString(req.body.subject);
      if (!subject) {
        throw validationError("subject ต้องไม่ว่าง");
      }
      payload.subject = subject;
    }
    if (req.body?.teacherName !== undefined) {
      const teacherName = safeString(req.body.teacherName);
      if (!teacherName) {
        throw validationError("teacherName ต้องไม่ว่าง");
      }
      payload.teacherName = teacherName;
    }
    if (req.body?.teacherId !== undefined) {
      if (req.body.teacherId === null || req.body.teacherId === "") {
        payload.teacherId = null;
      } else {
        const teacherId = parseNumericInput(req.body.teacherId);
        if (teacherId == null) {
          throw validationError("teacherId ต้องเป็นตัวเลข");
        }
        payload.teacherId = teacherId;
      }
    }
    if (req.body?.evaluatorName !== undefined) {
      const evaluatorName = safeString(req.body.evaluatorName);
      if (!evaluatorName) {
        throw validationError("evaluatorName ต้องไม่ว่าง");
      }
      payload.evaluatorName = evaluatorName;
    }
    if (req.body?.evaluatorUnit !== undefined) {
      const evaluatorUnit = safeString(req.body.evaluatorUnit);
      payload.evaluatorUnit = evaluatorUnit || null;
    }
    if (req.body?.evaluatedAt !== undefined) {
      const evaluatedAt =
        req.body.evaluatedAt instanceof Date
          ? req.body.evaluatedAt
          : new Date(req.body.evaluatedAt);
      if (isNaN(evaluatedAt.getTime())) {
        throw validationError("evaluatedAt ต้องอยู่ในรูปแบบวันที่ที่ถูกต้อง");
      }
      payload.evaluatedAt = evaluatedAt;
    }
    if (req.body?.notes !== undefined) {
      const notes =
        typeof req.body.notes === "string"
          ? req.body.notes.trim()
          : String(req.body.notes || "").trim();
      payload.notes = notes || null;
    }

    let normalizedAnswers = null;
    if (req.body?.answers !== undefined) {
      normalizedAnswers = normalizeManualAnswers(req.body.answers);
    }

    const updatedSheet = await prisma.$transaction(async (tx) => {
      if (Object.keys(payload).length > 0) {
        await tx.evaluationSheet.update({
          where: { id: sheetId },
          data: payload,
        });
      }
      if (normalizedAnswers) {
        await tx.evaluationAnswer.deleteMany({ where: { sheetId } });
        await tx.evaluationAnswer.createMany({
          data: normalizedAnswers.map((answer) => ({
            sheetId,
            ...answer,
          })),
        });
      }
      return tx.evaluationSheet.findUnique({
        where: { id: sheetId },
        include: evaluationSheetInclude,
      });
    });

    res.json({ data: updatedSheet });
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({
      message: "ไม่สามารถแก้ไขแบบประเมินได้",
      detail: err.message,
    });
  }
};

const deleteEvaluationSheet = async (req, res) => {
  const sheetId = parseNumericInput(req.params?.id);
  if (sheetId == null) {
    return res.status(400).json({ message: "id ต้องเป็นตัวเลข" });
  }
  try {
    await prisma.evaluationSheet.delete({
      where: { id: sheetId },
    });
    res.json({ message: "ลบแบบประเมินสำเร็จ" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ message: "ไม่พบแบบประเมิน" });
    }
    res.status(500).json({
      message: "ไม่สามารถลบแบบประเมินได้",
      detail: err.message,
    });
  }
};

const downloadEvaluationTemplate = async (_req, res) => {
  const templatePath = path.join(
    __dirname,
    "..",
    "uploads",
    "evaluations",
    "template.xlsx"
  );
  try {
    await fs.promises.access(templatePath, fs.constants.R_OK);
    res.download(templatePath, "evaluation-template.xlsx", (err) => {
      if (err && !res.headersSent) {
        res
          .status(500)
          .json({ message: "ไม่สามารถดาวน์โหลดไฟล์เทมเพลตได้" });
      }
    });
  } catch (err) {
    res.status(404).json({
      message: "ไม่พบไฟล์เทมเพลต",
      detail: err.message,
    });
  }
};

module.exports = {
  importEvaluationExcel,
  listEvaluationSheets,
  getEvaluationSheetById,
  updateEvaluationSheet,
  deleteEvaluationSheet,
  downloadEvaluationTemplate,
};
