const StudentEvaluationModel = require("../models/studentEvaluationModel");

const handleError = (err, res, actionMessage = "ไม่สามารถดำเนินการได้") => {
  if (err.code === "VALIDATION_ERROR") {
    return res.status(400).json({ message: err.message });
  }
  if (err.code === "NOT_FOUND") {
    return res.status(404).json({ message: err.message });
  }
  console.error(actionMessage, err);
  return res.status(500).json({ message: actionMessage, detail: err.message });
};

const createEvaluation = async (req, res) => {
  try {
    const evaluation = await StudentEvaluationModel.createEvaluation({
      ...req.body,
      evaluatorId: req.userId,
    });
    res.status(201).json({ evaluation });
  } catch (err) {
    handleError(err, res, "ไม่สามารถบันทึกผลการประเมินได้");
  }
};

const listEvaluations = async (req, res) => {
  try {
    const { templateId, companyCode, battalionCode, evaluatorId } =
      req.query || {};
    const evaluations = await StudentEvaluationModel.listEvaluations({
      templateId,
      companyCode,
      battalionCode,
      evaluatorId,
    });
    res.json({ data: evaluations });
  } catch (err) {
    handleError(err, res, "ไม่สามารถดึงผลการประเมินได้");
  }
};

const getEvaluationById = async (req, res) => {
  try {
    const evaluation = await StudentEvaluationModel.getEvaluationById(
      req.params.id
    );
    if (!evaluation) {
      return res.status(404).json({ message: "ไม่พบข้อมูลการประเมิน" });
    }
    res.json({ evaluation });
  } catch (err) {
    handleError(err, res, "ไม่สามารถดึงข้อมูลการประเมินได้");
  }
};

const updateEvaluation = async (req, res) => {
  try {
    const evaluation = await StudentEvaluationModel.updateEvaluation(
      req.params.id,
      req.body
    );
    res.json({ evaluation });
  } catch (err) {
    handleError(err, res, "ไม่สามารถแก้ไขผลการประเมินได้");
  }
};

const deleteEvaluation = async (req, res) => {
  try {
    await StudentEvaluationModel.deleteEvaluation(req.params.id);
    res.json({ message: "ลบผลการประเมินสำเร็จ" });
  } catch (err) {
    handleError(err, res, "ไม่สามารถลบผลการประเมินได้");
  }
};

module.exports = {
  createEvaluation,
  listEvaluations,
  getEvaluationById,
  updateEvaluation,
  deleteEvaluation,
};
