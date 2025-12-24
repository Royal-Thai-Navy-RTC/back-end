const TrainingReport = require("../../models/trainingReportModel");

const getTrainingReportDashboard = async (req, res) => {
  try {
    const { search } = req.query || {};
    const data = await TrainingReport.getAdminTrainingReportSummary({
      search,
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({
      message: "ไม่สามารถโหลดข้อมูลการรายงานได้",
      detail: err.message,
    });
  }
};

const getCompanyTrainingReportSummary = async (req, res) => {
  try {
    const { startDate, endDate, date } = req.query || {};
    // `date` is a convenience param for filtering a single day; it overrides start/end when provided
    const data = await TrainingReport.getCompanyParticipantSummary({
      date,
      startDate,
      endDate,
    });
    res.json(data);
  } catch (err) {
    const status = err.code === "VALIDATION_ERROR" ? 400 : 500;
    res.status(status).json({
      message: "ไม่สามารถโหลดสรุปการส่งยอดกองร้อยได้",
      detail: err.message,
    });
  }
};

module.exports = {
  getTrainingReportDashboard,
  getCompanyTrainingReportSummary,
};
