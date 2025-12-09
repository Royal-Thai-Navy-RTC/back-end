const prisma = require("../utils/prisma");

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

  const instructorName = input.instructorName
    ? String(input.instructorName).trim()
    : null;

  const normalized = {
    teacherId,
    subject: String(input.subject).trim(),
    participantCount: Math.round(participantCount),
    company: input.company ? String(input.company).trim() : null,
    battalion: input.battalion ? String(input.battalion).trim() : null,
    division: input.division ? String(input.division).trim() : null,
    trainingDate,
    trainingTime: input.trainingTime ? String(input.trainingTime).trim() : null,
    location: input.location ? String(input.location).trim() : null,
    durationHours,
    notes: input.notes ? String(input.notes).trim() : null,
    instructorName,
  };

  return normalized;
};

const bangkokDayRangeUtc = (date) => {
  const d = new Date(date);
  const offsetMs = 7 * 60 * 60 * 1000;
  const local = new Date(d.getTime() + offsetMs);
  const startLocal = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate()
  );
  const startUtc = new Date(startLocal - offsetMs);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc, endUtc };
};

const findScheduleForReport = async ({ teacherId, trainingDate, subject }) => {
  const { startUtc, endUtc } = bangkokDayRangeUtc(trainingDate);
  return prisma.teachingSchedule.findFirst({
    where: {
      teacherId: teacherId,
      start: { gte: startUtc, lt: endUtc },
      // MySQL collation is case-insensitive by default, so equals is enough
      title: { equals: subject },
    },
    select: {
      id: true,
      title: true,
      start: true,
      end: true,
    },
  });
};

const createTrainingReport = async (input) => {
  const data = validatePayload(input);
  const schedule = await findScheduleForReport(data);

  // ถ้ายังไม่ได้ระบุเวลา ให้ดึงเวลาจากตารางสอนเพื่อให้ข้อมูลสม่ำเสมอ
  if (!data.trainingTime && schedule?.start) {
    const start = new Date(schedule.start);
    const hh = String(start.getHours()).padStart(2, "0");
    const mm = String(start.getMinutes()).padStart(2, "0");
    data.trainingTime = `${hh}:${mm}`;
  }

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

const getAdminTrainingReportSummary = async ({ search } = {}) => {
  const totalReportsPromise = prisma.trainingReport.count();
  const participantSumPromise = prisma.trainingReport.aggregate({
    _sum: { participantCount: true },
  });
  const distinctRoundsPromise = prisma.trainingReport.findMany({
    distinct: ["trainingDate"],
    select: { trainingDate: true },
  });
  const lastReportPromise = prisma.trainingReport.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const teacherAggregatesPromise = prisma.trainingReport.groupBy({
    by: ["teacherId"],
    _count: { _all: true },
    _sum: { participantCount: true },
  });

  const [
    totalReports,
    participantSum,
    distinctRounds,
    lastReport,
    teacherAggregates,
  ] = await Promise.all([
    totalReportsPromise,
    participantSumPromise,
    distinctRoundsPromise,
    lastReportPromise,
    teacherAggregatesPromise,
  ]);

  const teacherIds = teacherAggregates.map((item) => item.teacherId);
  const latestReportsRaw = teacherIds.length
    ? await prisma.trainingReport.findMany({
        where: { teacherId: { in: teacherIds } },
        orderBy: [
          { teacherId: "asc" },
          { createdAt: "desc" },
        ],
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
      })
    : [];

  const latestByTeacher = new Map();
  for (const report of latestReportsRaw) {
    if (!latestByTeacher.has(report.teacherId)) {
      latestByTeacher.set(report.teacherId, report);
    }
  }

  let teacherStats = teacherAggregates.map((agg) => {
    const latest = latestByTeacher.get(agg.teacherId);
    const teacherName = latest?.teacher
      ? `${latest.teacher.firstName} ${latest.teacher.lastName}`
      : null;
    return {
      teacherId: agg.teacherId,
      teacherName,
      rank: latest?.teacher?.rank || null,
      position: latest?.teacher?.position || null,
      totalReports: agg._count._all,
      totalParticipants: agg._sum.participantCount || 0,
      company: latest?.company || null,
      battalion: latest?.battalion || null,
      division: latest?.division || null,
      latestSubject: latest?.subject || null,
      latestTrainingDate: latest?.trainingDate || null,
      latestReportAt: latest?.createdAt || null,
      instructorName: latest?.instructorName || null,
    };
  });

  const keyword = typeof search === "string" ? search.trim().toLowerCase() : "";
  if (keyword) {
    teacherStats = teacherStats.filter((stat) => {
      const haystack = [
        stat.teacherName,
        stat.company,
        stat.battalion,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }

  teacherStats.sort((a, b) => {
    const aTime = a.latestReportAt ? new Date(a.latestReportAt).getTime() : 0;
    const bTime = b.latestReportAt ? new Date(b.latestReportAt).getTime() : 0;
    return bTime - aTime;
  });

  const recentReportsRaw = await prisma.trainingReport.findMany({
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
  });

  const recentReports = recentReportsRaw.map((report) => ({
    id: report.id,
    teacherId: report.teacherId,
    teacherName: report.teacher
      ? `${report.teacher.firstName} ${report.teacher.lastName}`
      : null,
    rank: report.teacher?.rank || null,
    position: report.teacher?.position || null,
    subject: report.subject,
    participantCount: report.participantCount,
    company: report.company,
    battalion: report.battalion,
    division: report.division,
    trainingDate: report.trainingDate,
    trainingTime: report.trainingTime,
    location: report.location,
    durationHours: report.durationHours,
    notes: report.notes,
    createdAt: report.createdAt,
  }));

  return {
    overview: {
      totalReports,
      totalTrainingRounds: distinctRounds.length,
      totalParticipants: participantSum._sum.participantCount || 0,
      totalTeachersSubmitted: teacherAggregates.length,
      lastReportAt: lastReport?.createdAt || null,
    },
    teacherStats,
    recentReports,
  };
};

module.exports = {
  createTrainingReport,
  getRecentReportsForTeacher,
  getAdminTrainingReportSummary,
};
