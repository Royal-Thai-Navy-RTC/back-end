const TrainingReport = require("../models/trainingReportModel");

const submitTrainingReport = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      teacherId: req.userId,
    };
    const report = await TrainingReport.createTrainingReport(payload);
    res.status(201).json({
      message: "บันทึกยอดนักเรียนสำเร็จ",
      report,
    });
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({
      message: "Error submitting training report",
      detail: err.message,
    });
  }
};

const getRecentTrainingReports = async (req, res) => {
  try {
    const { limit } = req.query || {};
    const reports = await TrainingReport.getRecentReportsForTeacher({
      teacherId: req.userId,
      limit,
    });
    res.json({
      data: reports,
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching training reports" });
  }
};

module.exports = {
  submitTrainingReport,
  getRecentTrainingReports,
};
