const prisma = require("../utils/prisma");

const normalizeKey = (key) =>
  typeof key === "string" ? key.trim().toUpperCase() : "";

const getBoolean = (value) => {
  if (typeof value === "boolean") return value;
  const t = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(t)) return true;
  if (["false", "0", "no", "n", "off"].includes(t)) return false;
  return null;
};

const getToggle = async (key, defaultEnabled = false) => {
  const k = normalizeKey(key);
  if (!k) return false;
  const flag = await prisma.featureToggle.findUnique({ where: { key: k } });
  if (flag) return !!flag.isEnabled;
  return !!defaultEnabled;
};

const setToggle = async (key, enabled, updatedById, description) => {
  const k = normalizeKey(key);
  if (!k) {
    const err = new Error("key ต้องไม่ว่าง");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  const isEnabled = !!enabled;
  return prisma.featureToggle.upsert({
    where: { key: k },
    update: { isEnabled, updatedById: updatedById || null, description },
    create: {
      key: k,
      isEnabled,
      updatedById: updatedById || null,
      description,
    },
  });
};

const soldierIntakeKey = "SOLDIER_INTAKE_PUBLIC";

module.exports = {
  getToggle,
  setToggle,
  getSoldierIntakeStatus: () => getToggle(soldierIntakeKey, true),
  setSoldierIntakeStatus: (enabled, updatedById) =>
    setToggle(soldierIntakeKey, enabled, updatedById, "เปิด/ปิดฟอร์มรับทหารใหม่"),
  getBoolean,
};
