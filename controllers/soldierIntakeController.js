const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const SoldierIntake = require("../models/soldierIntakeModel");
const FeatureToggle = require("../models/featureToggleModel");

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
    const isOpen = await FeatureToggle.getSoldierIntakeStatus();
    if (!isOpen) {
      deleteIfExists(uploaded?.path);
      return res.status(403).json({ message: "ปิดรับแบบฟอร์มแล้ว" });
    }
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

const mapRoleToUnitFilter = (role) => {
  if (!role || typeof role !== "string") return null;

  const match = /^BAT(\d+)_COM(\d+)$/.exec(role);
  if (!match) return null;

  return {
    battalionCode: String(Number(match[1])), 
    companyCode: String(Number(match[2])),   
  };
};

const listIntakes = async (req, res) => {
  try {
    // เอา query จาก client มาก่อน
    const filters = { ...(req.query || {}) };
    const unitFilter = mapRoleToUnitFilter(req.userRole);

    if (unitFilter) {
      filters.battalionCode = unitFilter.battalionCode;
      filters.companyCode = unitFilter.companyCode;
    }

    const result = await SoldierIntake.listIntakes(filters);
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

const summary = async (req, res) => {
  try {
    const data = await SoldierIntake.summary();
    res.json({ data });
  } catch (err) {
    console.error("Failed to summarize soldier intake", err);
    res.status(500).json({ message: "ไม่สามารถสรุปข้อมูลได้" });
  }
};

const getIntakePublicStatus = async (_req, res) => {
  try {
    const enabled = await FeatureToggle.getSoldierIntakeStatus();
    res.json({ enabled });
  } catch (err) {
    res.status(500).json({ message: "ไม่สามารถดึงสถานะได้" });
  }
};

const setIntakePublicStatus = async (req, res) => {
  try {
    const parsed = FeatureToggle.getBoolean(req.body?.enabled);
    if (parsed === null) {
      return res.status(400).json({ message: "enabled ต้องเป็น boolean" });
    }
    await FeatureToggle.setSoldierIntakeStatus(parsed, req.userId);
    res.json({ enabled: parsed });
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "ไม่สามารถอัปเดตสถานะได้" });
  }
};

const importUnitAssignments = async (req, res) => {
  const uploaded = req.file;
  if (!uploaded?.path) {
    return res.status(400).json({ message: "กรุณาอัปโหลดไฟล์ Excel" });
  }

  const cleanup = () => {
    try {
      if (fs.existsSync(uploaded.path)) {
        fs.unlinkSync(uploaded.path);
      }
    } catch {}
  };

  try {
    const workbook = XLSX.readFile(uploaded.path);
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      cleanup();
      return res.status(400).json({ message: "ไฟล์ไม่มีชีตข้อมูล" });
    }
    const sheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const normalizeNumber = (val) => {
      if (val === null || val === undefined || val === "") return undefined;
      const num = Number(val);
      return Number.isFinite(num) ? num : undefined;
    };
    const normalizeString = (val) => {
      if (val === null || val === undefined) return undefined;
      const text = String(val).trim();
      return text || undefined;
    };
    const normalizeCitizenId = (val) => {
      const text = typeof val === "string" || typeof val === "number" ? String(val) : "";
      const digits = text.replace(/\D/g, "").trim();
      return digits || undefined;
    };

    const records = rawRows.map((row) => ({
      battalionCode:
        normalizeNumber(row["กองพัน"]) ?? normalizeNumber(row["battalion"]) ?? normalizeString(row["กองพัน"]),
      companyCode:
        normalizeNumber(row["กองร้อย"]) ?? normalizeNumber(row["company"]) ?? normalizeString(row["กองร้อย"]),
      platoonCode:
        normalizeNumber(row["หมวด"]) ?? normalizeNumber(row["platoon"]) ?? normalizeString(row["หมวด"]),
      sequenceNumber:
        normalizeNumber(row["ลำดับ"]) ?? normalizeNumber(row["seq"]) ?? normalizeNumber(row["sequence"]),
      citizenId: normalizeCitizenId(row["เลขบัตรประชาชน"] ?? row["citizenId"]),
      firstName: normalizeString(row["ชื่อ"] ?? row["firstName"]),
      lastName: normalizeString(row["สกุล"] ?? row["lastName"]),
      registrationId: normalizeString(row["ทะเบียน"] ?? row["registration"]),
      birthDate: normalizeString(row["วันเกิด"] ?? row["birthDate"]),
    }));

    const filteredRecords = records.filter((r) => r.citizenId);
    if (!filteredRecords.length) {
      cleanup();
      return res.status(400).json({ message: "ไม่พบเลขบัตรประชาชนในไฟล์" });
    }

    const result = await SoldierIntake.importUnitAssignments(filteredRecords);
    cleanup();
    res.json({ message: "อัปเดตข้อมูลสำเร็จ", result });
  } catch (err) {
    cleanup();
    console.error("Failed to import soldier intake assignments", err);
    res
      .status(500)
      .json({ message: "ไม่สามารถนำเข้าไฟล์ได้", detail: err.message });
  }
};

module.exports = {
  createIntake,
  listIntakes,
  getIntakeById,
  updateIntake,
  deleteIntake,
  summary,
  getIntakePublicStatus,
  setIntakePublicStatus,
  importUnitAssignments,
};
