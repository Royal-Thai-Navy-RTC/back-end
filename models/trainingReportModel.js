const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const REQUIRED_FIELDS = [
  "teacherId",
  "subject",
  "participantCount",
  "trainingDate",
  "durationHours",
];

const validatePayload = (input = {}) => {
  const missing = REQUIRED_FIELDS.filter(
    (field) => input[field] === undefined || input[field] === null || input[field] === ""
  );
  if (missing.length) {
    const err = new Error(`ข้อมูลไม่ครบถ้วน: ต้องมี ${missing.join(", ")}`);
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const teacherId = Number(input.teacherId);
  if (!Number.isInteger(teacherId) || teacherId <= 0) {
    const err = new Error("teacherId ไม่ถูกต้อง");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const participantCount = Number(input.participantCount);
  if (!Number.isFinite(participantCount) || participantCount < 0) {
    const err = new Error("จำนวนผู้เข้าร่วมต้องเป็นตัวเลขที่มากกว่าหรือเท่ากับ 0");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const durationHours = Number(input.durationHours);
  if (!Number.isFinite(durationHours) || durationHours <= 0) {
    const err = new Error("ระยะเวลาสอน (ชั่วโมง) ต้องเป็นตัวเลขที่มากกว่า 0");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const trainingDate =
    input.trainingDate instanceof Date
      ? input.trainingDate
      : new Date(input.trainingDate);
  if (Number.isNaN(trainingDate.getTime())) {
    const err = new Error("รูปแบบวันที่สอนไม่ถูกต้อง");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const normalized = {
    teacherId,
    subject: String(input.subject).trim(),
    participantCount: Math.round(participantCount),
    company: input.company ? String(input.company).trim() : null,
    battalion: input.battalion ? String(input.battalion).trim() : null,
    trainingDate,
    trainingTime: input.trainingTime ? String(input.trainingTime).trim() : null,
    location: input.location ? String(input.location).trim() : null,
    durationHours,
    notes: input.notes ? String(input.notes).trim() : null,
  };

  return normalized;
};

const createTrainingReport = async (input) => {
  const data = validatePayload(input);
  return prisma.trainingReport.create({
    data,
  });
};

const getRecentReportsForTeacher = async ({ teacherId, limit = 5 }) => {
  const take = Math.max(1, Math.min(Number(limit) || 5, 20));
  return prisma.trainingReport.findMany({
    where: { teacherId: Number(teacherId) },
    orderBy: { createdAt: "desc" },
    take,
  });
};

module.exports = {
  createTrainingReport,
  getRecentReportsForTeacher,
};
