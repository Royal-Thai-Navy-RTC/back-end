const TeacherLeave = require("../models/teacherLeaveModel");

const listOfficialDutyLeaves = async (req, res) => {
  try {
    const { status, limit } = req.query || {};
    const data = await TeacherLeave.listOfficialDutyLeaves({ status, limit });
    res.json({ data });
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({
      message: "ไม่สามารถดึงข้อมูลลาไปราชการได้",
      detail: err.message,
    });
  }
};

const updateOfficialDutyLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const leave = await TeacherLeave.updateOfficialDutyLeaveStatus({
      leaveId: id,
      status,
      approverId: req.userId,
    });
    res.json({
      message: "อัปเดตสถานะลาไปราชการสำเร็จ",
      leave,
    });
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ message: "ไม่พบคำขอลาไปราชการ" });
    }
    res.status(500).json({
      message: "ไม่สามารถอัปเดตสถานะลาไปราชการได้",
      detail: err.message,
    });
  }
};

module.exports = {
  listOfficialDutyLeaves,
  updateOfficialDutyLeaveStatus,
};
