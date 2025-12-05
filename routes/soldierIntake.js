const express = require("express");
const middleware = require("../middlewares/middleware");
const { idCardUploadOne, excelUploadOne } = require("../middlewares/upload");
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
  middleware.authorizeAdmin,
  soldierIntakeController.listIntakes
);

router.get(
  "/admin/soldier-intakes/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  soldierIntakeController.getIntakeById
);

router.put(
  "/admin/soldier-intakes/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  idCardUploadOne,
  soldierIntakeController.updateIntake
);

router.delete(
  "/admin/soldier-intakes/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  soldierIntakeController.deleteIntake
);

router.get(
  "/admin/soldier-intakes-summary",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  soldierIntakeController.summary
);

// Import/update unit assignment from Excel (ADMIN)
router.post(
  "/admin/soldier-intakes/import",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  excelUploadOne,
  soldierIntakeController.importUnitAssignments
);

module.exports = router;
