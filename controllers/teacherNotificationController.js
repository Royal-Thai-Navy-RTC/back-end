const prisma = require("../utils/prisma");

// ตั้งเวลาเป็นนาทีสำหรับเริ่มแจ้งเตือนก่อน/หลังคาบเรียน
const PRE_CLASS_LEAD_MINUTES = 60; // แจ้งเตือนส่งยอดก่อนเริ่มสอน 60 นาที
const POST_CLASS_LEAD_MINUTES = 30; // แจ้งเตือนประเมินก่อน/หลังจบคาบ 30 นาที
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

const ms = (minutes) => minutes * 60 * 1000;

// แปลงเวลา UTC -> key ของวันตามโซนเอเชีย/บางกอก (UTC+7)
const toBangkokDateKey = (date) => {
  const d = new Date(date);
  const bangkok = new Date(d.getTime() + BANGKOK_OFFSET_MS);
  return bangkok.toISOString().slice(0, 10); // YYYY-MM-DD
};

const isSameLocalDay = (a, b) => toBangkokDateKey(a) === toBangkokDateKey(b);

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
  dueAt,
  status = "unread",
}) => ({
  id,
  type,
  title,
  message,
  source,
  status, // เป็น reminder อัตโนมัติ ถ้ายังไม่ส่ง/ไม่ประเมิน
  dueAt,
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

const getTeacherNotifications = async (req, res) => {
  const teacherId = req.userId;
  const now = new Date();
  const todayRange = utcDayRange(now);

  try {
    const safeReadStatesPromise =
      prisma.notificationRead && prisma.notificationRead.findMany
        ? prisma.notificationRead.findMany({
            where: { userId: teacherId },
            select: { notificationId: true },
          })
        : Promise.resolve([]);

    const [schedules, reports, evaluations, readStates] = await Promise.all([
      prisma.teachingSchedule.findMany({
        where: {
          teacherId,
          // ดึงคาบที่ทับซ้อนกับวันนี้ (ตามเวลา UTC+7)
          start: { lt: todayRange.endUtc },
          end: { gte: todayRange.startUtc },
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
        },
      }),
      prisma.trainingReport.findMany({
        where: {
          teacherId,
          trainingDate: { gte: todayRange.startUtc, lt: todayRange.endUtc },
        },
        select: { id: true, trainingDate: true },
      }),
      prisma.studentEvaluation.findMany({
        where: {
          evaluatorId: teacherId,
          evaluationPeriod: { gte: todayRange.startUtc, lt: todayRange.endUtc },
        },
        select: { id: true, evaluationPeriod: true },
      }),
      safeReadStatesPromise,
    ]);

    const readSet = new Set(readStates.map((r) => r.notificationId));

    const notifications = [];

    for (const schedule of schedules) {
      const startTime = new Date(schedule.start);
      const endTime = new Date(schedule.end);
      const startLocal = new Date(startTime.getTime() + BANGKOK_OFFSET_MS);
      const endLocal = new Date(endTime.getTime() + BANGKOK_OFFSET_MS);

      const hasReport = reports.some((r) =>
        isSameLocalDay(r.trainingDate, startLocal)
      );
      if (
        !hasReport &&
        now.getTime() >= startTime.getTime() - ms(PRE_CLASS_LEAD_MINUTES)
      ) {
        notifications.push(
          buildNotification({
            id: `schedule-${schedule.id}-report-${toBangkokDateKey(startTime)}`,
            type: "TRAINING_REPORT_MISSING",
            title: "แจ้งเตือน: ยังไม่ส่งยอดนักเรียนประจำวัน",
            message: `กรุณาส่งยอดนักเรียนสำหรับคาบ "${schedule.title}"`,
            source: "ระบบแจ้งเตือน",
            schedule,
            dueAt: startLocal,
            status: readSet.has(
              `schedule-${schedule.id}-report-${toBangkokDateKey(startTime)}`
            )
              ? "read"
              : "unread",
          })
        );
      }

      const hasEvaluation = evaluations.some((e) =>
        isSameLocalDay(e.evaluationPeriod, endLocal)
      );
      if (
        !hasEvaluation &&
        now.getTime() >= endTime.getTime() - ms(POST_CLASS_LEAD_MINUTES)
      ) {
        notifications.push(
          buildNotification({
            id: `schedule-${schedule.id}-evaluation-${toBangkokDateKey(
              endTime
            )}`,
            type: "STUDENT_EVALUATION_MISSING",
            title: "เตือน: กรุณาประเมินนักเรียนหลังสอน",
            message: `กรุณาบันทึกผลประเมินนักเรียนสำหรับคาบ "${schedule.title}"`,
            source: "ระบบแจ้งเตือน",
            schedule,
            dueAt: endLocal,
            status: readSet.has(
              `schedule-${schedule.id}-evaluation-${toBangkokDateKey(endTime)}`
            )
              ? "read"
              : "unread",
          })
        );
      }
    }

    // เรียงใหม่: ตาม dueAt ล่าสุด -> เก่าสุด
    notifications.sort(
      (a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime()
    );

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.max(1, Math.min(Number(req.query.pageSize) || 10, 50));
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
    console.error("Failed to build teacher notifications", err);
    return res
      .status(500)
      .json({ message: "ไม่สามารถโหลดแจ้งเตือนได้", detail: err.message });
  }
};

const markTeacherNotificationsRead = async (req, res) => {
  const teacherId = req.userId;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!ids.length) {
    return res.status(400).json({ message: "ต้องระบุ ids เป็น array" });
  }
  const values = ids
    .filter((id) => typeof id === "string" && id.trim())
    .map((id) => ({
      userId: teacherId,
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
    console.error("Failed to mark notifications as read", err);
    return res.status(500).json({ message: "ไม่สามารถอัปเดตสถานะอ่านได้" });
  }
};

module.exports = {
  getTeacherNotifications,
  markTeacherNotificationsRead,
};
