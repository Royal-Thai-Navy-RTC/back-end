const express = require("express");
const middleware = require("../middlewares/middleware");
const ownerLeaveController = require("../controllers/ownerLeaveController");

const router = express.Router();

router.get(
  "/owner/teacher-leaves",
  middleware.verifyToken,
  middleware.authorizeOwner,
  ownerLeaveController.listGeneralLeaves
);

router.patch(
  "/owner/teacher-leaves/:id/status",
  middleware.verifyToken,
  middleware.authorizeOwner,
  ownerLeaveController.updateGeneralLeaveStatus
);

router.get(
  "/owner/official-duty-leaves",
  middleware.verifyToken,
  middleware.authorizeOwner,
  ownerLeaveController.listOfficialDutyLeaves
);

router.patch(
  "/owner/official-duty-leaves/:id/status",
  middleware.verifyToken,
  middleware.authorizeOwner,
  ownerLeaveController.updateOfficialDutyLeaveStatus
);

module.exports = router;
