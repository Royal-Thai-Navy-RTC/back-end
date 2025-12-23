const express = require("express");
const middleware = require("../middlewares/middleware");
const { idCardUploadOne, excelUploadOne } = require("../middlewares/upload");
const soldierIntakeController = require("../controllers/soldierIntakeController");

const router = express.Router();

// ตรวจสอบสถานะเปิด/ปิดฟอร์ม (public)
/**
 * =========================
 * Soldier Intake
 * =========================
 */

/**
 * @openapi
 * /api/public/soldier-intake/status:
 *   get:
 *     summary: Get public soldier intake form status
 *     tags: [Soldier Intake]
 *     security: []
 *     responses:
 *       200:
 *         description: Status returned
 */
router.get(
  "/public/soldier-intake/status",
  soldierIntakeController.getIntakePublicStatus
);

/**
 * @openapi
 * /api/soldier-intakes/shifts:
 *   get:
 *     summary: List available intake shifts (public)
 *     tags: [Soldier Intake]
 *     security: []
 *     responses:
 *       200:
 *         description: List of intake shifts
 */
router.get(
  "/soldier-intakes/shifts",
  soldierIntakeController.listIntakeShifts
);

// อัปเดตสถานะฟอร์ม (ADMIN)
/**
 * @openapi
 * /api/admin/soldier-intake/status:
 *   patch:
 *     summary: Update public soldier intake form status (admin)
 *     tags: [Soldier Intake]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  "/admin/soldier-intake/status",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  soldierIntakeController.setIntakePublicStatus
);

// รับข้อมูลทหารใหม่ (public form)
/**
 * @openapi
 * /api/soldier-intakes:
 *   post:
 *     summary: Submit soldier intake (public)
 *     tags: [Soldier Intake]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 description: ID card image (optional)
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Invalid input
 */
router.post(
  "/soldier-intakes",
  idCardUploadOne,
  soldierIntakeController.createIntake
);

// สำหรับแอดมินดูรายการ
/**
 * @openapi
 * /api/admin/soldier-intakes:
 *   get:
 *     summary: List soldier intakes (company/admin)
 *     tags: [Soldier Intake]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         required: false
 *         schema:
 *           type: integer
 *       - in: query
 *         name: intakeShift
 *         required: false
 *         schema:
 *           type: string
 *           example: "1/68"
 *         description: คัดกรองผลัด เช่น "1/68" (ถ้าใส่แค่เลขผลัดจะค้นตามผลัดทั้งหมด)
 *     responses:
 *       200:
 *         description: List returned
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/admin/soldier-intakes",
  middleware.verifyToken,
  middleware.authorizeSoldierData,
  soldierIntakeController.listIntakes
);

/**
 * @openapi
 * /api/admin/soldier-intakes/export:
 *   get:
 *     summary: Export soldier intakes as Excel
 *     tags: [Soldier Intake]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: intakeShift
 *         required: false
 *         schema:
 *           type: string
 *           example: "1/68"
 *         description: กรองผลัด เช่น "1/68" (ไม่ใส่จะส่งออกทั้งหมด)
 *     responses:
 *       200:
 *         description: Excel file
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/admin/soldier-intakes/export",
  middleware.verifyToken,
  middleware.authorizeSoldierData,
  soldierIntakeController.exportIntakes
);

/**
 * @openapi
 * /api/admin/soldier-intakes/export/pdf:
 *   get:
 *     summary: Export soldier intakes as PDF
 *     tags: [Soldier Intake]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: intakeShift
 *         required: false
 *         schema:
 *           type: string
 *           example: "1/68"
 *         description: กรองผลัด เช่น "1/68" (ไม่ใส่จะส่งออกทั้งหมด)
 *     responses:
 *       200:
 *         description: PDF file
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/admin/soldier-intakes/export/pdf",
  middleware.verifyToken,
  middleware.authorizeSoldierData,
  soldierIntakeController.exportIntakesPdf
);

/**
 * @openapi
 * /api/admin/soldier-intakes/export/pdf/person:
 *   get:
 *     summary: Export a soldier intake profile as PDF (by citizenId or unitCode)
 *     tags: [Soldier Intake]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: citizenId
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: unitCode
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF file
 *       400:
 *         description: Missing/invalid query
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.get(
  "/admin/soldier-intakes/export/pdf/person",
  middleware.verifyToken,
  middleware.authorizeSoldierData,
  soldierIntakeController.exportIntakePdfByCitizenId
);

/**
 * @openapi
 * /api/admin/soldier-intakes:
 *   delete:
 *     summary: Delete all soldier intakes (owner)
 *     tags: [Soldier Intake]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete(
  "/admin/soldier-intakes",
  middleware.verifyToken,
  middleware.authorizeOwner,
  soldierIntakeController.deleteAllIntakes
);

/**
 * @openapi
 * /api/admin/soldier-intakes/shifts:
 *   get:
 *     summary: List available intake shifts
 *     tags: [Soldier Intake]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of intake shifts
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/admin/soldier-intakes/shifts",
  middleware.verifyToken,
  middleware.authorizeSoldierData,
  soldierIntakeController.listIntakeShifts
);

/**
 * @openapi
 * /api/admin/soldier-intakes/{id}:
 *   get:
 *     summary: Get soldier intake by id
 *     tags: [Soldier Intake]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Record returned
 *       400:
 *         description: Invalid id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.get(
  "/admin/soldier-intakes/:id",
  middleware.verifyToken,
  middleware.authorizeSoldierData,
  soldierIntakeController.getIntakeById
);

/**
 * @openapi
 * /api/admin/soldier-intakes/{id}:
 *   put:
 *     summary: Update soldier intake by id
 *     tags: [Soldier Intake]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 description: ID card image (optional)
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.put(
  "/admin/soldier-intakes/:id",
  middleware.verifyToken,
  middleware.authorizeSoldierData,
  idCardUploadOne,
  soldierIntakeController.updateIntake
);

/**
 * @openapi
 * /api/admin/soldier-intakes/{id}:
 *   delete:
 *     summary: Delete soldier intake by id (owner)
 *     tags: [Soldier Intake]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted
 *       400:
 *         description: Invalid id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.delete(
  "/admin/soldier-intakes/:id",
  middleware.verifyToken,
  middleware.authorizeOwner,
  soldierIntakeController.deleteIntake
);

/**
 * @openapi
 * /api/admin/soldier-intakes-summary:
 *   get:
 *     summary: Soldier intake summary
 *     tags: [Soldier Intake]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Summary returned
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/admin/soldier-intakes-summary",
  middleware.verifyToken,
  middleware.authorizeSoldierData,
  soldierIntakeController.summary
);

// Import/update unit assignment from Excel (ADMIN)
/**
 * @openapi
 * /api/admin/soldier-intakes/import:
 *   post:
 *     summary: Import/update unit assignments from Excel (admin)
 *     tags: [Soldier Intake]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Imported
 *       400:
 *         description: Invalid file or data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  "/admin/soldier-intakes/import",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  excelUploadOne,
  soldierIntakeController.importUnitAssignments
);

module.exports = router;
