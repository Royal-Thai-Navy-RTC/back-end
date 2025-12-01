const prisma = require("../utils/prisma");

const REQUIRED_FIELDS = ["teacherId", "leaveType", "startDate"];
const VALID_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED", "CANCEL"]);

const teacherSelectFields = {
  id: true,
  firstName: true,
  lastName: true,
  rank: true,
  position: true,
};

const adminApproverSelectFields = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
};

const ownerApproverSelectFields = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
};

const leaveRelationInclude = {
  teacher: {
    select: teacherSelectFields,
  },
  adminApprover: {
    select: adminApproverSelectFields,
  },
  ownerApprover: {
    select: ownerApproverSelectFields,
  },
};

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

  if (typeof input.isOfficialDuty === "boolean") {
    payload.isOfficialDuty = input.isOfficialDuty;
  }

  return payload;
};

const createTeacherLeave = async (input) => {
  const data = normalizePayload(input);
  data.isOfficialDuty = false;
  data.adminApprovalStatus = "PENDING";
  data.ownerApprovalStatus = null;
  return prisma.teacherLeave.create({
    data,
    include: leaveRelationInclude,
  });
};

const createOfficialDutyLeave = async (input = {}) => {
  const data = normalizePayload({
    ...input,
    leaveType: input.leaveType || "ลาไปราชการ",
  });
  data.isOfficialDuty = true;
  data.status = "PENDING";
  data.adminApprovalStatus = null;
  data.ownerApprovalStatus = "PENDING";
  return prisma.teacherLeave.create({
    data,
    include: leaveRelationInclude,
  });
};

const getTeacherLeaves = async ({
  teacherId,
  limit = 20,
  officialDutyOnly = false,
} = {}) => {
  const take = Math.max(1, Math.min(Number(limit) || 20, 100));
  const where = { teacherId: Number(teacherId) };
  if (officialDutyOnly === true) {
    where.isOfficialDuty = true;
  } else if (officialDutyOnly === false) {
    where.isOfficialDuty = false;
  }
  return prisma.teacherLeave.findMany({
    where,
    orderBy: { startDate: "desc" },
    take,
    include: leaveRelationInclude,
  });
};

const getAdminLeaveSummary = async () => {
  const now = new Date();
  const [
    totalActiveTeachers,
    totalActiveAdmins,
    totalActiveOwners,
    totalActiveSubAdmins,
    leaveTeacherRecords,
    commanderLeaveRecords,
    currentLeaveRecords,
    recentLeaves,
    pendingOfficialDutyRequests,
    pendingOfficialDutyCommanderRequests,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        role: { in: ["TEACHER", "SUB_ADMIN"] },
        isActive: true,
      },
    }),
    prisma.user.count({
      where: { role: "ADMIN", isActive: true },
    }),
    prisma.user.count({
      where: { role: "OWNER", isActive: true },
    }),
    prisma.user.count({
      where: { role: "SUB_ADMIN", isActive: true },
    }),
    prisma.teacherLeave.findMany({
      select: { teacherId: true },
    }),
    prisma.teacherLeave.findMany({
      where: { teacher: { role: { in: ["ADMIN", "OWNER", "SUB_ADMIN"] } } },
      select: { teacherId: true },
    }),
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
            role: true,
          },
        },
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.teacherLeave.findMany({
      orderBy: { createdAt: "desc" },
      take: 1,
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rank: true,
            position: true,
            role: true,
          },
        },
      },
    }),
    prisma.teacherLeave.count({
      where: {
        isOfficialDuty: true,
        status: "PENDING",
      },
    }),
    prisma.teacherLeave.count({
      where: {
        isOfficialDuty: true,
        status: "PENDING",
        teacher: { role: { in: ["ADMIN", "OWNER", "SUB_ADMIN"] } },
      },
    }),
  ]);

  const currentOnLeaveTeacherIds = new Set(
    currentLeaveRecords.map((record) => record.teacherId)
  );
  const currentOnLeave = currentOnLeaveTeacherIds.size;

  const currentOfficialDutyTeacherIds = new Set(
    currentLeaveRecords
      .filter((record) => record.isOfficialDuty)
      .map((record) => record.teacherId)
  );

  const uniqueLeaveTeachers = new Set(
    leaveTeacherRecords.map((record) => record.teacherId)
  );

  const totalActiveCommanders =
    totalActiveAdmins + totalActiveOwners + totalActiveSubAdmins;
  const uniqueLeaveCommanders = new Set(
    commanderLeaveRecords.map((record) => record.teacherId)
  );
  const commanderCurrentOnLeaveIds = new Set(
    currentLeaveRecords
      .filter((record) =>
        ["ADMIN", "OWNER", "SUB_ADMIN"].includes(record.teacher?.role)
      )
      .map((record) => record.teacherId)
  );
  const commanderOfficialDutyOnLeaveIds = new Set(
    currentLeaveRecords
      .filter(
        (record) =>
          record.isOfficialDuty &&
          ["ADMIN", "OWNER", "SUB_ADMIN"].includes(record.teacher?.role)
      )
      .map((record) => record.teacherId)
  );

  const overview = {
    totalTeachers: totalActiveTeachers,
    totalLeaveRequests: uniqueLeaveTeachers.size,
    currentOnLeave,
    availableTeachers: Math.max(totalActiveTeachers - currentOnLeave, 0),
    officialDutyOnLeave: currentOfficialDutyTeacherIds.size,
    officialDutyPending: pendingOfficialDutyRequests,
  };

  const commanderOverview = {
    totalCommanders: totalActiveCommanders,
    totalLeaveRequests: uniqueLeaveCommanders.size,
    currentOnLeave: commanderCurrentOnLeaveIds.size,
    availableCommanders: Math.max(
      totalActiveCommanders - commanderCurrentOnLeaveIds.size,
      0
    ),
    officialDutyOnLeave: commanderOfficialDutyOnLeaveIds.size,
    officialDutyPending: pendingOfficialDutyCommanderRequests,
  };

  const commanderRoles = {
    admin: totalActiveAdmins,
    owner: totalActiveOwners,
    subAdmin: totalActiveSubAdmins,
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
    isOfficialDuty: record.isOfficialDuty,
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
    isOfficialDuty: record.isOfficialDuty,
  }));

  return {
    overview,
    commanderOverview,
    commanderRoles,
    currentLeaves,
    recentLeaves: recentLeaveActivities,
  };
};

const listTeacherLeaves = async ({
  status,
  adminStatus,
  limit = 50,
  includeOfficial = true,
} = {}) => {
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
  let normalizedAdminStatus;
  if (adminStatus) {
    normalizedAdminStatus = String(adminStatus).toUpperCase();
    if (!VALID_STATUSES.has(normalizedAdminStatus)) {
      const err = new Error("สถานะการอนุมัติของแอดมินไม่ถูกต้อง");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
  }

  const where = includeOfficial ? {} : { isOfficialDuty: false };
  if (normalizedStatus) {
    where.status = normalizedStatus;
  }
  if (normalizedAdminStatus) {
    where.adminApprovalStatus = normalizedAdminStatus;
  }

  return prisma.teacherLeave.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: leaveRelationInclude,
  });
};

const listOfficialDutyLeavesForOwner = async ({ status, limit = 50 } = {}) => {
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

  const where = { isOfficialDuty: true };
  if (normalizedStatus) {
    where.status = normalizedStatus;
  }

  return prisma.teacherLeave.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: leaveRelationInclude,
  });
};

const listOwnerGeneralLeaves = async ({ status, limit = 50 } = {}) => {
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

  const where = {
    isOfficialDuty: false,
    adminApprovalStatus: "APPROVED",
  };
  if (normalizedStatus) {
    where.status = normalizedStatus;
  }

  return prisma.teacherLeave.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: leaveRelationInclude,
  });
};

const updateTeacherLeaveStatus = async ({ leaveId, status, approverId }) => {
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

  const existing = await prisma.teacherLeave.findUnique({
    where: { id },
    select: {
      id: true,
      isOfficialDuty: true,
      adminApprovalStatus: true,
    },
  });
  if (!existing) {
    const err = new Error("ไม่พบคำขอลา");
    err.code = "P2025";
    throw err;
  }
  if (existing.isOfficialDuty) {
    const err = new Error("คำขอลาไปราชการต้องให้ OWNER พิจารณา");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  if (
    existing.adminApprovalStatus &&
    existing.adminApprovalStatus !== "PENDING"
  ) {
    const err = new Error("คำขอนี้ได้รับการพิจารณาแล้ว");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const data = {
    adminApprovalStatus: normalizedStatus,
    adminApprovalBy: approverId ? Number(approverId) : null,
    adminApprovalAt: new Date(),
  };
  // Prevent redundant updates when leave already at the requested state
  if (existing.adminApprovalStatus === normalizedStatus) {
    return prisma.teacherLeave.findUnique({
      where: { id },
      include: leaveRelationInclude,
    });
  }

  if (normalizedStatus === "APPROVED") {
    data.status = "PENDING";
    data.ownerApprovalStatus = "PENDING";
  } else if (normalizedStatus === "REJECTED") {
    data.status = "REJECTED";
    data.ownerApprovalStatus = null;
  } else {
    data.status = "PENDING";
    data.ownerApprovalStatus = null;
  }

  return prisma.teacherLeave.update({
    where: { id },
    data,
    include: leaveRelationInclude,
  });
};

const updateOfficialDutyLeaveStatus = async ({ leaveId, status, approverId }) => {
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

  const existing = await prisma.teacherLeave.findUnique({
    where: { id },
    select: { id: true, isOfficialDuty: true },
  });
  if (!existing) {
    const err = new Error("ไม่พบคำขอลา");
    err.code = "P2025";
    throw err;
  }
  if (!existing.isOfficialDuty) {
    const err = new Error("คำขอลาทั่วไปไม่สามารถเปลี่ยนสถานะที่นี่ได้");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const approver = approverId ? Number(approverId) : null;
  if (approverId && (!Number.isInteger(approver) || approver <= 0)) {
    const err = new Error("ข้อมูลผู้อนุมัติไม่ถูกต้อง");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  return prisma.teacherLeave.update({
    where: { id },
    data: {
      status: normalizedStatus,
      ownerApprovalStatus: normalizedStatus,
      ownerApprovalBy: approver,
      ownerApprovalAt: new Date(),
    },
    include: leaveRelationInclude,
  });
};

const ownerUpdateGeneralLeave = async ({ leaveId, status, approverId }) => {
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

  const existing = await prisma.teacherLeave.findUnique({
    where: { id },
    select: {
      id: true,
      isOfficialDuty: true,
      adminApprovalStatus: true,
    },
  });
  if (!existing) {
    const err = new Error("ไม่พบคำขอลา");
    err.code = "P2025";
    throw err;
  }
  if (existing.isOfficialDuty) {
    return ownerUpdateOfficialDutyLeave({ leaveId, status, approverId });
  }
  if (existing.adminApprovalStatus !== "APPROVED") {
    const err = new Error("ต้องผ่านการอนุมัติจากแอดมินก่อน");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const data = {
    ownerApprovalStatus: normalizedStatus,
    ownerApprovalBy: approverId ? Number(approverId) : null,
    ownerApprovalAt: new Date(),
    status: normalizedStatus === "PENDING" ? "PENDING" : normalizedStatus,
  };

  return prisma.teacherLeave.update({
    where: { id },
    data,
    include: leaveRelationInclude,
  });
};

const ownerUpdateOfficialDutyLeave = async ({ leaveId, status, approverId }) => {
  return updateOfficialDutyLeaveStatus({ leaveId, status, approverId });
};

const listCurrentApprovedLeaves = async ({ includeOfficial = false } = {}) => {
  const now = new Date();
  const whereBase = {
    status: "APPROVED",
    startDate: { lte: now },
    OR: [{ endDate: null }, { endDate: { gte: now } }],
  };
  const where = includeOfficial
    ? whereBase
    : applyGeneralLeaveFilter(whereBase);
  return prisma.teacherLeave.findMany({
    where,
    orderBy: { startDate: "asc" },
    include: leaveRelationInclude,
  });
};

const cancelLeaveByTeacher = async ({ leaveId, teacherId }) => {
  const id = Number(leaveId);
  const ownerId = Number(teacherId);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error("leaveId ไม่ถูกต้อง");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  if (!Number.isInteger(ownerId) || ownerId <= 0) {
    const err = new Error("teacherId ไม่ถูกต้อง");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const existing = await prisma.teacherLeave.findUnique({
    where: { id },
    select: {
      id: true,
      teacherId: true,
      status: true,
      isOfficialDuty: true,
      adminApprovalStatus: true,
      ownerApprovalStatus: true,
    },
  });
  if (!existing || existing.teacherId !== ownerId) {
    const err = new Error("ไม่พบคำขอลาหรือไม่มีสิทธิ์ยกเลิก");
    err.code = "P2025";
    throw err;
  }

  if (existing.status !== "PENDING") {
    const err = new Error("ไม่สามารถยกเลิกได้ คำขอถูกพิจารณาแล้ว");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  if (
    existing.adminApprovalStatus &&
    existing.adminApprovalStatus !== "PENDING"
  ) {
    const err = new Error("ไม่สามารถยกเลิกได้ คำขออยู่ระหว่างการอนุมัติ");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  if (
    existing.ownerApprovalStatus &&
    existing.ownerApprovalStatus !== "PENDING"
  ) {
    const err = new Error("ไม่สามารถยกเลิกได้ คำขอถูกพิจารณาแล้ว");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const isOfficial = existing.isOfficialDuty;
  const now = new Date();
  const data = {
    status: "CANCEL",
    // การยกเลิกโดยผู้ขอเอง ไม่ควรบันทึกว่าแอดมิน/ผู้บังคับบัญชาเป็นผู้ยกเลิก
    adminApprovalStatus: null,
    ownerApprovalStatus: null,
    adminApprovalBy: null,
    ownerApprovalBy: null,
    adminApprovalAt: null,
    ownerApprovalAt: null,
    // เก็บเวลาเพื่ออ้างอิง (ใช้ timestamp เดียวกับ status)
    updatedAt: now,
  };

  return prisma.teacherLeave.update({
    where: { id },
    data,
    include: leaveRelationInclude,
  });
};

module.exports = {
  createTeacherLeave,
  createOfficialDutyLeave,
  getTeacherLeaves,
  getAdminLeaveSummary,
  listTeacherLeaves,
  listOwnerGeneralLeaves,
  listOfficialDutyLeavesForOwner,
  updateTeacherLeaveStatus,
  ownerUpdateGeneralLeave,
  ownerUpdateOfficialDutyLeave,
  listCurrentApprovedLeaves,
  cancelLeaveByTeacher,
};
