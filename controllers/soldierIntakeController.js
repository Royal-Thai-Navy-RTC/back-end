const fs = require("fs");
const path = require("path");
const SoldierIntake = require("../models/soldierIntakeModel");

const ID_CARD_PUBLIC_PREFIX = "/uploads/idcards";

const toPublicPath = (file) => {
  if (!file) return undefined;
  return `${ID_CARD_PUBLIC_PREFIX}/${file.filename}`.replace(/\\/g, "/");
};

const deleteIfExists = (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn("Failed to delete file:", filePath, err.message);
  }
};

const createIntake = async (req, res) => {
  const uploaded = req.file;
  try {
    const payload = { ...req.body, idCardImageUrl: toPublicPath(uploaded) };
    const created = await SoldierIntake.createIntake(payload);
    return res.status(201).json({ data: created });
  } catch (err) {
    deleteIfExists(uploaded?.path);
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "MIGRATION_REQUIRED") {
      return res.status(500).json({
        message: "ยังไม่ได้ setup ตาราง SoldierIntake (โปรดรัน prisma migrate/generate)",
      });
    }
    console.error("Failed to create soldier intake", err);
    return res
      .status(500)
      .json({ message: "ไม่สามารถบันทึกข้อมูลได้", detail: err.message });
  }
};

const listIntakes = async (req, res) => {
  try {
    const result = await SoldierIntake.listIntakes(req.query || {});
    res.json({
      data: result.items,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    });
  } catch (err) {
    console.error("Failed to list soldier intakes", err);
    res.status(500).json({ message: "ไม่สามารถดึงข้อมูลได้" });
  }
};

const getIntakeById = async (req, res) => {
  try {
    const record = await SoldierIntake.getIntakeById(req.params.id);
    res.json({ data: record });
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ message: err.message });
    }
    console.error("Failed to get soldier intake", err);
    res.status(500).json({ message: "ไม่สามารถดึงข้อมูลได้" });
  }
};

const updateIntake = async (req, res) => {
  const uploaded = req.file;
  try {
    const payload = { ...req.body };
    if (uploaded) {
      payload.idCardImageUrl = toPublicPath(uploaded);
    }
    const updated = await SoldierIntake.updateIntake(req.params.id, payload);
    res.json({ data: updated });
  } catch (err) {
    deleteIfExists(uploaded?.path);
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ message: err.message });
    }
    console.error("Failed to update soldier intake", err);
    res.status(500).json({ message: "ไม่สามารถแก้ไขข้อมูลได้" });
  }
};

const deleteIntake = async (req, res) => {
  try {
    await SoldierIntake.deleteIntake(req.params.id);
    res.status(204).send();
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ message: err.message });
    }
    console.error("Failed to delete soldier intake", err);
    res.status(500).json({ message: "ไม่สามารถลบข้อมูลได้" });
  }
};

module.exports = {
  createIntake,
  listIntakes,
  getIntakeById,
  updateIntake,
  deleteIntake,
};
