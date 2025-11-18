const TeacherLeave = require("../models/teacherLeaveModel");

const requestLeave = async (req, res) => {
  try {
    const leaveTypeRaw = (req.body?.leaveType || "").toString().trim().toUpperCase();
    if (leaveTypeRaw === "OFFICIAL_DUTY") {
      const payload = {
        ...req.body,
        teacherId: req.userId,
        status: "PENDING",
        leaveType: req.body?.leaveType || "OFFICIAL_DUTY",
        isOfficialDuty: true,
      };
      const leave = await TeacherLeave.createOfficialDutyLeave(payload);
      return res.status(201).json({
        message: "บันทึกคำขอลาไปราชการสำเร็จ",
        leave,
      });
    }

    const payload = {
      ...req.body,
      teacherId: req.userId,
      status: "PENDING",
      isOfficialDuty: false,
    };
    const leave = await TeacherLeave.createTeacherLeave(payload);
    res.status(201).json({
      message: "บันทึกการลาสำเร็จ",
      leave,
    });
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({
      message: "ไม่สามารถบันทึกการลาได้",
      detail: err.message,
    });
  }
};

const requestOfficialDutyLeave = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      teacherId: req.userId,
      status: "PENDING",
      leaveType: req.body?.leaveType || "OFFICIAL_DUTY",
      isOfficialDuty: true,
    };
    const leave = await TeacherLeave.createOfficialDutyLeave(payload);
    res.status(201).json({
      message: "บันทึกคำขอลาไปราชการสำเร็จ",
      leave,
    });
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({
      message: "ไม่สามารถบันทึกการลาไปราชการได้",
      detail: err.message,
    });
  }
};

const listMyLeaves = async (req, res) => {
  try {
    const { limit } = req.query || {};
    const leaves = await TeacherLeave.getTeacherLeaves({
      teacherId: req.userId,
      limit,
      officialDutyOnly: false,
    });
    res.json({ data: leaves });
  } catch (err) {
    res.status(500).json({
      message: "ไม่สามารถดึงข้อมูลการลาได้",
    });
  }
};

const listMyOfficialDutyLeaves = async (req, res) => {
  try {
    const { limit } = req.query || {};
    const leaves = await TeacherLeave.getTeacherLeaves({
      teacherId: req.userId,
      limit,
      officialDutyOnly: true,
    });
    res.json({ data: leaves });
  } catch (err) {
    res.status(500).json({
      message: "ไม่สามารถดึงข้อมูลลาไปราชการได้",
    });
  }
};

module.exports = {
  requestLeave,
  requestOfficialDutyLeave,
  listMyLeaves,
  listMyOfficialDutyLeaves,
};
