const express = require("express");
const middleware = require("../middlewares/middleware");
const { idCardUploadOne } = require("../middlewares/upload");
const soldierIntakeController = require("../controllers/soldierIntakeController");

const router = express.Router();

// ตรวจสอบสถานะเปิด/ปิดฟอร์ม (public)
router.get(
  "/public/soldier-intake/status",
  soldierIntakeController.getIntakePublicStatus
);

// อัปเดตสถานะฟอร์ม (ADMIN)
router.patch(
  "/admin/soldier-intake/status",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  soldierIntakeController.setIntakePublicStatus
);

// รับข้อมูลทหารใหม่ (public form)
router.post(
  "/soldier-intakes",
  idCardUploadOne,
  soldierIntakeController.createIntake
);

// สำหรับแอดมินดูรายการ
router.get(
  "/admin/soldier-intakes",
  middleware.verifyToken,
  middleware.authorizeSoldierData,
  soldierIntakeController.listIntakes
);

router.get(
  "/admin/soldier-intakes/:id",
  middleware.verifyToken,
  middleware.authorizeSoldierData,
  soldierIntakeController.getIntakeById
);

router.put(
  "/admin/soldier-intakes/:id",
  middleware.verifyToken,
  middleware.authorizeSoldierData,
  idCardUploadOne,
  soldierIntakeController.updateIntake
);

router.delete(
  "/admin/soldier-intakes/:id",
  middleware.verifyToken,
  middleware.authorizeSoldierData,
  soldierIntakeController.deleteIntake
);

router.get(
  "/admin/soldier-intakes-summary",
  middleware.verifyToken,
  middleware.authorizeSoldierData,
  soldierIntakeController.summary
);

module.exports = router;
