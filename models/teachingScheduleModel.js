const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const normalizeString = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : undefined;
};

const parseDate = (value, field) => {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      const err = new Error(`รูปแบบวันที่ ${field} ไม่ถูกต้อง`);
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    return value;
  }

  const raw = String(value).trim();
  // บังคับตีความเวลาเป็น UTC+7 เสมอ (Asia/Bangkok) โดยใช้เวลาตามที่ส่งมาเป็นเวลาท้องถิ่น+7
  const m = raw.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)([+-]\d{2}:?\d{2}|Z)?$/
  );
  const withUtcPlus7 = m ? `${m[1]}+07:00` : raw;

  const d = new Date(withUtcPlus7);
  if (Number.isNaN(d.getTime())) {
    const err = new Error(`รูปแบบวันที่ ${field} ไม่ถูกต้อง`);
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return d;
};

const validateRange = (start, end) => {
  if (start && end && end.getTime() < start.getTime()) {
    const err = new Error("end ต้องไม่ก่อน start");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
};

const normalizeColor = (value) => {
  const DEFAULT_COLOR = "#1E90FF"; // น้ำเงิน (Dodger Blue)
  if (value === undefined || value === null || value === "") {
    return DEFAULT_COLOR;
  }
  const raw = String(value).trim();
  if (!raw) return DEFAULT_COLOR;
  const prefixed = raw.startsWith("#") ? raw : `#${raw}`;
  if (!/^#[0-9A-F]{3}$/i.test(prefixed) && !/^#[0-9A-F]{6}$/i.test(prefixed)) {
    const err = new Error("รูปแบบสีไม่ถูกต้อง (คาดหวัง hex เช่น #1E90FF)");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  // ยูนิฟายเป็นรูปแบบ #RRGGBB
  if (/^#[0-9A-F]{3}$/i.test(prefixed)) {
    const h = prefixed.replace("#", "");
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toUpperCase();
  }
  return prefixed.toUpperCase();
};

const baseSelect = {
  id: true,
  title: true,
  description: true,
  location: true,
  companyCode: true,
  battalionCode: true,
  color: true,
  start: true,
  end: true,
  allDay: true,
  teacherId: true,
  teacher: {
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  },
  createdAt: true,
  updatedAt: true,
};

const ensureTeacherExists = async (teacherId) => {
  if (teacherId === undefined || teacherId === null) return;
  const teacher = await prisma.user.findUnique({
    where: { id: Number(teacherId) },
    select: { id: true, role: true },
  });
  if (!teacher) {
    const err = new Error("ไม่พบผู้สอน (teacherId)");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  if (teacher.role !== "TEACHER") {
    const err = new Error("teacherId ต้องเป็นผู้ใช้ที่มีบทบาท TEACHER");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
};

const normalizeInput = (input = {}) => {
  const title = normalizeString(input.title);
  if (!title) {
    const err = new Error("ต้องระบุชื่อกิจกรรม (title)");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  const start = parseDate(input.start, "start");
  const end = parseDate(
    input.end !== undefined ? input.end : input.start,
    "end"
  );
  validateRange(start, end);

  const companyCode = normalizeString(input.companyCode);
  const battalionCode = normalizeString(input.battalionCode);
  const color = normalizeColor(input.color);

  const teacherId =
    input.teacherId !== undefined && input.teacherId !== null
      ? Number(input.teacherId)
      : undefined;

  return {
    title,
    description: normalizeString(input.description),
    location: normalizeString(input.location),
    companyCode: companyCode ? companyCode.toUpperCase() : null,
    battalionCode: battalionCode ? battalionCode.toUpperCase() : null,
    color,
    start,
    end,
    allDay: Boolean(input.allDay),
    teacherId: Number.isInteger(teacherId) ? teacherId : null,
  };
};

module.exports = {
  createSchedule: async (input = {}) => {
    const data = normalizeInput(input);
    await ensureTeacherExists(data.teacherId);
    return prisma.teachingSchedule.create({
      data,
      select: baseSelect,
    });
  },

  listSchedules: async (filters = {}) => {
    const where = {};
    if (filters.teacherId) {
      where.teacherId = Number(filters.teacherId);
    }
    if (filters.start || filters.end) {
      where.AND = [];
      if (filters.start) {
        const start = parseDate(filters.start, "start");
        where.AND.push({ end: { gte: start } });
      }
      if (filters.end) {
        const end = parseDate(filters.end, "end");
        where.AND.push({ start: { lte: end } });
      }
    }
    const pageSize = Math.max(1, Math.min(Number(filters.pageSize) || 50, 200));
    const page = Math.max(1, Number(filters.page) || 1);
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.teachingSchedule.findMany({
        where,
        orderBy: [{ start: "asc" }, { end: "asc" }],
        skip,
        take: pageSize,
        select: baseSelect,
      }),
      prisma.teachingSchedule.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  updateSchedule: async (id, input = {}) => {
    const targetId = Number(id);
    if (!Number.isInteger(targetId)) {
      const err = new Error("id ต้องเป็นจำนวนเต็ม");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    const existing = await prisma.teachingSchedule.findUnique({
      where: { id: targetId },
    });
    if (!existing) {
      const err = new Error("ไม่พบตารางสอน");
      err.code = "NOT_FOUND";
      throw err;
    }

    // ใช้ normalize แต่ให้ฟิลด์ไม่ส่งมาได้
    const data = {};
    if (input.title !== undefined) data.title = normalizeString(input.title);
    if (input.description !== undefined)
      data.description = normalizeString(input.description) || null;
    if (input.location !== undefined)
      data.location = normalizeString(input.location) || null;
    if (input.companyCode !== undefined) {
      const val = normalizeString(input.companyCode);
      data.companyCode = val ? val.toUpperCase() : null;
    }
    if (input.battalionCode !== undefined) {
      const val = normalizeString(input.battalionCode);
      data.battalionCode = val ? val.toUpperCase() : null;
    }
    if (input.color !== undefined) {
      data.color = normalizeColor(input.color);
    }
    if (input.allDay !== undefined) data.allDay = Boolean(input.allDay);
    if (input.teacherId !== undefined) {
      const teacherId = Number(input.teacherId);
      data.teacherId = Number.isInteger(teacherId) ? teacherId : null;
    }
    if (input.start !== undefined)
      data.start = parseDate(input.start, "start");
    if (input.end !== undefined) data.end = parseDate(input.end, "end");

    validateRange(
      data.start || existing.start,
      data.end || existing.end || data.start || existing.start
    );

    if (data.teacherId !== undefined) {
      await ensureTeacherExists(data.teacherId);
    }

    return prisma.teachingSchedule.update({
      where: { id: targetId },
      data,
      select: baseSelect,
    });
  },

  deleteSchedule: async (id) => {
    const targetId = Number(id);
    if (!Number.isInteger(targetId)) {
      const err = new Error("id ต้องเป็นจำนวนเต็ม");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    return prisma.teachingSchedule.delete({
      where: { id: targetId },
      select: { id: true },
    });
  },
};
