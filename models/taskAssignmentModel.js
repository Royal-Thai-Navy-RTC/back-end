const prisma = require("../utils/prisma");

const PRIORITY_SET = new Set(["HIGH", "MEDIUM", "LOW"]);
const CLOSED_STATUS_SET = new Set(["DONE", "CANCELLED", "CANCELED"]);
const STATUS_SET = new Set([
  "PENDING",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
  "CANCELED",
]);
const STATUS_ORDER = {
  PENDING: 0,
  IN_PROGRESS: 1,
  DONE: 2,
  CANCELLED: 3,
  CANCELED: 3,
};

const normalizeString = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : undefined;
};

const normalizeDate = (value, fieldLabel) => {
  if (!value) {
    const err = new Error(`ต้องระบุ ${fieldLabel}`);
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    const err = new Error(`รูปแบบวันที่ ${fieldLabel} ไม่ถูกต้อง`);
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return d;
};

const normalizePositiveInt = (value, fieldLabel) => {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    const err = new Error(`${fieldLabel} ต้องเป็นจำนวนเต็มบวก`);
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return num;
};

const normalizePriority = (value) => {
  if (!value) return "MEDIUM";
  const normalized = String(value).trim().toUpperCase();
  if (!PRIORITY_SET.has(normalized)) {
    const err = new Error("priority ต้องเป็น HIGH, MEDIUM หรือ LOW");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return normalized;
};

const computeDueDate = (startDate, dueDateInput, durationDays) => {
  if (dueDateInput) {
    return normalizeDate(dueDateInput, "dueDate");
  }
  if (durationDays !== undefined && durationDays !== null) {
    const d = new Date(startDate.getTime());
    d.setDate(d.getDate() + durationDays);
    return d;
  }
  const err = new Error("ต้องระบุระยะเวลา (durationDays) หรือกำหนด dueDate");
  err.code = "VALIDATION_ERROR";
  throw err;
};

const baseTaskInclude = {
  assignee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      rank: true,
      position: true,
      role: true,
    },
  },
  creator: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      position: true,
    },
  },
};

module.exports = {
  createTask: async (input = {}) => {
    const title = normalizeString(input.title);
    if (!title) {
      const err = new Error("ต้องระบุชื่องาน (title)");
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const assigneeId = Number(input.assigneeId);
    if (!Number.isInteger(assigneeId) || assigneeId <= 0) {
      const err = new Error("assigneeId ไม่ถูกต้อง");
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const creatorId = Number(input.createdById);
    if (!Number.isInteger(creatorId) || creatorId <= 0) {
      const err = new Error("ผู้มอบหมายไม่ถูกต้อง");
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const startDate = normalizeDate(input.startDate, "startDate");
    const durationDays = normalizePositiveInt(input.durationDays, "durationDays");
    const dueDate = computeDueDate(startDate, input.dueDate, durationDays);
    const priority = normalizePriority(input.priority);
    const status = normalizeString(input.status) || "PENDING";

    // ตรวจสอบว่า assignee มีอยู่จริง
    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true, isActive: true },
    });
    if (!assignee || assignee.isActive === false) {
      const err = new Error("ไม่พบผู้รับงานหรือถูกปิดการใช้งาน");
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    // ตรวจสอบ creator ด้วย
    const creatorExists = await prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true },
    });
    if (!creatorExists) {
      const err = new Error("ไม่พบผู้มอบหมายงาน");
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const data = {
      title,
      description: normalizeString(input.description),
      noteToAssignee: normalizeString(input.noteToAssignee),
      startDate,
      dueDate,
      durationDays,
      priority,
      status,
      assigneeId,
      createdById: creatorId,
    };

    return prisma.taskAssignment.create({
      data,
      include: baseTaskInclude,
    });
  },

  listTasks: async (filters = {}) => {
    const where = {};
    if (filters.assigneeId) {
      const id = Number(filters.assigneeId);
      if (Number.isInteger(id)) where.assigneeId = id;
    }
    if (filters.createdById) {
      const id = Number(filters.createdById);
      if (Number.isInteger(id)) where.createdById = id;
    }
    if (filters.status) {
      where.status = String(filters.status).trim();
    }
    if (filters.priority) {
      const normalized = normalizePriority(filters.priority);
      where.priority = normalized;
    }

    return prisma.taskAssignment.findMany({
      where,
      orderBy: { dueDate: "asc" },
      include: baseTaskInclude,
    });
  },

  countActiveTasksForAssignee: async (assigneeId) => {
    return prisma.taskAssignment.count({
      where: {
        assigneeId: Number(assigneeId),
    status: { notIn: Array.from(CLOSED_STATUS_SET) },
      },
    });
  },

  updateTaskStatus: async ({
    id,
    requesterId,
    requesterRole,
    status,
    submissionNote,
  } = {}) => {
    const taskId = Number(id);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      const err = new Error("taskId ไม่ถูกต้อง");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    const task = await prisma.taskAssignment.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        assigneeId: true,
        createdById: true,
        status: true,
        submittedAt: true,
      },
    });
    if (!task) {
      const err = new Error("ไม่พบน งานที่ต้องการอัปเดต");
      err.code = "NOT_FOUND";
      throw err;
    }
    const canManage =
      requesterRole === "OWNER" ||
      requesterRole === "ADMIN" ||
      requesterId === task.assigneeId;
    if (!canManage) {
      const err = new Error("ไม่มีสิทธิ์อัปเดตงานนี้");
      err.code = "FORBIDDEN";
      throw err;
    }

    const normalizedStatus = normalizeString(status);
    if (!normalizedStatus) {
      const err = new Error("ต้องระบุ status");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    const upperStatus = normalizedStatus.toUpperCase();
    if (!STATUS_SET.has(upperStatus)) {
      const err = new Error("status ต้องเป็น PENDING/IN_PROGRESS/DONE/CANCELLED");
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    if (CLOSED_STATUS_SET.has(task.status)) {
      const err = new Error("งานนี้ปิดแล้ว ไม่สามารถแก้ไขสถานะได้");
      err.code = "FORBIDDEN";
      throw err;
    }

    // ไม่ให้ย้อนกลับสถานะ (ยกเว้นยกเลิกได้ครั้งเดียว)
    const currentOrder = STATUS_ORDER[task.status] ?? -1;
    const nextOrder = STATUS_ORDER[upperStatus];
    if (
      upperStatus !== "CANCELLED" &&
      upperStatus !== "CANCELED" &&
      nextOrder < currentOrder
    ) {
      const err = new Error("ไม่สามารถย้อนกลับสถานะงานที่เดินหน้าแล้ว");
      err.code = "FORBIDDEN";
      throw err;
    }

    const normalizedSubmissionNote = normalizeString(submissionNote);
    const data = {
      status: upperStatus === "CANCELLED" ? "CANCELLED" : upperStatus,
      submissionNote: normalizedSubmissionNote,
    };
    if (upperStatus === "SUBMITTED" || upperStatus === "DONE") {
      data.submittedAt = task.submittedAt || new Date();
    }

    return prisma.taskAssignment.update({
      where: { id: taskId },
      data,
      include: baseTaskInclude,
    });
  },

  deleteTask: async (id) => {
    const taskId = Number(id);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      const err = new Error("taskId ไม่ถูกต้อง");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    const exists = await prisma.taskAssignment.findUnique({
      where: { id: taskId },
      select: { id: true },
    });
    if (!exists) {
      const err = new Error("ไม่พบงานที่ต้องการลบ");
      err.code = "NOT_FOUND";
      throw err;
    }
    await prisma.taskAssignment.delete({ where: { id: taskId } });
    return { id: taskId };
  },
};
