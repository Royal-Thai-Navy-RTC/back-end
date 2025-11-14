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

module.exports = {
  getTrainingReportDashboard,
};
