const TeacherLeave = require("../../models/teacherLeaveModel");

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
};
