const fs = require("fs");
const XLSX = require("xlsx");
const ExamModel = require("../models/examModel");

const handleError = (err, res, actionMessage = "ดำเนินการไม่สำเร็จ") => {
  if (err.code === "VALIDATION_ERROR") {
    return res.status(400).json({ message: err.message });
  }
  console.error(actionMessage, err);
  return res.status(500).json({ message: actionMessage, detail: err.message });
};

const formatDateTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const autoFitColumns = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const widths = headers.map((h) => Math.max(h.length, 8));
  rows.forEach((row) => {
    headers.forEach((h, idx) => {
      const len = row[h] != null ? String(row[h]).length : 0;
      if (len > widths[idx]) widths[idx] = len;
    });
  });
  return widths.map((w) => ({ wch: w + 2 }));
};

const importExamExcel = async (req, res) => {
  if (!req.file || !req.file.path) {
    return res
      .status(400)
      .json({ message: "กรุณาอัปโหลดไฟล์ Excel ในฟิลด์ 'file'" });
  }
  const filePath = req.file.path;
  const overrideSubject =
    (req.body && typeof req.body.subject === "string"
      ? req.body.subject.trim()
      : "") ||
    (req.query && typeof req.query.subject === "string"
      ? req.query.subject.trim()
      : "");
  try {
    const result = await ExamModel.importExamExcel(
      filePath,
      req.userId,
      overrideSubject || null
    );
    return res.status(201).json({
      message: "นำเข้าข้อมูลสอบสำเร็จ",
      summary: {
        totalRows: result.totalRows,
        inserted: result.inserted,
        duplicates: result.duplicates,
      },
      preview: result.preview,
    });
  } catch (err) {
    return handleError(err, res, "ไม่สามารถนำเข้าข้อมูลสอบได้");
  } finally {
    try {
      fs.existsSync(filePath) && fs.unlinkSync(filePath);
    } catch (cleanupErr) {
      console.warn("ลบไฟล์ Excel ไม่สำเร็จ:", cleanupErr.message);
    }
  }
};

const listExamResults = async (req, res) => {
  try {
    const { page, pageSize, search, unit, navyNumber, sort, subject } = req.query || {};
    const data = await ExamModel.listExamResults({
      page,
      pageSize,
      search,
      unit,
      navyNumber,
      subject,
      sort,
    });
    return res.json(data);
  } catch (err) {
    return handleError(err, res, "ไม่สามารถดึงข้อมูลสอบได้");
  }
};

const summarizeExamResults = async (req, res) => {
  try {
    const { battalionCodes, companyCodes, subject } = req.query || {};
    const battalionCodesList = typeof battalionCodes === "string" ? battalionCodes.split(",") : [];
    const companyCodesList = typeof companyCodes === "string" ? companyCodes.split(",") : [];
    const data = await ExamModel.summarizeExamResults({
      battalionCodesList,
      companyCodesList,
      subject,
    });
    return res.json(data);
  } catch (err) {
    return handleError(err, res, "ไม่สามารถสรุปผลสอบได้");
  }
};

const deleteExamResult = async (req, res) => {
  try {
    await ExamModel.deleteExamResult(req.params.id);
    return res.json({ message: "ลบข้อมูลสอบสำเร็จ" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ message: "ไม่พบข้อมูลสอบ" });
    }
    return handleError(err, res, "ไม่สามารถลบข้อมูลสอบได้");
  }
};

const deleteAllExamResults = async (_req, res) => {
  try {
    const result = await ExamModel.deleteAllExamResults();
    return res.json({ message: "ลบข้อมูลสอบทั้งหมดสำเร็จ", deleted: result.deleted });
  } catch (err) {
    return handleError(err, res, "ไม่สามารถลบข้อมูลสอบทั้งหมดได้");
  }
};

const getExamOverview = async (req, res) => {
  try {
    // req subject
    const { subject } = req.query || {};
    const overview = await ExamModel.getExamOverview(subject);
    return res.json({ overview });
  } catch (err) {
    return handleError(err, res, "ไม่สามารถดึงสรุปผลสอบได้");
  }
};

const mapSubject = (code) => {
  const mapping = {
    theory: "ทฤษฎี (การเรือ, การอาวุธ, ปคส.)",
    rules: "กฎระเบียบและข้อบังคับ (วินัย)",
    morality: "คุณธรรมจริยธรรม และทัศนคติ",
  };
  return mapping[code] || code;
}

const exportExamResults = async (req, res) => {
  try {
    const { subject } = req.query || {};
    const groups = await ExamModel.getExamResultsForExport({ subject });
    if (!groups.length) {
      return res.status(404).json({ message: "ไม่มีข้อมูลผลสอบสำหรับส่งออก" });
    }

    const wb = XLSX.utils.book_new();
    groups.forEach((group) => {
      const rows = group.items.map((item) => ({
        "ประทับเวลา": formatDateTime(item.timestamp),
        "วิชา": mapSubject(item.subject),
        "คะแนน": item.scoreText || "",
        "คะแนนที่ได้": item.scoreValue ?? "",
        "คะแนนรวม": item.scoreTotal ?? "",
        "ยศ-ชื่อ-นามสกุล": item.fullName || "",
        "เลขประจำตัว": item.navyNumber || "",
        "สังกัด": item.unit || "",
      }));
      const sheetName = `ร้อย.${group.companyCode} พัน.${group.battalionCode}`.slice(0, 31);
      const ws =
        rows.length > 0
          ? XLSX.utils.json_to_sheet(rows)
          : XLSX.utils.aoa_to_sheet([["ไม่มีข้อมูล"]]);
      if (rows.length > 0) {
        ws["!cols"] = autoFitColumns(rows);
      }
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="' +
      `exam_results${subject ? `_${subject}` : ""}_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx"`);
    return res.send(buffer);
  } catch (err) {
    return handleError(err, res, "ไม่สามารถส่งออกผลสอบเป็นไฟล์ Excel ได้");
  }
}
module.exports = {
  importExamExcel,
  listExamResults,
  summarizeExamResults,
  deleteExamResult,
  deleteAllExamResults,
  getExamOverview,
  exportExamResults,
};
