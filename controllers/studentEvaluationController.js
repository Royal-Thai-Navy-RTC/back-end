const StudentEvaluationModel = require("../models/studentEvaluationModel");

const formatOverallScore = (value) => {
  if (typeof value !== "number") return value;
  return Number(value.toFixed(2));
};

const formatEvaluation = (evaluation) => {
  if (!evaluation) return evaluation;
  const formatted = { ...evaluation };
  if (formatted.overallScore !== undefined) {
    formatted.overallScore = formatOverallScore(formatted.overallScore);
  }
  // Front-end fallback: SERVICE evaluations may not have evaluatedPersonId/user.
  // Provide a stable display string so UI can render without relying on evaluatedPersonId.
  if (formatted.evaluatedPersonName === undefined) {
    const fromUser =
      formatted.evaluatedPersonUser &&
      (formatted.evaluatedPersonUser.firstName || formatted.evaluatedPersonUser.lastName)
        ? [formatted.evaluatedPersonUser.firstName, formatted.evaluatedPersonUser.lastName]
            .filter(Boolean)
            .join(" ")
        : "";
    formatted.evaluatedPersonName = fromUser || formatted.evaluatedPerson || null;
  }
  return formatted;
};

const formatEvaluationList = (items) =>
  Array.isArray(items) ? items.map(formatEvaluation) : items;

const parseCodeList = (value) => {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
    ? value.split(",")
    : [];
  return list
    .map((item) =>
      typeof item === "string" ? item.trim().toUpperCase() : null
    )
    .filter(Boolean);
};

const formatAverageEntry = (entry = {}) => ({
  ...entry,
  averageOverallScore: formatOverallScore(entry.averageOverallScore),
  totalScore:
    typeof entry.totalScore === "number"
      ? Number(entry.totalScore.toFixed(2))
      : entry.totalScore,
});

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
      evaluatorRole: req.userRole,
    });
    res.status(201).json({ evaluation: formatEvaluation(evaluation) });
  } catch (err) {
    handleError(err, res, "ไม่สามารถบันทึกผลการประเมินได้");
  }
};

const listEvaluations = async (req, res) => {
  try {
    const {
      templateId,
      companyCode,
      battalionCode,
      evaluatorId,
      evaluatedPersonId,
      evaluatedPerson,
      evaluationRound,
      page,
      pageSize,
      includeAnswers,
      templateType,
    } = req.query || {};

    const filters = {
      templateId,
      companyCode,
      battalionCode,
      evaluatorId,
      evaluatedPersonId,
      evaluatedPerson,
      evaluationRound,
      page,
      pageSize,
      includeAnswers: String(includeAnswers).toLowerCase() === "true",
      templateType,
    };

    const [listResult, summary, summaryByCompany] = await Promise.all([
      StudentEvaluationModel.listEvaluations(filters),
      StudentEvaluationModel.summarizeEvaluations(filters),
      StudentEvaluationModel.summarizeByCompany(filters),
    ]);

    res.json({
      data: formatEvaluationList(listResult.items),
      page: listResult.page,
      pageSize: listResult.pageSize,
      total: listResult.total,
      totalPages: listResult.totalPages,
      summary,
      summaryByCompany,
    });
  } catch (err) {
    handleError(err, res, "ไม่สามารถดึงผลการประเมินได้");
  }
};

const getEvaluationComparison = async (req, res) => {
  try {
    const {
      templateId,
      companyCode,
      battalionCode,
      evaluatorId,
      templateType,
      battalionCodes,
      companyCodes,
    } = req.query || {};

    const filters = {
      templateId,
      companyCode,
      battalionCode,
      evaluatorId,
      templateType,
      battalionCodesList: parseCodeList(battalionCodes),
      companyCodesList: parseCodeList(companyCodes),
    };

    const comparison = await StudentEvaluationModel.compareAverages(filters);
    res.json({
      comparison: {
        battalions: Array.isArray(comparison?.battalions)
          ? comparison.battalions.map((b) => ({
              ...formatAverageEntry(b),
              companies: Array.isArray(b.companies)
                ? b.companies.map(formatAverageEntry)
                : [],
            }))
          : [],
        companies: Array.isArray(comparison?.companies)
          ? comparison.companies.map(formatAverageEntry)
          : [],
      },
    });
  } catch (err) {
    handleError(err, res, "ไม่สามารถดึงข้อมูลเปรียบเทียบคะแนนเฉลี่ยได้");
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
    res.json({ evaluation: formatEvaluation(evaluation) });
  } catch (err) {
    handleError(err, res, "ไม่สามารถดึงข้อมูลการประเมินได้");
  }
};

const updateEvaluation = async (req, res) => {
  try {
    const evaluation = await StudentEvaluationModel.updateEvaluation(
      req.params.id,
      { ...req.body, evaluatorRole: req.userRole }
    );
    res.json({ evaluation: formatEvaluation(evaluation) });
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
  getEvaluationComparison,
  getEvaluationById,
  updateEvaluation,
  deleteEvaluation,
};
