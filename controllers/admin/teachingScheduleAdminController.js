const Schedule = require("../../models/teachingScheduleModel");

const handleError = (err, res, actionMessage) => {
  if (err.code === "VALIDATION_ERROR") {
    return res.status(400).json({ message: err.message });
  }
  if (err.code === "NOT_FOUND") {
    return res.status(404).json({ message: err.message });
  }
  console.error(actionMessage, err);
  return res.status(500).json({ message: actionMessage, detail: err.message });
};

const createSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.createSchedule(req.body);
    res.status(201).json({ schedule });
  } catch (err) {
    handleError(err, res, "ไม่สามารถสร้างตารางสอนได้");
  }
};

const listSchedules = async (req, res) => {
  try {
    const { start, end, teacherId, page, pageSize } = req.query || {};
    const result = await Schedule.listSchedules({
      start,
      end,
      teacherId,
      page,
      pageSize,
    });
    res.json({
      data: result.items,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    });
  } catch (err) {
    handleError(err, res, "ไม่สามารถดึงตารางสอน");
  }
};

const updateSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.updateSchedule(req.params.id, req.body);
    res.json({ schedule });
  } catch (err) {
    handleError(err, res, "ไม่สามารถแก้ไขตารางสอน");
  }
};

const deleteSchedule = async (req, res) => {
  try {
    await Schedule.deleteSchedule(req.params.id);
    res.json({ message: "ลบตารางสอนสำเร็จ" });
  } catch (err) {
    handleError(err, res, "ไม่สามารถลบตารางสอน");
  }
};

module.exports = {
  createSchedule,
  listSchedules,
  updateSchedule,
  deleteSchedule,
};
