const fs = require("fs");
const ExamModel = require("../models/examModel");

const handleError = (err, res, actionMessage = "ดำเนินการไม่สำเร็จ") => {
  if (err.code === "VALIDATION_ERROR") {
    return res.status(400).json({ message: err.message });
  }
  console.error(actionMessage, err);
  return res.status(500).json({ message: actionMessage, detail: err.message });
};

const importExamExcel = async (req, res) => {
  if (!req.file || !req.file.path) {
    return res
      .status(400)
      .json({ message: "กรุณาอัปโหลดไฟล์ Excel ในฟิลด์ 'file'" });
  }
  const filePath = req.file.path;
  try {
    const result = await ExamModel.importExamExcel(filePath, req.userId);
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
    const { page, pageSize, search, unit, navyNumber, sort } = req.query || {};
    const data = await ExamModel.listExamResults({
      page,
      pageSize,
      search,
      unit,
      navyNumber,
      sort,
    });
    return res.json(data);
  } catch (err) {
    return handleError(err, res, "ไม่สามารถดึงข้อมูลสอบได้");
  }
};

const summarizeExamResults = async (req, res) => {
  try {
    const { battalionCodes, companyCodes } = req.query || {};
    const battalionCodesList = typeof battalionCodes === "string" ? battalionCodes.split(",") : [];
    const companyCodesList = typeof companyCodes === "string" ? companyCodes.split(",") : [];
    const data = await ExamModel.summarizeExamResults({
      battalionCodesList,
      companyCodesList,
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

const getExamOverview = async (_req, res) => {
  try {
    const overview = await ExamModel.getExamOverview();
    return res.json({ overview });
  } catch (err) {
    return handleError(err, res, "ไม่สามารถดึงสรุปผลสอบได้");
  }
};

module.exports = {
  importExamExcel,
  listExamResults,
  summarizeExamResults,
  deleteExamResult,
  deleteAllExamResults,
  getExamOverview,
};
