const prisma = require("../utils/prisma");

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

const toBangkokDateKey = (date) => {
  const d = new Date(date);
  const bangkok = new Date(d.getTime() + BANGKOK_OFFSET_MS);
  return bangkok.toISOString().slice(0, 10); // YYYY-MM-DD
};

const utcDayRange = (date) => {
  const d = new Date(date);
  const startUtc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc, endUtc };
};

const toBangkokISOString = (date) => {
  if (!date) return null;
  const d = new Date(date);
  const shifted = new Date(d.getTime() + BANGKOK_OFFSET_MS);
  return shifted.toISOString().replace("Z", "+07:00");
};

const buildNotification = ({
  id,
  type,
  title,
  message,
  source,
  schedule,
  teacher,
  dueAt,
  status = "unread",
}) => ({
  id,
  type,
  title,
  message,
  source,
  status,
  dueAt,
  teacher: teacher
    ? {
        id: teacher.id || null,
        name:
          teacher.firstName && teacher.lastName
            ? `${teacher.firstName} ${teacher.lastName}`
            : teacher.name || null,
        rank: teacher.rank || null,
      }
    : null,
  schedule: schedule
    ? {
        id: schedule.id,
        title: schedule.title,
        start: schedule.start,
        end: schedule.end,
        location: schedule.location,
        companyCode: schedule.companyCode,
        battalionCode: schedule.battalionCode,
      }
    : null,
});

const getOwnerNotifications = async (req, res) => {
  const now = new Date();
  const todayRange = utcDayRange(now);

  try {
    const safeReadStatesPromise =
      prisma.notificationRead && prisma.notificationRead.findMany
        ? prisma.notificationRead.findMany({
            where: { userId: req.userId },
            select: { notificationId: true },
          })
        : Promise.resolve([]);

    const [schedules, reports, evaluations, readStates] = await Promise.all([
      prisma.teachingSchedule.findMany({
        where: {
          // ดึงคาบที่ทับซ้อนกับวันนี้ (ตามเวลา UTC+7)
          start: { lt: todayRange.endUtc },
          end: { gte: todayRange.startUtc },
          teacherId: { not: null },
        },
        orderBy: { start: "desc" },
        select: {
          id: true,
          title: true,
          location: true,
          companyCode: true,
          battalionCode: true,
          start: true,
          end: true,
          teacherId: true,
          teacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              rank: true,
            },
          },
        },
      }),
      prisma.trainingReport.findMany({
        where: {
          trainingDate: { gte: todayRange.startUtc, lt: todayRange.endUtc },
        },
        select: { id: true, teacherId: true, trainingDate: true },
      }),
      prisma.studentEvaluation.findMany({
        where: {
          evaluationPeriod: { gte: todayRange.startUtc, lt: todayRange.endUtc },
        },
        select: { id: true, evaluatorId: true, evaluationPeriod: true },
      }),
      safeReadStatesPromise,
    ]);

    const readSet = new Set(readStates.map((r) => r.notificationId));

    const reportIndex = new Set(
      reports.map(
        (r) => `${r.teacherId}-${toBangkokDateKey(r.trainingDate)}`
      )
    );
    const evalIndex = new Set(
      evaluations.map(
        (e) => `${e.evaluatorId}-${toBangkokDateKey(e.evaluationPeriod)}`
      )
    );

    const notifications = [];

    for (const schedule of schedules) {
      const { teacherId } = schedule;
      if (!teacherId) continue;
      const endTime = new Date(schedule.end);
      const endLocal = new Date(endTime.getTime() + BANGKOK_OFFSET_MS);
      if (now.getTime() < endTime.getTime()) {
        // แจ้งเจ้าของเฉพาะคาบที่จบไปแล้ว
        continue;
      }
      const dateKey = toBangkokDateKey(endLocal);
      const reportKey = `${teacherId}-${dateKey}`;
      const evalKey = `${teacherId}-${dateKey}`;

      if (!reportIndex.has(reportKey)) {
        notifications.push(
          buildNotification({
            id: `owner-report-${schedule.id}-${dateKey}`,
            type: "TRAINING_REPORT_MISSING",
            title: "ยังไม่ส่งยอดนักเรียนประจำวัน",
            message: `ครูยังไม่ส่งยอดนักเรียนสำหรับคาบ "${schedule.title}"`,
            source: "ระบบแจ้งเตือน",
            schedule,
            teacher: schedule.teacher || { id: teacherId },
            dueAt: endTime,
            status: readSet.has(`owner-report-${schedule.id}-${dateKey}`)
              ? "read"
              : "unread",
          })
        );
      }

      if (!evalIndex.has(evalKey)) {
        notifications.push(
          buildNotification({
            id: `owner-eval-${schedule.id}-${dateKey}`,
            type: "STUDENT_EVALUATION_MISSING",
            title: "ยังไม่ประเมินนักเรียนหลังสอน",
            message: `ครูยังไม่ได้บันทึกผลประเมินนักเรียนสำหรับคาบ "${schedule.title}"`,
            source: "ระบบแจ้งเตือน",
            schedule,
            teacher: schedule.teacher || { id: teacherId },
            dueAt: endTime,
            status: readSet.has(`owner-eval-${schedule.id}-${dateKey}`)
              ? "read"
              : "unread",
          })
        );
      }
    }

    notifications.sort(
      (a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime()
    );

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.max(1, Math.min(Number(req.query.pageSize) || 20, 100));
    const startIndex = (page - 1) * pageSize;
    const paged = notifications.slice(startIndex, startIndex + pageSize);

    return res.json({
      data: paged.map((n) => ({
        ...n,
        dueAt: toBangkokISOString(n.dueAt),
        schedule: n.schedule
          ? {
              ...n.schedule,
              start: toBangkokISOString(n.schedule.start),
              end: toBangkokISOString(n.schedule.end),
            }
          : null,
      })),
      page,
      pageSize,
      total: notifications.length,
      totalPages: Math.max(1, Math.ceil(notifications.length / pageSize)),
    });
  } catch (err) {
    console.error("Failed to build owner notifications", err);
    return res
      .status(500)
      .json({ message: "ไม่สามารถโหลดแจ้งเตือนผู้บังคับบัญชาได้", detail: err.message });
  }
};

const markOwnerNotificationsRead = async (req, res) => {
  const ownerId = req.userId;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!ids.length) {
    return res.status(400).json({ message: "ต้องระบุ ids เป็น array" });
  }
  const values = ids
    .filter((id) => typeof id === "string" && id.trim())
    .map((id) => ({
      userId: ownerId,
      notificationId: id.trim(),
      readAt: new Date(),
    }));
  if (!values.length) {
    return res.status(400).json({ message: "ids ไม่ถูกต้อง" });
  }
  try {
    await prisma.notificationRead.createMany({
      data: values,
      skipDuplicates: true,
    });
    return res.json({ message: "marked as read" });
  } catch (err) {
    console.error("Failed to mark owner notifications as read", err);
    return res.status(500).json({ message: "ไม่สามารถอัปเดตสถานะอ่านได้" });
  }
};

module.exports = {
  getOwnerNotifications,
  markOwnerNotificationsRead,
};
