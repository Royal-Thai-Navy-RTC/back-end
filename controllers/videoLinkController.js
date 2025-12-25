const VideoLink = require("../models/videoLinkModel");

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

const listVideoLinks = async (req, res) => {
  try {
    const { includeInactive, platform } = req.query || {};
    const items = await VideoLink.listVideoLinks({ includeInactive, platform });
    res.json({ data: items });
  } catch (err) {
    handleError(err, res, "ไม่สามารถดึงรายการวิดีโอ");
  }
};

const createVideoLink = async (req, res) => {
  try {
    const item = await VideoLink.createVideoLink(req.body);
    res.status(201).json({ item });
  } catch (err) {
    handleError(err, res, "ไม่สามารถบันทึกวิดีโอ");
  }
};

const updateVideoLink = async (req, res) => {
  try {
    const item = await VideoLink.updateVideoLink(req.params.id, req.body);
    res.json({ item });
  } catch (err) {
    handleError(err, res, "ไม่สามารถแก้ไขวิดีโอ");
  }
};

const deleteVideoLink = async (req, res) => {
  try {
    const result = await VideoLink.deleteVideoLink(req.params.id);
    res.json({ message: "ลบวิดีโอสำเร็จ", deleted: result });
  } catch (err) {
    handleError(err, res, "ไม่สามารถลบวิดีโอ");
  }
};

module.exports = {
  listVideoLinks,
  createVideoLink,
  updateVideoLink,
  deleteVideoLink,
};
