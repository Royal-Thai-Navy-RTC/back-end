const TeacherLeave = require("../../models/teacherLeaveModel");
const ExcelJS = require("exceljs");

const STATUS_LABEL = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติ",
  REJECTED: "ไม่อนุมัติ",
  CANCEL: "ยกเลิก",
};

const LEAVE_TYPE_LABEL = {
  SICK: "ลาป่วย",
  PERSONAL: "ลากิจ",
  VACATION: "ลาพักผ่อน",
  OFFICIAL_DUTY: "ไปราชการ",
  OTHER: "อื่นๆ",
};

const RANK_LABEL = {
  ADMIRAL: "พลเรือเอก",
  ADMIRAL_FEMALE: "พลเรือเอกหญิง",
  VICE_ADMIRAL: "พลเรือโท",
  VICE_ADMIRAL_FEMALE: "พลเรือโทหญิง",
  REAR_ADMIRAL: "พลเรือตรี",
  REAR_ADMIRAL_FEMALE: "พลเรือตรีหญิง",
  CAPTAIN: "นาวาเอก",
  CAPTAIN_FEMALE: "นาวาเอกหญิง",
  COMMANDER: "นาวาโท",
  COMMANDER_FEMALE: "นาวาโทหญิง",
  LIEUTENANT_COMMANDER: "นาวาตรี",
  LIEUTENANT_COMMANDER_FEMALE: "นาวาตรีหญิง",
  LIEUTENANT: "เรือเอก",
  LIEUTENANT_FEMALE: "เรือเอกหญิง",
  SUB_LIEUTENANT: "เรือโท",
  SUB_LIEUTENANT_FEMALE: "เรือโทหญิง",
  ENSIGN: "เรือตรี",
  ENSIGN_FEMALE: "เรือตรีหญิง",
  PETTY_OFFICER_1: "พันจ่าเอก",
  PETTY_OFFICER_1_FEMALE: "พันจ่าเอกหญิง",
  PETTY_OFFICER_2: "พันจ่าโท",
  PETTY_OFFICER_2_FEMALE: "พันจ่าโทหญิง",
  PETTY_OFFICER_3: "พันจ่าตรี",
  PETTY_OFFICER_3_FEMALE: "พันจ่าตรีหญิง",
  LIEUTENANT_COLONEL: "พันโท",
  LIEUTENANT_COLONEL_FEMALE: "พันโทหญิง",
  MAJOR: "พันตรี",
  MAJOR_FEMALE: "พันตรีหญิง",
  PETTY_OFFICER: "จ่าเอก",
  PETTY_OFFICER_FEMALE: "จ่าเอกหญิง",
  LEADING_RATING: "จ่าโท",
  LEADING_RATING_FEMALE: "จ่าโทหญิง",
  ABLE_SEAMAN: "จ่าตรี",
  ABLE_SEAMAN_FEMALE: "จ่าตรีหญิง",
  COMPANY: "กองร้อย",
  SEAMAN_RECRUIT: "พลฯ",
};

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const buildApproverName = (user) => {
  if (!user) return "";
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  if (name) return name;
  return user.role || "";
};

const toStatusLabel = (status) => {
  if (!status) return "";
  const normalized = String(status).trim().toUpperCase();
  return STATUS_LABEL[normalized] || normalized;
};

const toLeaveTypeLabel = (leaveType, isOfficialDuty) => {
  const normalized = String(leaveType || "")
    .trim()
    .toUpperCase();
  if (isOfficialDuty) return LEAVE_TYPE_LABEL.OFFICIAL_DUTY;
  return LEAVE_TYPE_LABEL[normalized] || leaveType || "";
};

const toRankLabel = (rank) => {
  if (!rank) return "";
  const normalized = String(rank).trim().toUpperCase();
  return RANK_LABEL[normalized] || rank;
};

const requireSubAdminDivision = (req, res) => {
  if (req.userRole !== "SUB_ADMIN") return undefined;
  const division =
    typeof req.userDivision === "string" ? req.userDivision.trim() : "";
  if (!division) {
    res.status(403).json({
      message: "SUB_ADMIN ต้องมี division (หมวดวิชา) จึงจะดูข้อมูลได้",
    });
    return null;
  }
  return division;
};

const getTeacherLeaveSummary = async (req, res) => {
  try {
    const division = requireSubAdminDivision(req, res);
    if (division === null) return;
    const summary = await TeacherLeave.getAdminLeaveSummary({ division });
    res.json(summary);
  } catch (err) {
    res.status(500).json({
      message: "ไม่สามารถโหลดข้อมูลบัญชีพลได้",
      detail: err.message,
    });
  }
};

const listTeacherLeaves = async (req, res) => {
  try {
    const { status, adminStatus, limit, includeOfficial } = req.query || {};
    const division = requireSubAdminDivision(req, res);
    if (division === null) return;
    const data = await TeacherLeave.listTeacherLeaves({
      status,
      adminStatus,
      limit,
      division,
      includeOfficial:
        includeOfficial === undefined ? true : includeOfficial === "true",
    });
    res.json({ data });
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({
      message: "ไม่สามารถดึงข้อมูลการลาได้",
      detail: err.message,
    });
  }
};

const updateTeacherLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const division = requireSubAdminDivision(req, res);
    if (division === null) return;
    const isOwner = req.userRole === "OWNER";
    const leave = isOwner
      ? await TeacherLeave.ownerUpdateGeneralLeave({
          leaveId: id,
          status,
          approverId: req.userId,
        })
      : await TeacherLeave.updateTeacherLeaveStatus({
          leaveId: id,
          status,
          approverId: req.userId,
          division,
        });
    res.json({
      message: "อัปเดตสถานะการลาสำเร็จ",
      leave,
    });
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ message: "ไม่พบคำขอลา" });
    }
    res.status(500).json({
      message: "ไม่สามารถอัปเดตสถานะการลาได้",
      detail: err.message,
    });
  }
};

const exportTeacherLeaveHistory = async (req, res) => {
  try {
    const { year: yearParam } = req.query || {};
    const normalizedYear =
      typeof yearParam === "string" ? yearParam.trim() : yearParam;
    const targetYear =
      normalizedYear === undefined ||
      normalizedYear === null ||
      normalizedYear === ""
        ? new Date().getFullYear()
        : Number(normalizedYear);
    if (
      !Number.isInteger(targetYear) ||
      targetYear < 2000 ||
      targetYear > 2600
    ) {
      return res.status(400).json({ message: "ปีไม่ถูกต้อง" });
    }

    const division = requireSubAdminDivision(req, res);
    if (division === null) return;

    const leaves = await TeacherLeave.listLeavesByYear({
      year: targetYear,
      division,
      includeOfficial: true,
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Leave-${targetYear}`);
    sheet.columns = [
      { header: "ลำดับ", key: "index", width: 6 },
      { header: "ชื่อ-สกุล", key: "teacherName", width: 22 },
      { header: "หมวดวิชา", key: "division", width: 15 },
      { header: "ประเภทการลา", key: "leaveType", width: 16 },
      { header: "ไปราชการ", key: "officialDuty", width: 10 },
      { header: "ปลายทาง/สถานที่", key: "destination", width: 20 },
      { header: "เหตุผล", key: "reason", width: 26 },
      { header: "วันที่เริ่ม", key: "startDate", width: 14 },
      { header: "วันที่สิ้นสุด", key: "endDate", width: 14 },
      { header: "สถานะ", key: "status", width: 12 },
      { header: "สถานะแอดมิน", key: "adminStatus", width: 14 },
      { header: "สถานะผู้บังคับบัญชา", key: "ownerStatus", width: 18 },
      { header: "อนุมัติโดย(แอดมิน)", key: "adminApprover", width: 18 },
      { header: "อนุมัติโดย(ผู้บังคับบัญชา)", key: "ownerApprover", width: 22 },
      { header: "วันที่สร้าง", key: "createdAt", width: 16 },
    ];
    sheet.getRow(1).font = { bold: true };

    leaves.forEach((leave, idx) => {
      const teacherName = leave.teacher
        ? `${leave.teacher.firstName || ""} ${
            leave.teacher.lastName || ""
          }`.trim()
        : "";
      const full_name = leave.teacher?.rank
        ? `${toRankLabel(leave.teacher.rank)} ${teacherName}`.trim()
        : teacherName;

      sheet.addRow({
        index: idx + 1,
        teacherName : full_name || "",
        division: leave.teacher?.division || "",
        leaveType: toLeaveTypeLabel(leave.leaveType, leave.isOfficialDuty),
        officialDuty: leave.isOfficialDuty ? "ไปราชการ" : "-",
        destination: leave.destination || "",
        reason: leave.reason || "",
        startDate: formatDate(leave.startDate),
        endDate: formatDate(leave.endDate),
        status: toStatusLabel(leave.status),
        adminStatus: toStatusLabel(leave.adminApprovalStatus),
        ownerStatus: toStatusLabel(leave.ownerApprovalStatus),
        adminApprover: buildApproverName(leave.adminApprover),
        ownerApprover: buildApproverName(leave.ownerApprover),
        createdAt: formatDate(leave.createdAt),
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="teacher_leaves_${targetYear}.xlsx"`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.send(buffer);
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({
      message: "ไม่สามารถส่งออกข้อมูลการลาได้",
      detail: err.message,
    });
  }
};

module.exports = {
  getTeacherLeaveSummary,
  listTeacherLeaves,
  updateTeacherLeaveStatus,
  listCurrentLeaves: async (_req, res) => {
    try {
      const division = requireSubAdminDivision(_req, res);
      if (division === null) return;
      const data = await TeacherLeave.listCurrentApprovedLeaves({
        includeOfficial: true,
        division,
      });
      res.json({ data });
    } catch (err) {
      res.status(500).json({
        message: "ไม่สามารถดึงข้อมูลการลาปัจจุบันได้",
        detail: err.message,
      });
    }
  },
  exportTeacherLeaveHistory,
};
