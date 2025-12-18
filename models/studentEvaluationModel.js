const prisma = require("../utils/prisma");

const templateInclude = {
  sections: {
    orderBy: { sectionOrder: "asc" },
    include: {
      questions: {
        orderBy: { questionOrder: "asc" },
      },
    },
  },
};

const evaluationIncludeBase = {
  template: { select: { id: true, name: true, description: true } },
  evaluator: {
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  },
  evaluatedPersonUser: {
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  },
};

const evaluationIncludeWithAnswers = {
  ...evaluationIncludeBase,
  answers: {
    orderBy: { id: "asc" },
    include: {
      question: {
        select: {
          id: true,
          prompt: true,
          maxScore: true,
          section: { select: { id: true, title: true, sectionOrder: true } },
        },
      },
    },
  },
};

const normalizeUnitCode = (value) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

// ใช้รวม logic สร้าง where สำหรับ list/summary
const buildEvaluationWhere = (filters = {}) => {
  const where = {};
  const templateTypeFilter = filters.templateType
    ? normalizeTemplateType(filters.templateType)
    : null;
  if (filters.templateId) {
    where.templateId = Number(filters.templateId);
  }
  if (templateTypeFilter) {
    where.template = { templateType: templateTypeFilter };
  }

  const companyCode = normalizeUnitCode(filters.companyCode);
  const battalionCode = normalizeUnitCode(filters.battalionCode);

  // SERVICE = ราชการ/รายบุคคล (ไม่มีสังกัด) -> ไม่ควรเอา companyCode/battalionCode มากรอง
  // เพื่อกันเคสที่ฝั่ง UI ส่ง filter หน่วยติดมาด้วยแล้วทำให้ผลไม่ขึ้น
  if (templateTypeFilter !== "SERVICE") {
    if (companyCode) where.companyCode = companyCode;
    if (battalionCode) where.battalionCode = battalionCode;
  }
  if (filters.evaluatorId) {
    where.evaluatorId = Number(filters.evaluatorId);
  }
  if (filters.evaluatedPersonId !== undefined) {
    const evaluatedPersonId =
      filters.evaluatedPersonId !== null ? Number(filters.evaluatedPersonId) : null;
    if (Number.isInteger(evaluatedPersonId) && evaluatedPersonId > 0) {
      where.evaluatedPersonId = evaluatedPersonId;
    }
  }
  if (filters.evaluatedPerson) {
    const evaluatedPerson =
      typeof filters.evaluatedPerson === "string"
        ? filters.evaluatedPerson.trim()
        : "";
    if (evaluatedPerson) {
      where.evaluatedPerson = { contains: evaluatedPerson };
    }
  }
  if (filters.evaluationRound) {
    const evaluationRound =
      typeof filters.evaluationRound === "string"
        ? filters.evaluationRound.trim()
        : "";
    if (evaluationRound) {
      where.evaluationRound = evaluationRound;
    }
  }
  return where;
};

const throwValidationError = (message) => {
  const err = new Error(message);
  err.code = "VALIDATION_ERROR";
  throw err;
};

const normalizeSectionPayload = (sections) => {
  if (!Array.isArray(sections) || sections.length === 0) {
    throwValidationError("ต้องระบุอย่างน้อย 1 หมวดการประเมิน");
  }
  return sections.map((section, sectionIndex) => {
    const title = typeof section?.title === "string" ? section.title.trim() : "";
    if (!title) {
      throwValidationError("หัวข้อหมวดต้องไม่ว่าง");
    }
    const questions = Array.isArray(section?.questions)
      ? section.questions
      : [];
    if (!questions.length) {
      throwValidationError(`หมวด '${title}' ต้องมีคำถามอย่างน้อย 1 ข้อ`);
    }
    const sectionOrder =
      Number(section?.sectionOrder) >= 0
        ? Number(section.sectionOrder)
        : sectionIndex + 1;

    const normalizedQuestions = questions.map((question, questionIndex) => {
      const prompt =
        typeof question?.prompt === "string" ? question.prompt.trim() : "";
      if (!prompt) {
        throwValidationError("ข้อความคำถามต้องไม่ว่าง");
      }
      const maxScore =
        Number(question?.maxScore) > 0
          ? Math.round(Number(question.maxScore))
          : 5;
      const questionOrder =
        Number(question?.questionOrder) >= 0
          ? Number(question.questionOrder)
          : questionIndex + 1;
      return {
        prompt,
        maxScore,
        questionOrder,
      };
    });

    return {
      title,
      description:
        typeof section?.description === "string"
          ? section.description.trim() || null
          : null,
      sectionOrder,
      questions: normalizedQuestions,
    };
  });
};

const normalizeTemplateType = (type) => {
  const raw = typeof type === "string" ? type.trim().toUpperCase() : "";
  const allowed = new Set(["BATTALION", "COMPANY", "SERVICE"]);
  if (!raw) {
    throwValidationError(
      "ต้องระบุ templateType (BATTALION=กองพัน, COMPANY=กองร้อย, SERVICE=ราชการ/รายบุคคล)"
    );
  }
  if (!allowed.has(raw)) {
    throwValidationError(
      "templateType ต้องเป็น BATTALION (กองพัน), COMPANY (กองร้อย) หรือ SERVICE (ราชการ/รายบุคคล)"
    );
  }
  return raw;
};

const parsePositiveInt = (value, fieldName) => {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throwValidationError(`${fieldName} ต้องเป็นจำนวนเต็มมากกว่า 0`);
  }
  return num;
};

const normalizeCountsForCreate = (templateType, input = {}) => {
  if (templateType === "BATTALION") {
    return {
      battalionCount: parsePositiveInt(
        input.battalionCount,
        "จำนวนกองพันที่ต้องการประเมิน"
      ),
      teacherEvaluatorCount: parsePositiveInt(
        input.teacherEvaluatorCount,
        "จำนวนครูผู้ประเมิน"
      ),
    };
  }
  return { battalionCount: null, teacherEvaluatorCount: null };
};

const normalizeCountsForUpdate = (
  templateType,
  input = {},
  current = {}
) => {
  if (templateType === "BATTALION") {
    const battalionCount =
      input.battalionCount !== undefined
        ? parsePositiveInt(input.battalionCount, "จำนวนกองพันที่ต้องการประเมิน")
        : current.battalionCount;
    const teacherEvaluatorCount =
      input.teacherEvaluatorCount !== undefined
        ? parsePositiveInt(input.teacherEvaluatorCount, "จำนวนครูผู้ประเมิน")
        : current.teacherEvaluatorCount;

    if (battalionCount == null || teacherEvaluatorCount == null) {
      throwValidationError(
        "ต้องระบุจำนวนกองพันที่ต้องการประเมิน และจำนวนครูผู้ประเมิน สำหรับ templateType = BATTALION"
      );
    }

    return { battalionCount, teacherEvaluatorCount };
  }
  return { battalionCount: null, teacherEvaluatorCount: null };
};

const normalizeTemplateInput = (input = {}) => {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) {
    throwValidationError("ต้องระบุชื่อแบบประเมิน");
  }
  const description =
    typeof input.description === "string"
      ? input.description.trim() || null
      : null;
  const templateType = normalizeTemplateType(input.templateType);
  const counts = normalizeCountsForCreate(templateType, input);
  const sections = normalizeSectionPayload(input.sections);
  return { name, description, sections, templateType, ...counts };
};

const templatePayload = (sections) =>
  sections.map((section) => ({
    title: section.title,
    description: section.description,
    sectionOrder: section.sectionOrder,
    questions: {
      create: section.questions.map((question) => ({
        prompt: question.prompt,
        maxScore: question.maxScore,
        questionOrder: question.questionOrder,
      })),
    },
  }));

const getTemplateWithQuestions = async (templateId) => {
  const template = await prisma.studentEvaluationTemplate.findUnique({
    where: { id: Number(templateId) },
    include: templateInclude,
  });
  if (!template) {
    const err = new Error("ไม่พบแบบประเมิน");
    err.code = "NOT_FOUND";
    throw err;
  }
  return template;
};

const normalizeEvaluationAnswers = (answers, questionMap) => {
  if (!Array.isArray(answers) || answers.length === 0) {
    throwValidationError("ต้องมีคำตอบอย่างน้อย 1 ข้อ");
  }
  const seen = new Set();
  return answers.map((answer) => {
    const questionId = Number(answer?.questionId);
    if (!Number.isInteger(questionId)) {
      throwValidationError("questionId ต้องเป็นตัวเลข");
    }
    if (seen.has(questionId)) {
      throwValidationError("ห้ามส่งคำตอบซ้ำหัวข้อ");
    }
    seen.add(questionId);
    const questionInfo = questionMap.get(questionId);
    if (!questionInfo) {
      throwValidationError("questionId ไม่อยู่ในแบบประเมินนี้");
    }
    const score = Number(answer?.score);
    if (!Number.isFinite(score)) {
      throwValidationError("คะแนนต้องเป็นตัวเลข");
    }
    if (score < 0 || score > questionInfo.maxScore) {
      throwValidationError(
        `คะแนนต้องอยู่ระหว่าง 0-${questionInfo.maxScore} สำหรับ '${questionInfo.prompt}'`
      );
    }
    return {
      questionId,
      score: Math.round(score),
      comment:
        typeof answer?.comment === "string"
          ? answer.comment.trim() || null
          : null,
    };
  });
};

const resolveEvaluatedPersonId = async (rawName) => {
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name) return null;
  // ลองจับคู่ username ก่อน
  const byUsername = await prisma.user.findFirst({
    where: { username: name },
    select: { id: true },
  });
  if (byUsername) return byUsername.id;

  // ถ้าระบุชื่อ-นามสกุล แยกเพื่อจับคู่แบบ exact
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const lastName = parts.pop();
    const firstName = parts.join(" ");
    const byFullName = await prisma.user.findFirst({
      where: { firstName: firstName, lastName: lastName },
      select: { id: true },
    });
    if (byFullName) return byFullName.id;
  }
  return null;
};

module.exports = {
  listTemplates: async ({ includeInactive = false, search, templateType } = {}) => {
    const where = {};
    if (!includeInactive) {
      where.isActive = true;
    }
    if (templateType !== undefined) {
      where.templateType = normalizeTemplateType(templateType);
    }
    const keyword = typeof search === "string" ? search.trim() : "";
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { description: { contains: keyword } },
      ];
    }
    return prisma.studentEvaluationTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: templateInclude,
    });
  },

  getTemplateById: async (id) => {
    return prisma.studentEvaluationTemplate.findUnique({
      where: { id: Number(id) },
      include: templateInclude,
    });
  },

  createTemplate: async (input = {}) => {
    const {
      name,
      description,
      sections,
      templateType,
      battalionCount,
      teacherEvaluatorCount,
    } = normalizeTemplateInput(input);
    return prisma.studentEvaluationTemplate.create({
      data: {
        name,
        description,
        templateType,
        battalionCount,
        teacherEvaluatorCount,
        createdBy: input.createdBy ? Number(input.createdBy) : null,
        sections: { create: templatePayload(sections) },
      },
      include: templateInclude,
    });
  },

  updateTemplate: async (id, input = {}) => {
    const templateId = Number(id);
    if (!Number.isInteger(templateId)) {
      throwValidationError("id ต้องเป็นตัวเลข");
    }
    const existing = await prisma.studentEvaluationTemplate.findUnique({
      where: { id: templateId },
      select: {
        templateType: true,
        battalionCount: true,
        teacherEvaluatorCount: true,
      },
    });
    if (!existing) {
      throwValidationError("ไม่พบแบบประเมิน");
    }
    const data = {};
    const targetTemplateType =
      input.templateType !== undefined
        ? normalizeTemplateType(input.templateType)
        : existing.templateType;

    if (input.name !== undefined) {
      const name = typeof input.name === "string" ? input.name.trim() : "";
      if (!name) {
        throwValidationError("ชื่อแบบประเมินต้องไม่ว่าง");
      }
      data.name = name;
    }
    if (input.description !== undefined) {
      data.description =
        typeof input.description === "string"
          ? input.description.trim() || null
          : null;
    }
    if (input.isActive !== undefined) {
      data.isActive = Boolean(input.isActive);
    }
    data.templateType = targetTemplateType;

    const counts = normalizeCountsForUpdate(
      targetTemplateType,
      {
        battalionCount: input.battalionCount,
        teacherEvaluatorCount: input.teacherEvaluatorCount,
      },
      {
        battalionCount: existing.battalionCount,
        teacherEvaluatorCount: existing.teacherEvaluatorCount,
      }
    );
    data.battalionCount = counts.battalionCount;
    data.teacherEvaluatorCount = counts.teacherEvaluatorCount;

    const replaceSections = Array.isArray(input.sections);
    const normalizedSections = replaceSections
      ? normalizeSectionPayload(input.sections)
      : null;
    if (replaceSections) {
      const evaluationCount = await prisma.studentEvaluation.count({
        where: { templateId },
      });
      if (evaluationCount > 0) {
        throwValidationError(
          "ไม่สามารถแก้ไขคำถามของแบบประเมินที่ถูกใช้งานแล้ว โปรดสร้างแบบใหม่หรือปิดใช้งานแทน"
        );
      }
    }

    return prisma.$transaction(async (tx) => {
      await tx.studentEvaluationTemplate.update({
        where: { id: templateId },
        data,
      });
      if (replaceSections) {
        await tx.studentEvaluationSection.deleteMany({
          where: { templateId },
        });
        if (normalizedSections.length) {
          for (const section of normalizedSections) {
            await tx.studentEvaluationSection.create({
              data: {
                templateId,
                title: section.title,
                description: section.description,
                sectionOrder: section.sectionOrder,
                questions: {
                  create: section.questions.map((question) => ({
                    prompt: question.prompt,
                    maxScore: question.maxScore,
                    questionOrder: question.questionOrder,
                  })),
                },
              },
            });
          }
        }
      }
      return tx.studentEvaluationTemplate.findUnique({
        where: { id: templateId },
        include: templateInclude,
      });
    });
  },

  deleteTemplate: async (id) => {
    return prisma.studentEvaluationTemplate.delete({
      where: { id: Number(id) },
    });
  },

  createEvaluation: async (input = {}) => {
    const template = await getTemplateWithQuestions(input.templateId);
    if (!template.isActive) {
      throwValidationError("แบบประเมินนี้ถูกปิดการใช้งาน");
    }
    if (template.templateType === "SERVICE" && input.evaluatorRole !== "OWNER") {
      throwValidationError("แบบประเมินนี้อนุญาตให้ OWNER ส่งผลเท่านั้น");
    }
    const isServiceTemplate = template.templateType === "SERVICE";
    const subject =
      typeof input.subject === "string" ? input.subject.trim() : "";
    if (!subject) {
      throwValidationError("ต้องระบุวิชาที่ประเมิน");
    }
    const evaluationRound =
      typeof input.evaluationRound === "string"
        ? input.evaluationRound.trim()
        : "";
    if (isServiceTemplate && !evaluationRound) {
      throwValidationError("ต้องระบุรอบการประเมินสำหรับเทมเพลต SERVICE");
    }
    const evaluatorName =
      typeof input.evaluatorName === "string"
        ? input.evaluatorName.trim()
        : "";
    if (isServiceTemplate && !evaluatorName) {
      throwValidationError("ต้องระบุชื่อผู้ประเมินสำหรับเทมเพลต SERVICE");
    }
    const evaluationPeriod = (() => {
      if (input.evaluationPeriod) {
        const dt = new Date(input.evaluationPeriod);
        if (Number.isNaN(dt.getTime())) {
          throwValidationError("รูปแบบวันที่ประเมินไม่ถูกต้อง");
        }
        return dt;
      }
      if (isServiceTemplate) {
        throwValidationError("ต้องระบุวันที่ประเมินสำหรับเทมเพลต SERVICE");
      }
      return new Date();
    })();
    let evaluatedPersonId =
      input.evaluatedPersonId !== undefined
        ? Number(input.evaluatedPersonId)
        : null;
    if (
      evaluatedPersonId !== null &&
      (!Number.isInteger(evaluatedPersonId) || evaluatedPersonId <= 0)
    ) {
      throwValidationError("evaluatedPersonId ต้องเป็นตัวเลข id ของผู้ใช้");
    }
    const evaluatedPerson =
      typeof input.evaluatedPerson === "string"
        ? input.evaluatedPerson.trim()
        : "";
    if (!evaluatedPersonId && evaluatedPerson) {
      evaluatedPersonId = await resolveEvaluatedPersonId(evaluatedPerson);
    }
    if (isServiceTemplate && !evaluatedPerson && !evaluatedPersonId) {
      throwValidationError(
        "ต้องระบุชื่อผู้ถูกรับการประเมินหรือ evaluatedPersonId สำหรับเทมเพลต SERVICE"
      );
    }

    const companyCode = isServiceTemplate
      ? "SERVICE"
      : normalizeUnitCode(input.companyCode);
    const battalionCode = isServiceTemplate
      ? "SERVICE"
      : normalizeUnitCode(input.battalionCode);

    if (!isServiceTemplate) {
      if (!companyCode) throwValidationError("ต้องระบุรหัสกองร้อย");
      if (!battalionCode) throwValidationError("ต้องระบุรหัสกองพัน");
    }
    const questionMap = new Map();
    template.sections.forEach((section) => {
      section.questions.forEach((question) => {
        questionMap.set(question.id, question);
      });
    });
    const normalizedAnswers = normalizeEvaluationAnswers(
      input.answers,
      questionMap
    );
    const totalScore = normalizedAnswers.reduce(
      (sum, answer) => sum + answer.score,
      0
    );
    const averageScore =
      normalizedAnswers.length > 0
        ? totalScore / normalizedAnswers.length
        : 0;

    return prisma.studentEvaluation.create({
      data: {
        templateId: template.id,
        evaluatorId: Number(input.evaluatorId),
        companyCode,
        battalionCode,
        subject,
        evaluationPeriod,
        evaluationRound: evaluationRound || null,
        evaluatorName: evaluatorName || null,
        evaluatedPersonId: evaluatedPersonId || null,
        evaluatedPerson: evaluatedPerson || null,
        summary:
          typeof input.summary === "string"
            ? input.summary.trim() || null
            : null,
        overallScore: averageScore,
        answers: {
          create: normalizedAnswers.map((answer) => ({
            questionId: answer.questionId,
            score: answer.score,
            comment: answer.comment,
          })),
        },
      },
      include: evaluationIncludeWithAnswers,
    });
  },

  listEvaluations: async (filters = {}) => {
    const where = buildEvaluationWhere(filters);
    const includeAnswers = filters.includeAnswers === true;
    const pageSize = Math.max(1, Math.min(Number(filters.pageSize) || 20, 500));
    const page = Math.max(1, Number(filters.page) || 1);
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.studentEvaluation.findMany({
        where,
        orderBy: { submittedAt: "desc" },
        skip,
        take: pageSize,
        include: includeAnswers
          ? evaluationIncludeWithAnswers
          : evaluationIncludeBase,
      }),
      prisma.studentEvaluation.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  summarizeEvaluations: async (filters = {}) => {
    const where = buildEvaluationWhere(filters);
    const [totalEvaluations, answerAggregate] = await Promise.all([
      prisma.studentEvaluation.count({ where }),
      prisma.studentEvaluationAnswer.aggregate({
        where: { evaluation: where },
        _sum: { score: true },
        _count: true,
      }),
    ]);
    const totalScore = answerAggregate._sum?.score || 0;
    const totalAnswers =
      typeof answerAggregate._count === "number"
        ? answerAggregate._count
        : answerAggregate._count?._all || 0;
    const averageScore =
      totalAnswers > 0 ? totalScore / totalAnswers : null;
    return { totalEvaluations, totalScore, averageScore };
  },

  summarizeByCompany: async (filters = {}) => {
    const templateTypeFilter = filters.templateType
      ? normalizeTemplateType(filters.templateType)
      : null;
    if (templateTypeFilter === "SERVICE") return [];

    // ถ้าระบุ templateId ให้ตัดทอน summaryByCompany สำหรับเทมเพลต SERVICE
    if (!templateTypeFilter && filters.templateId) {
      const tpl = await prisma.studentEvaluationTemplate.findUnique({
        where: { id: Number(filters.templateId) },
        select: { templateType: true },
      });
      if (tpl?.templateType === "SERVICE") return [];
    }

    const where = buildEvaluationWhere(filters);
    const groups = await prisma.studentEvaluation.groupBy({
      by: ["battalionCode", "companyCode"],
      where,
      _count: { _all: true },
      _sum: { overallScore: true },
      _avg: { overallScore: true },
    });
    return groups
      .map((g) => ({
        battalionCode: g.battalionCode,
        companyCode: g.companyCode,
        totalEvaluations: g._count?._all || 0,
        totalScore: g._sum?.overallScore || 0,
        averageOverallScore: g._avg?.overallScore || null,
      }))
      .sort((a, b) => {
        const battalionCmp = (a.battalionCode || "").localeCompare(
          b.battalionCode || ""
        );
        if (battalionCmp !== 0) return battalionCmp;
        return (a.companyCode || "").localeCompare(b.companyCode || "");
      });
  },

  compareAverages: async (filters = {}) => {
    const templateTypeFilter = filters.templateType
      ? normalizeTemplateType(filters.templateType)
      : null;
    if (templateTypeFilter === "SERVICE")
      return { battalions: [], companies: [] };

    const isServiceCode = (code) =>
      typeof code === "string" && code.trim().toUpperCase() === "SERVICE";

    const battalionCodesList = Array.isArray(filters.battalionCodesList)
      ? filters.battalionCodesList.map((c) =>
          typeof c === "string" ? c.trim().toUpperCase() : null
        ).filter((c) => c && !isServiceCode(c))
      : [];
    const companyCodesList = Array.isArray(filters.companyCodesList)
      ? filters.companyCodesList.map((c) =>
          typeof c === "string" ? c.trim().toUpperCase() : null
        ).filter((c) => c && !isServiceCode(c))
      : [];

    if (!templateTypeFilter && filters.templateId) {
      const tpl = await prisma.studentEvaluationTemplate.findUnique({
        where: { id: Number(filters.templateId) },
        select: { templateType: true },
      });
      if (tpl?.templateType === "SERVICE") {
        return { battalions: [], companies: [] };
      }
    }

    const where = buildEvaluationWhere(filters);
    const [companyGroups, battalionGroups] = await Promise.all([
      prisma.studentEvaluation.groupBy({
        by: ["battalionCode", "companyCode"],
        where,
        _count: { _all: true },
        _sum: { overallScore: true },
        _avg: { overallScore: true },
      }),
      prisma.studentEvaluation.groupBy({
        by: ["battalionCode"],
        where,
        _count: { _all: true },
        _sum: { overallScore: true },
        _avg: { overallScore: true },
      }),
    ]);

    const companies = companyGroups
      .filter(
        (g) =>
          !isServiceCode(g.battalionCode) && !isServiceCode(g.companyCode)
      )
      .map((g) => ({
        battalionCode: g.battalionCode,
        companyCode: g.companyCode,
        totalEvaluations: g._count?._all || 0,
        totalScore: g._sum?.overallScore || 0,
        averageOverallScore: g._avg?.overallScore || null,
      }))
      .sort((a, b) => {
        const avgA = Number.isFinite(a.averageOverallScore)
          ? a.averageOverallScore
          : -Infinity;
        const avgB = Number.isFinite(b.averageOverallScore)
          ? b.averageOverallScore
          : -Infinity;
        if (avgA !== avgB) return avgB - avgA;
        const battalionCmp = (a.battalionCode || "").localeCompare(
          b.battalionCode || ""
        );
        if (battalionCmp !== 0) return battalionCmp;
        return (a.companyCode || "").localeCompare(b.companyCode || "");
      });

    const battalionOrder = new Map(
      battalionCodesList.map((code, idx) => [code, idx])
    );
    const companyOrder = new Map(
      companyCodesList.map((code, idx) => [code, idx])
    );

    const companiesGrid =
      battalionCodesList.length > 0 && companyCodesList.length > 0
        ? battalionCodesList.flatMap((bCode) =>
            companyCodesList.map((cCode) => ({
              battalionCode: bCode,
              companyCode: cCode,
            }))
          )
        : [];

    const companyKey = (bCode, cCode) => `${bCode || ""}__${cCode || ""}`;
    const companyMap = new Map(
      companies.map((c) => [companyKey(c.battalionCode, c.companyCode), c])
    );

    if (companiesGrid.length) {
      companiesGrid.forEach(({ battalionCode, companyCode }) => {
        const key = companyKey(battalionCode, companyCode);
        if (!companyMap.has(key)) {
          companyMap.set(key, {
            battalionCode,
            companyCode,
            totalEvaluations: 0,
            totalScore: 0,
            averageOverallScore: null,
          });
        }
      });
      companies.length = 0;
      companies.push(...companyMap.values());
    }

    companies.sort((a, b) => {
      const avgA = Number.isFinite(a.averageOverallScore)
        ? a.averageOverallScore
        : -Infinity;
      const avgB = Number.isFinite(b.averageOverallScore)
        ? b.averageOverallScore
        : -Infinity;
      if (avgA !== avgB) return avgB - avgA;
      const battalionCmp =
        battalionOrder.has(a.battalionCode) || battalionOrder.has(b.battalionCode)
          ? (battalionOrder.get(a.battalionCode) ?? Infinity) -
            (battalionOrder.get(b.battalionCode) ?? Infinity)
          : (a.battalionCode || "").localeCompare(b.battalionCode || "");
      if (battalionCmp !== 0) return battalionCmp;
      if (companyOrder.has(a.companyCode) || companyOrder.has(b.companyCode)) {
        return (
          (companyOrder.get(a.companyCode) ?? Infinity) -
          (companyOrder.get(b.companyCode) ?? Infinity)
        );
      }
      return (a.companyCode || "").localeCompare(b.companyCode || "");
    });

    const battalions = battalionGroups
      .filter((g) => !isServiceCode(g.battalionCode))
      .map((g) => {
        const avg =
          typeof g._avg?.overallScore === "number"
            ? g._avg.overallScore
            : null;
        return {
          battalionCode: g.battalionCode,
          totalEvaluations: g._count?._all || 0,
          totalScore: g._sum?.overallScore || 0,
          averageOverallScore: avg,
        };
      })
      .concat(
        battalionCodesList
          .filter(
            (code) => !battalionGroups.some((b) => b.battalionCode === code)
          )
          .map((code) => ({
            battalionCode: code,
            totalEvaluations: 0,
            totalScore: 0,
            averageOverallScore: null,
          }))
      )
      .map((battalion) => ({
        ...battalion,
        companies: companies.filter(
          (c) => c.battalionCode === battalion.battalionCode
        ),
      }))
      .sort((a, b) => {
        const avgA = Number.isFinite(a.averageOverallScore)
          ? a.averageOverallScore
          : -Infinity;
        const avgB = Number.isFinite(b.averageOverallScore)
          ? b.averageOverallScore
          : -Infinity;
        if (avgA !== avgB) return avgB - avgA;
        if (battalionOrder.has(a.battalionCode) || battalionOrder.has(b.battalionCode)) {
          return (
            (battalionOrder.get(a.battalionCode) ?? Infinity) -
            (battalionOrder.get(b.battalionCode) ?? Infinity)
          );
        }
        return (a.battalionCode || "").localeCompare(b.battalionCode || "");
      });

    return { battalions, companies };
  },

  getEvaluationById: async (id) => {
    return prisma.studentEvaluation.findUnique({
      where: { id: Number(id) },
      include: evaluationIncludeWithAnswers,
    });
  },

  updateEvaluation: async (id, input = {}) => {
    const evaluationId = Number(id);
    if (!Number.isInteger(evaluationId)) {
      throwValidationError("id ต้องเป็นตัวเลข");
    }
    const existing = await prisma.studentEvaluation.findUnique({
      where: { id: evaluationId },
      include: {
        template: { include: { sections: { include: { questions: true } } } },
      },
    });
    if (!existing) {
      const err = new Error("ไม่พบข้อมูลการประเมิน");
      err.code = "NOT_FOUND";
      throw err;
    }
    if (
      existing.template?.templateType === "SERVICE" &&
      input.evaluatorRole !== "OWNER"
    ) {
      throwValidationError("แบบประเมินนี้อนุญาตให้ OWNER ส่งผลเท่านั้น");
    }
    const data = {};
    if (input.companyCode !== undefined) {
      const companyCode =
        typeof input.companyCode === "string"
          ? input.companyCode.trim().toUpperCase()
          : "";
      if (!companyCode) {
        throwValidationError("รหัสกองร้อยต้องไม่ว่าง");
      }
      data.companyCode = companyCode;
    }
    if (input.subject !== undefined) {
      const subject =
        typeof input.subject === "string" ? input.subject.trim() : "";
      if (!subject) {
        throwValidationError("วิชาที่ประเมินต้องไม่ว่าง");
      }
      data.subject = subject;
    }
    if (input.battalionCode !== undefined) {
      const battalionCode =
        typeof input.battalionCode === "string"
          ? input.battalionCode.trim().toUpperCase()
          : "";
      if (!battalionCode) {
        throwValidationError("รหัสกองพันต้องไม่ว่าง");
      }
      data.battalionCode = battalionCode;
    }
    if (input.evaluationPeriod !== undefined) {
      const dt = new Date(input.evaluationPeriod);
      if (Number.isNaN(dt.getTime())) {
        throwValidationError("รูปแบบวันที่ประเมินไม่ถูกต้อง");
      }
      data.evaluationPeriod = dt;
    }
    if (input.evaluationRound !== undefined) {
      const round =
        typeof input.evaluationRound === "string"
          ? input.evaluationRound.trim()
          : "";
      if (existing.template?.templateType === "SERVICE" && !round) {
        throwValidationError("รอบการประเมินต้องไม่ว่างสำหรับเทมเพลต SERVICE");
      }
      data.evaluationRound = round || null;
    }
    if (input.evaluatorName !== undefined) {
      const evaluatorName =
        typeof input.evaluatorName === "string"
          ? input.evaluatorName.trim()
          : "";
      if (existing.template?.templateType === "SERVICE" && !evaluatorName) {
        throwValidationError("ชื่อผู้ประเมินต้องไม่ว่างสำหรับเทมเพลต SERVICE");
      }
      data.evaluatorName = evaluatorName || null;
    }
    if (input.evaluatedPersonId !== undefined) {
      const evaluatedPersonId =
        input.evaluatedPersonId !== null ? Number(input.evaluatedPersonId) : null;
      if (
        evaluatedPersonId !== null &&
        (!Number.isInteger(evaluatedPersonId) || evaluatedPersonId <= 0)
      ) {
        throwValidationError("evaluatedPersonId ต้องเป็นตัวเลข id ของผู้ใช้");
      }
      data.evaluatedPersonId = evaluatedPersonId;
    }
    if (input.evaluatedPerson !== undefined) {
      const evaluatedPerson =
        typeof input.evaluatedPerson === "string"
          ? input.evaluatedPerson.trim()
          : "";
      if (existing.template?.templateType === "SERVICE" && !evaluatedPerson) {
        throwValidationError(
          "ชื่อผู้ถูกรับการประเมินต้องไม่ว่างสำหรับเทมเพลต SERVICE"
        );
      }
      data.evaluatedPerson = evaluatedPerson || null;
    }
    if (
      data.evaluatedPersonId === undefined &&
      data.evaluatedPerson &&
      !existing.evaluatedPersonId
    ) {
      const resolvedId = await resolveEvaluatedPersonId(data.evaluatedPerson);
      if (resolvedId) {
        data.evaluatedPersonId = resolvedId;
      }
    }
    if (input.summary !== undefined) {
      data.summary =
        typeof input.summary === "string"
          ? input.summary.trim() || null
          : null;
    }
    let normalizedAnswers = null;
    if (Array.isArray(input.answers)) {
      const questionMap = new Map();
      existing.template.sections.forEach((section) => {
        section.questions.forEach((question) => {
          questionMap.set(question.id, question);
        });
      });
      normalizedAnswers = normalizeEvaluationAnswers(
        input.answers,
        questionMap
      );
      const totalScore = normalizedAnswers.reduce(
        (sum, answer) => sum + answer.score,
        0
      );
      const averageScore =
        normalizedAnswers.length > 0
          ? totalScore / normalizedAnswers.length
          : 0;
      data.overallScore = averageScore;
    }

    return prisma.$transaction(async (tx) => {
      await tx.studentEvaluation.update({
        where: { id: evaluationId },
        data,
      });
      if (normalizedAnswers) {
        await tx.studentEvaluationAnswer.deleteMany({
          where: { evaluationId },
        });
        await tx.studentEvaluationAnswer.createMany({
          data: normalizedAnswers.map((answer) => ({
            evaluationId,
            questionId: answer.questionId,
            score: answer.score,
            comment: answer.comment,
          })),
        });
      }
      return tx.studentEvaluation.findUnique({
        where: { id: evaluationId },
        include: evaluationIncludeWithAnswers,
      });
    });
  },

  deleteEvaluation: async (id) => {
    return prisma.studentEvaluation.delete({
      where: { id: Number(id) },
    });
  },
};
