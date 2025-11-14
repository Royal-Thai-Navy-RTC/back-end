const TeacherLeave = require("../models/teacherLeaveModel");

const requestLeave = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      teacherId: req.userId,
      status: "PENDING",
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

const listMyLeaves = async (req, res) => {
  try {
    const { limit } = req.query || {};
    const leaves = await TeacherLeave.getTeacherLeaves({
      teacherId: req.userId,
      limit,
    });
    res.json({ data: leaves });
  } catch (err) {
    res.status(500).json({
      message: "ไม่สามารถดึงข้อมูลการลาได้",
    });
  }
};

module.exports = {
  requestLeave,
  listMyLeaves,
};
