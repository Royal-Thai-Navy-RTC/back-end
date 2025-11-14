const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const REQUIRED_FIELDS = ["teacherId", "leaveType", "startDate"];
const VALID_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED"]);

const normalizePayload = (input = {}) => {
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

  const startDate =
    input.startDate instanceof Date ? input.startDate : new Date(input.startDate);
  if (Number.isNaN(startDate.getTime())) {
    const err = new Error("รูปแบบวันเริ่มลาไม่ถูกต้อง");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  let endDate = null;
  if (input.endDate) {
    endDate = input.endDate instanceof Date ? input.endDate : new Date(input.endDate);
    if (Number.isNaN(endDate.getTime())) {
      const err = new Error("รูปแบบวันสิ้นสุดลาไม่ถูกต้อง");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    if (endDate.getTime() < startDate.getTime()) {
      const err = new Error("วันสิ้นสุดลาต้องไม่น้อยกว่าวันเริ่มลา");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
  }

  let status = undefined;
  if (input.status) {
    const normalizedStatus = String(input.status).trim().toUpperCase();
    if (!VALID_STATUSES.has(normalizedStatus)) {
      const err = new Error("สถานะการลาไม่ถูกต้อง");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    status = normalizedStatus;
  }

  const payload = {
    teacherId,
    leaveType: String(input.leaveType).trim(),
    destination: input.destination ? String(input.destination).trim() : null,
    reason: input.reason ? String(input.reason).trim() : null,
    startDate,
    endDate,
    status,
  };

  return payload;
};

const createTeacherLeave = async (input) => {
  const data = normalizePayload(input);
  return prisma.teacherLeave.create({
    data,
  });
};

const getTeacherLeaves = async ({ teacherId, limit = 20 }) => {
  const take = Math.max(1, Math.min(Number(limit) || 20, 100));
  return prisma.teacherLeave.findMany({
    where: { teacherId: Number(teacherId) },
    orderBy: { startDate: "desc" },
    take,
  });
};

const getAdminLeaveSummary = async () => {
  const now = new Date();
  const [
    totalActiveTeachers,
    totalLeaveRequests,
    currentLeaveRecords,
    recentLeaves,
  ] = await Promise.all([
    prisma.user.count({
      where: { role: "TEACHER", isActive: true },
    }),
    prisma.teacherLeave.count(),
    prisma.teacherLeave.findMany({
      where: {
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rank: true,
            position: true,
          },
        },
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.teacherLeave.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rank: true,
            position: true,
          },
        },
      },
    }),
  ]);

  const currentOnLeaveTeacherIds = new Set(
    currentLeaveRecords.map((record) => record.teacherId)
  );
  const currentOnLeave = currentOnLeaveTeacherIds.size;

  const overview = {
    totalTeachers: totalActiveTeachers,
    totalLeaveRequests,
    currentOnLeave,
    availableTeachers: Math.max(totalActiveTeachers - currentOnLeave, 0),
  };

  const currentLeaves = currentLeaveRecords.map((record) => ({
    id: record.id,
    teacherId: record.teacherId,
    teacherName: record.teacher
      ? `${record.teacher.firstName} ${record.teacher.lastName}`
      : null,
    rank: record.teacher?.rank || null,
    position: record.teacher?.position || null,
    leaveType: record.leaveType,
    destination: record.destination,
    reason: record.reason,
    startDate: record.startDate,
    endDate: record.endDate,
    status: record.status,
  }));

  const recentLeaveActivities = recentLeaves.map((record) => ({
    id: record.id,
    teacherId: record.teacherId,
    teacherName: record.teacher
      ? `${record.teacher.firstName} ${record.teacher.lastName}`
      : null,
    leaveType: record.leaveType,
    destination: record.destination,
    startDate: record.startDate,
    endDate: record.endDate,
    status: record.status,
    createdAt: record.createdAt,
  }));

  return {
    overview,
    currentLeaves,
    recentLeaves: recentLeaveActivities,
  };
};

const listTeacherLeaves = async ({ status, limit = 50 } = {}) => {
  const take = Math.max(1, Math.min(Number(limit) || 50, 200));
  let normalizedStatus;
  if (status) {
    normalizedStatus = String(status).toUpperCase();
    if (!VALID_STATUSES.has(normalizedStatus)) {
      const err = new Error("สถานะการลาไม่ถูกต้อง");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
  }

  return prisma.teacherLeave.findMany({
    where: normalizedStatus ? { status: normalizedStatus } : {},
    orderBy: { createdAt: "desc" },
    take,
    include: {
      teacher: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          rank: true,
          position: true,
        },
      },
    },
  });
};

const updateTeacherLeaveStatus = async ({ leaveId, status }) => {
  const id = Number(leaveId);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error("leaveId ไม่ถูกต้อง");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  const normalizedStatus = String(status || "")
    .trim()
    .toUpperCase();
  if (!VALID_STATUSES.has(normalizedStatus)) {
    const err = new Error("สถานะการลาไม่ถูกต้อง");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  return prisma.teacherLeave.update({
    where: { id },
    data: { status: normalizedStatus },
    include: {
      teacher: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          rank: true,
          position: true,
        },
      },
    },
  });
};

module.exports = {
  createTeacherLeave,
  getTeacherLeaves,
  getAdminLeaveSummary,
  listTeacherLeaves,
  updateTeacherLeaveStatus,
};
