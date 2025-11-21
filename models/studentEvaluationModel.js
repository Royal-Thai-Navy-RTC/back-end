const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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

const evaluationInclude = {
  template: {
    select: { id: true, name: true, description: true },
  },
  evaluator: {
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  },
  answers: {
    orderBy: { id: "asc" },
    include: {
      question: {
        select: {
          id: true,
          prompt: true,
          maxScore: true,
          section: {
            select: { id: true, title: true, sectionOrder: true },
          },
        },
      },
    },
  },
};

// ใช้รวม logic สร้าง where สำหรับ list/summary
const buildEvaluationWhere = (filters = {}) => {
  const where = {};
  if (filters.templateId) {
    where.templateId = Number(filters.templateId);
  }
  if (filters.companyCode) {
    where.companyCode = String(filters.companyCode).trim().toUpperCase();
  }
  if (filters.battalionCode) {
    where.battalionCode = String(filters.battalionCode).trim().toUpperCase();
  }
  if (filters.evaluatorId) {
    where.evaluatorId = Number(filters.evaluatorId);
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

const normalizeTemplateInput = (input = {}) => {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) {
    throwValidationError("ต้องระบุชื่อแบบประเมิน");
  }
  const description =
    typeof input.description === "string"
      ? input.description.trim() || null
      : null;
  const sections = normalizeSectionPayload(input.sections);
  return { name, description, sections };
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

module.exports = {
  listTemplates: async ({ includeInactive = false, search } = {}) => {
    const where = {};
    if (!includeInactive) {
      where.isActive = true;
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
    const { name, description, sections } = normalizeTemplateInput(input);
    return prisma.studentEvaluationTemplate.create({
      data: {
        name,
        description,
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
    const data = {};
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
    const replaceSections = Array.isArray(input.sections);
    const normalizedSections = replaceSections
      ? normalizeSectionPayload(input.sections)
      : null;

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
    const subject =
      typeof input.subject === "string" ? input.subject.trim() : "";
    if (!subject) {
      throwValidationError("ต้องระบุวิชาที่ประเมิน");
    }
    const companyCode =
      typeof input.companyCode === "string"
        ? input.companyCode.trim().toUpperCase()
        : "";
    const battalionCode =
      typeof input.battalionCode === "string"
        ? input.battalionCode.trim().toUpperCase()
        : "";
    if (!companyCode) {
      throwValidationError("ต้องระบุรหัสกองร้อย");
    }
    if (!battalionCode) {
      throwValidationError("ต้องระบุรหัสกองพัน");
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
    const totalScore =
      input.overallScore != null
        ? Math.round(Number(input.overallScore))
        : normalizedAnswers.reduce((sum, answer) => sum + answer.score, 0);

    return prisma.studentEvaluation.create({
      data: {
        templateId: template.id,
        evaluatorId: Number(input.evaluatorId),
        companyCode,
        battalionCode,
        subject,
        evaluationPeriod: input.evaluationPeriod
          ? new Date(input.evaluationPeriod)
          : new Date(),
        summary:
          typeof input.summary === "string"
            ? input.summary.trim() || null
            : null,
        overallScore: totalScore,
        answers: {
          create: normalizedAnswers.map((answer) => ({
            questionId: answer.questionId,
            score: answer.score,
            comment: answer.comment,
          })),
        },
      },
      include: evaluationInclude,
    });
  },

  listEvaluations: async (filters = {}) => {
    const where = buildEvaluationWhere(filters);
    return prisma.studentEvaluation.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      include: evaluationInclude,
    });
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
    const totalAnswers = typeof answerAggregate._count === "number"
      ? answerAggregate._count
      : answerAggregate._count?._all || 0;
    const averageScore =
      totalAnswers > 0 ? Number((totalScore / totalAnswers).toFixed(2)) : null;
    return { totalEvaluations, totalScore, averageScore };
  },

  summarizeByCompany: async (filters = {}) => {
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

  getEvaluationById: async (id) => {
    return prisma.studentEvaluation.findUnique({
      where: { id: Number(id) },
      include: evaluationInclude,
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
    const data = {};
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
      const totalScore =
        input.overallScore != null
          ? Math.round(Number(input.overallScore))
          : normalizedAnswers.reduce((sum, answer) => sum + answer.score, 0);
      data.overallScore = totalScore;
    } else if (input.overallScore !== undefined) {
      data.overallScore = Math.round(Number(input.overallScore) || 0);
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
        include: evaluationInclude,
      });
    });
  },

  deleteEvaluation: async (id) => {
    return prisma.studentEvaluation.delete({
      where: { id: Number(id) },
    });
  },
};
