const FeatureToggle = require("../models/featureToggleModel");

const getFrontCardStatus = async (_req, res) => {
  try {
    const enabled = await FeatureToggle.getFrontCardStatus();
    res.json({ enabled });
  } catch (err) {
    console.error("Failed to get front card status", err);
    res.status(500).json({ message: "ไม่สามารถดึงสถานะ card ได้" });
  }
};

const updateFrontCardStatus = async (req, res) => {
  try {
    const parsed = FeatureToggle.getBoolean(req.body?.enabled);
    if (parsed === null) {
      return res.status(400).json({ message: "enabled ต้องเป็น boolean" });
    }
    await FeatureToggle.setFrontCardStatus(parsed, req.userId);
    res.json({ enabled: parsed });
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    console.error("Failed to update front card status", err);
    res.status(500).json({ message: "ไม่สามารถอัปเดตสถานะ card ได้" });
  }
};

module.exports = {
  getFrontCardStatus,
  updateFrontCardStatus,
};
