const express = require("express");
const middleware = require("../middlewares/middleware");
const departmentHeadLeaveController = require("../controllers/departmentHeadLeaveController");

const router = express.Router();

router.get(
  "/department/official-duty-leaves",
  middleware.verifyToken,
  middleware.authorizeDepartmentHead,
  departmentHeadLeaveController.listOfficialDutyLeaves
);

router.patch(
  "/department/official-duty-leaves/:id/status",
  middleware.verifyToken,
  middleware.authorizeDepartmentHead,
  departmentHeadLeaveController.updateOfficialDutyLeaveStatus
);

module.exports = router;
