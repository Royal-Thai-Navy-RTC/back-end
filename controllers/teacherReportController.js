// controllers/teacherReportController.js

const TrainingReport = require("../models/trainingReportModel");
const ExcelJS = require("exceljs");
const prisma = require("../utils/prisma");

// ชื่อวัน/เดือนแบบไทย
const thaiDays = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
];

const thaiMonths = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

function formatThaiDate(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";
  const dayName = thaiDays[d.getDay()];
  const date = d.getDate();
  const monthName = thaiMonths[d.getMonth()];
  const year = d.getFullYear() + 543;
  return `วัน ${dayName} ที่ ${date} ${monthName} ${year}`;
}

// คำนวณช่วงเวลา 0900-1100 จาก trainingTime + durationHours
function buildTimeRange(trainingTime, durationHours) {
  if (!trainingTime) return "";
  const [hStr, mStr] = trainingTime.split(":"); // "09:00"
  let h = parseInt(hStr || "0", 10);
  let m = parseInt(mStr || "0", 10);

  let totalMinutes = h * 60 + m + (Number(durationHours) || 0) * 60;
  let endH = Math.floor(totalMinutes / 60) % 24;
  let endM = totalMinutes % 60;

  const pad = (n) => (n < 10 ? "0" + n : "" + n);

  const startText = pad(h) + pad(m); // 09:00 -> "0900"
  const endText = pad(endH) + pad(endM); // 11:00 -> "1100"

  return `${startText}-${endText}`;
}

// helper ทำ start/end ของวันจาก string '2025-12-09'
function buildDateRange(startDate, endDate) {
  if (!startDate && !endDate) return undefined;

  const range = {};
  if (startDate) {
    range.gte = new Date(startDate + "T00:00:00");
  }
  if (endDate) {
    range.lte = new Date(endDate + "T23:59:59");
  }
  return range;
}

// ✅ ดึงข้อมูลด้วย Prisma แทน SQL ตรง ๆ (ใช้สำหรับ export Excel เท่านั้น)
async function findReports({ teacherId, startDate, endDate }) {
  const trainingDateRange = buildDateRange(startDate, endDate);

  const where = {
    ...(trainingDateRange ? { trainingDate: trainingDateRange } : {}),
  };

  const normalizedTeacherId = Number(teacherId);
  if (Number.isInteger(normalizedTeacherId) && normalizedTeacherId > 0) {
    where.teacherId = normalizedTeacherId;
  }

  const reports = await prisma.trainingReport.findMany({
    where,
    orderBy: [
      { trainingDate: "asc" },
      { trainingTime: "asc" },
      { id: "asc" }
    ],
    include: {
      teacher: {
        select: {
          firstName: true,
          lastName: true,
          username: true,
        },
      },
    },
  });

  return reports;
}

// ✅ สร้างไฟล์ Excel หน้าเหมือนตัวอย่าง
async function exportReportsToExcel({ startDate, endDate }) {
  const rows = await findReports({ startDate, endDate });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("รายงานการฝึก");

  // ---------- ตั้ง column ก่อน ----------
  sheet.columns = [
    { key: "colA", width: 4 }, // margin
    { key: "subject", width: 35 },
    { key: "time", width: 14 },
    { key: "unit", width: 16 },
    { key: "participantCount", width: 12 },
    { key: "instructorName", width: 20 },
    { key: "homeroomTeacher", width: 20 },
    { key: "notes", width: 22 },
  ];

  // เคลียร์ค่าเผื่อ ExcelJS แอบใส่อะไรใน row 1/2 ไว้
  sheet.getRow(1).values = [];
  sheet.getRow(2).values = [];

    // ---------- ส่วนหัวบน ----------
  let division = (rows[0]?.division || "").trim();

  // ถ้า division เป็น "หมายเหตุ" หรือว่าง ให้ถือว่าไม่มีหมวดวิชา
  if (!division || division === "หมายเหตุ") {
    division = "";
  }

  // const title = division ? `หมวดวิชา ${division}` : "";
  const title = "รายงานการส่งยอดของครูผู้สอน";
  let headerDate = null;
  if (startDate && endDate && startDate === endDate) {
    headerDate = startDate;
  } else if (startDate) {
    headerDate = startDate;
  } else if (rows[0]?.trainingDate) {
    headerDate = rows[0].trainingDate;
  }

  const thaiDate = headerDate ? formatThaiDate(headerDate) : "";

  sheet.mergeCells("A1:H1");
  sheet.mergeCells("A2:H2");

  sheet.getCell("A1").value = title;    // ถ้าไม่มี title จะเป็นค่าว่าง
  sheet.getCell("A2").value = thaiDate;

  sheet.getCell("A1").font = { name: "TH Sarabun New", size: 16, bold: true };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell("A2").font = { name: "TH Sarabun New", size: 16, bold: true };
  sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

  // ---------- หัวตาราง ----------
  const headerRowIndex = 4;

  const headerLabels = [
    "",
    "วิชา",
    "เวลา",
    "กองพัน/กองร้อย",
    "จำนวน นร.",
    "ครู กกฝ.",
    "ครูประจำ มว.วิชา",
    "หมายเหตุ",
  ];

  const headerRow = sheet.getRow(headerRowIndex);
  headerLabels.forEach((val, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = val;
  });

  headerRow.font = { name: "TH Sarabun New", size: 14, bold: true };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.height = 22;
  headerRow.eachCell((cell, colNumber) => {
    if (colNumber >= 2) {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }
  });

  // ---------- เติมข้อมูล ----------
  let currentRow = headerRowIndex + 1;

  rows.forEach((item) => {
    const timeRange = buildTimeRange(item.trainingTime, item.durationHours);
    const unitText = `${item.battalion || ""}/${item.company || ""}`;
    const teacherFullName = item.teacher
      ? `${item.teacher.firstName || ""} ${item.teacher.lastName || ""}`.trim()
      : "";
    const homeroomTeacher = teacherFullName || item.teacher?.username || "";

    const row = sheet.getRow(currentRow);

    row.getCell(1).value = ""; // margin
    row.getCell(2).value = item.subject || "";
    row.getCell(3).value = timeRange;
    row.getCell(4).value = unitText;
    row.getCell(5).value = item.participantCount ?? "";
    row.getCell(6).value = item.instructorName || "";
    row.getCell(7).value = homeroomTeacher;
    row.getCell(8).value = item.notes || "";

    row.font = { name: "TH Sarabun New", size: 14 };
    row.alignment = { vertical: "middle" };

    row.eachCell((cell, colNumber) => {
      if (colNumber >= 2) {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }
    });

    currentRow++;
  });

  // ---------- เติมแถวเปล่าให้ครบขั้นต่ำ 10 แถว ----------
  if (rows.length < 10) {
    const extra = 10 - rows.length;
    for (let i = 0; i < extra; i++) {
      const row = sheet.getRow(currentRow);

      for (let c = 1; c <= 8; c++) {
        row.getCell(c).value = "";
      }

      row.font = { name: "TH Sarabun New", size: 14 };
      row.alignment = { vertical: "middle" };
      row.eachCell((cell, colNumber) => {
        if (colNumber >= 2) {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        }
      });

      currentRow++;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}


// ---------- Controllers ----------

// บันทึกยอดนักเรียน / รายงานการฝึก
const submitTrainingReport = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      teacherId: req.userId,
    };
    const report = await TrainingReport.createTrainingReport(payload);
    res.status(201).json({
      message: "บันทึกยอดนักเรียนสำเร็จ",
      report,
    });
  } catch (err) {
    console.error("submitTrainingReport error:", err);
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({
      message: "Error submitting training report",
      detail: err.message,
    });
  }
};

// ดึงรายงานล่าสุดของครูคนนี้
const getRecentTrainingReports = async (req, res) => {
  try {
    const { limit } = req.query || {};
    const reports = await TrainingReport.getRecentReportsForTeacher({
      teacherId: req.userId,
      limit,
    });
    res.json({
      data: reports,
    });
  } catch (err) {
    console.error("getRecentTrainingReports error:", err);
    res.status(500).json({ message: "Error fetching training reports" });
  }
};

// export รายงานเป็น Excel
const exportTrainingReportsExcel = async (req, res) => {
  try {
    const { startDate, endDate } = req.query || {};

    const excelBuffer = await exportReportsToExcel({
      startDate,
      endDate,
    });

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="training_reports.xlsx"'
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.send(excelBuffer);
  } catch (err) {
    console.error("exportTrainingReportsExcel error:", err);
    res.status(500).json({
      message: "Error exporting training reports",
      detail: err.message,
    });
  }
};

module.exports = {
  submitTrainingReport,
  getRecentTrainingReports,
  exportTrainingReportsExcel,
};
