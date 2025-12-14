const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const SoldierIntake = require("../models/soldierIntakeModel");
const FeatureToggle = require("../models/featureToggleModel");
const { ChildProcess } = require("child_process");

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

const padTwo = (value) => String(value ?? "").padStart(2, "0");

const formatDateOnly = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(
    date.getDate()
  )}`;
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatDateOnly(date)} ${padTwo(date.getHours())}:${padTwo(
    date.getMinutes()
  )}:${padTwo(date.getSeconds())}`;
};

const formatListField = (value) => {
  if (Array.isArray(value)) {
    return value.filter((item) => item != null && item !== "").join(", ");
  }
  if (value === undefined || value === null) return "";
  return String(value);
};

const formatBooleanLabel = (value) => {
  if (value === true) return "ใช่";
  if (value === false) return "ไม่";
  return "";
};

const normalizePresenceFilter = (value) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return undefined;
  const positive = new Set(["yes", "y", "true", "1", "has", "มี"]);
  const negative = new Set(["no", "n", "false", "0", "none", "ไม่มี"]);
  if (positive.has(normalized)) return true;
  if (negative.has(normalized)) return false;
  return undefined;
};

const normalizeFilterString = (value) => {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => (item === undefined || item === null ? "" : String(item).trim()))
      .filter((item) => item);
    if (!normalized.length) return undefined;
    return normalized.join(", ");
  }
  const text = String(value).trim();
  return text || undefined;
};

const autoFitColumns = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const widths = headers.map((header) => Math.max(header.length, 8));
  rows.forEach((row) => {
    headers.forEach((header, idx) => {
      const cell = row[header];
      const length = cell != null ? String(cell).length : 0;
      if (length > widths[idx]) widths[idx] = length;
    });
  });
  return widths.map((width) => ({ wch: width + 2 }));
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
        message:
          "ยังไม่ได้ setup ตาราง SoldierIntake (โปรดรัน prisma migrate/generate)",
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
    const filters = { ...(req.query || {}) };
    const unitFilter = mapRoleToUnitFilter(req.userRole);

    const applyStringFilter = (queryKey, filterKey = queryKey) => {
      const value = normalizeFilterString(req.query[queryKey]);
      if (value) {
        filters[filterKey] = value;
      } else {
        delete filters[filterKey];
      }
      if (filterKey !== queryKey) {
        delete filters[queryKey];
      }
    };

    applyStringFilter("battalionCode");
    applyStringFilter("companyCode");
    applyStringFilter("provinceFilter", "province");
    applyStringFilter("educationFilter", "education");
    applyStringFilter("bloodFilter", "bloodGroup");

    const parsePositiveIntFilter = (value) => {
      if (value === undefined || value === null || value === "") return undefined;
      const num = Number(value);
      return Number.isInteger(num) && num > 0 ? num : undefined;
    };

    const parseFloatFilter = (value) => {
      if (value === undefined || value === null || value === "") return undefined;
      const num = Number(value);
      return Number.isFinite(num) ? num : undefined;
    };

    const serviceYearsValue = parseFloatFilter(req.query.serviceYears);
    if (serviceYearsValue !== undefined) {
      filters.serviceYears = serviceYearsValue;
    } else {
      delete filters.serviceYears;
    }
    const hasSpecialSkills = normalizePresenceFilter(
      req.query.specialSkillFilter
    );
    if (hasSpecialSkills !== undefined) {
      filters.hasSpecialSkills = hasSpecialSkills;
      delete filters.specialSkillFilter;
    } else {
      delete filters.hasSpecialSkills;
    }

    const hasChronicDiseases = normalizePresenceFilter(req.query.healthFilter);
    if (hasChronicDiseases !== undefined) {
      filters.hasChronicDiseases = hasChronicDiseases;
      delete filters.healthFilter;
    } else {
      delete filters.hasChronicDiseases;
    }

    const platoonCodeValue = parsePositiveIntFilter(req.query.platoonCode);
    if (platoonCodeValue !== undefined) {
      filters.platoonCode = platoonCodeValue;
    } else {
      delete filters.platoonCode;
    }

    const sequenceNumberValue = parsePositiveIntFilter(req.query.sequenceNumber);
    if (sequenceNumberValue !== undefined) {
      filters.sequenceNumber = sequenceNumberValue;
    } else {
      delete filters.sequenceNumber;
    }

    const normalizedReligion = normalizeFilterString(req.query.religionFilter);
    if (normalizedReligion === "อื่นๆ") {
      filters.religionOther = true;
      delete filters.religion;
    } else if (normalizedReligion) {
      filters.religion = normalizedReligion;
      delete filters.religionOther;
    } else {
      delete filters.religion;
      delete filters.religionOther;
    }

    if (unitFilter) {
      filters.battalionCode = unitFilter.battalionCode;
      filters.companyCode = unitFilter.companyCode;
    }

    const combatReadinessSort = filters.combatReadinessSort;
    delete filters.combatReadinessSort;

    const result = await SoldierIntake.listIntakes({
      ...filters,
      combatReadinessSort,
    });

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

const exportIntakes = async (req, res) => {
  try {
    const filters = { ...(req.query || {}) };
    const unitFilter = mapRoleToUnitFilter(req.userRole);

    if (unitFilter) {
      filters.battalionCode = unitFilter.battalionCode;
      filters.companyCode = unitFilter.companyCode;
    }

    const records = await SoldierIntake.getIntakesForExport(filters);
    if (!records.length) {
      return res
        .status(404)
        .json({ message: "ไม่พบข้อมูลทหารใหม่สำหรับส่งออก" });
    }

    const rows = records.map((item) => ({
      เลขบัตรประชาชน: item.citizenId || "",
      ชื่อ: item.firstName || "",
      นามสกุล: item.lastName || "",
      วันเกิด: formatDateOnly(item.birthDate),
      "น้ำหนัก (กก.)": item.weightKg ?? "",
      "ส่วนสูง (ซม.)": item.heightCm ?? "",
      "อายุราชการ (ปี)": item.serviceYears ?? "",
      กรุ๊ปเลือด: item.bloodGroup || "",
      กองพัน: item.battalionCode || "",
      กองร้อย: item.companyCode || "",
      หมวด: item.platoonCode ?? "",
      ลำดับ: item.sequenceNumber ?? "",
      การศึกษา: item.education || "",
      อาชีพก่อนเป็นทหาร: item.previousJob || "",
      ศาสนา: item.religion || "",
      ว่ายน้ำได้: formatBooleanLabel(item.canSwim),
      ทักษะพิเศษ: item.specialSkills || "",
      ที่อยู่: item.addressLine || "",
      จังหวัด: item.province || "",
      อำเภอ: item.district || "",
      ตำบล: item.subdistrict || "",
      รหัสไปรษณีย์: item.postalCode || "",
      อีเมล: item.email || "",
      เบอร์โทรศัพท์: item.phone || "",
      ผู้ติดต่อฉุกเฉิน: item.emergencyName || "",
      เบอร์ฉุกเฉิน: item.emergencyPhone || "",
      โรคประจำตัว: formatListField(item.chronicDiseases),
      แพ้อาหาร: formatListField(item.foodAllergies),
      แพ้ยา: formatListField(item.drugAllergies),
      หมายเหตุแพทย์: item.medicalNotes || "",
      เคยประสบอุบัติเหตุ: formatBooleanLabel(item.accidentHistory),
      เคยผ่าตัด: formatBooleanLabel(item.surgeryHistory),
      มีรอยสัก: formatBooleanLabel(item.tattoo),
      "ประสบการณ์ก่อนเป็นทหาร (ปี)": item.experienced ?? "",
      สถานะครอบครัว: item.familyStatus || "",
      ประกาศนียบัตร: formatListField(item.certificates),
      "รูปบัตรประชาชน (URL)": item.idCardImageUrl || "",
      คะแนนความพร้อมรบ: item.combatReadiness?.score ?? "",
      เปอร์เซ็นต์ความพร้อมรบ: item.combatReadiness?.percent ?? "",
      สร้างเมื่อ: formatDateTime(item.createdAt),
      อัปเดตล่าสุด: formatDateTime(item.updatedAt),
    }));

    const workbook = XLSX.utils.book_new();
    const sheetName = "ทหารใหม่".slice(0, 31);
    const worksheet =
      rows.length > 0
        ? XLSX.utils.json_to_sheet(rows)
        : XLSX.utils.aoa_to_sheet([["ไม่มีข้อมูล"]]);
    if (rows.length > 0) {
      worksheet["!cols"] = autoFitColumns(rows);
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="soldier-intakes.xlsx"'
    );
    return res.send(buffer);
  } catch (err) {
    console.error("Failed to export soldier intakes", err);
    return res
      .status(500)
      .json({ message: "ไม่สามารถส่งออกข้อมูลได้", detail: err.message });
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

const deleteAllIntakes = async (_req, res) => {
  try {
    const result = await SoldierIntake.deleteAllIntakes();
    res.json({ deleted: result.deleted });
  } catch (err) {
    console.error("Failed to delete soldier intakes", err);
    res.status(500).json({ message: "ไม่สามารถลบข้อมูลได้" });
  }
};

const summary = async (req, res) => {
  try {
    const filters = { ...(req.query || {}) };
    const unitFilter = mapRoleToUnitFilter(req.userRole);

    if (unitFilter) {
      filters.battalionCode = unitFilter.battalionCode;
      filters.companyCode = unitFilter.companyCode;
    }
    const data = await SoldierIntake.summary(
      filters.battalionCode,
      filters.companyCode
    );
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
      const text =
        typeof val === "string" || typeof val === "number" ? String(val) : "";
      const digits = text.replace(/\D/g, "").trim();
      return digits || undefined;
    };

    const records = rawRows.map((row) => ({
      battalionCode:
        normalizeNumber(row["กองพัน"]) ??
        normalizeNumber(row["battalion"]) ??
        normalizeString(row["กองพัน"]),
      companyCode:
        normalizeNumber(row["กองร้อย"]) ??
        normalizeNumber(row["company"]) ??
        normalizeString(row["กองร้อย"]),
      platoonCode:
        normalizeNumber(row["หมวด"]) ??
        normalizeNumber(row["platoon"]) ??
        normalizeString(row["หมวด"]),
      sequenceNumber:
        normalizeNumber(row["ลำดับ"]) ??
        normalizeNumber(row["seq"]) ??
        normalizeNumber(row["sequence"]),
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
  exportIntakes,
  getIntakeById,
  updateIntake,
  deleteIntake,
  summary,
  getIntakePublicStatus,
  setIntakePublicStatus,
  importUnitAssignments,
  deleteAllIntakes,
};
