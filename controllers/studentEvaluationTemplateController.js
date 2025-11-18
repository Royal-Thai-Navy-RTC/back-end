const StudentEvaluationModel = require("../models/studentEvaluationModel");

const handleError = (err, res, actionMessage = "ดำเนินการไม่สำเร็จ") => {
  if (err.code === "VALIDATION_ERROR") {
    return res.status(400).json({ message: err.message });
  }
  if (err.code === "NOT_FOUND") {
    return res.status(404).json({ message: err.message });
  }
  console.error(actionMessage, err);
  return res.status(500).json({ message: actionMessage, detail: err.message });
};

const createTemplate = async (req, res) => {
  try {
    const template = await StudentEvaluationModel.createTemplate({
      ...req.body,
      createdBy: req.userId,
    });
    res.status(201).json({ template });
  } catch (err) {
    handleError(err, res, "ไม่สามารถสร้างแบบประเมินได้");
  }
};

const listTemplates = async (req, res) => {
  try {
    const { includeInactive, search } = req.query || {};
    const templates = await StudentEvaluationModel.listTemplates({
      includeInactive: includeInactive === "true",
      search,
    });
    res.json({ data: templates });
  } catch (err) {
    handleError(err, res, "ไม่สามารถดึงข้อมูลแบบประเมินได้");
  }
};

const getTemplateById = async (req, res) => {
  try {
    const template = await StudentEvaluationModel.getTemplateById(
      req.params.id
    );
    if (!template) {
      return res.status(404).json({ message: "ไม่พบแบบประเมิน" });
    }
    res.json({ template });
  } catch (err) {
    handleError(err, res, "ไม่สามารถดึงข้อมูลแบบประเมินได้");
  }
};

const updateTemplate = async (req, res) => {
  try {
    const template = await StudentEvaluationModel.updateTemplate(
      req.params.id,
      req.body
    );
    res.json({ template });
  } catch (err) {
    handleError(err, res, "ไม่สามารถแก้ไขแบบประเมินได้");
  }
};

const deleteTemplate = async (req, res) => {
  try {
    await StudentEvaluationModel.deleteTemplate(req.params.id);
    res.json({ message: "ลบแบบประเมินสำเร็จ" });
  } catch (err) {
    handleError(err, res, "ไม่สามารถลบแบบประเมินได้");
  }
};

module.exports = {
  createTemplate,
  listTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
};
