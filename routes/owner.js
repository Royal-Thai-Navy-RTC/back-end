const express = require("express");
const middleware = require("../middlewares/middleware");
const ownerLeaveController = require("../controllers/ownerLeaveController");
const ownerNotificationController = require("../controllers/ownerNotificationController");

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

router.get(
  "/owner/notifications",
  middleware.verifyToken,
  middleware.authorizeOwner,
  ownerNotificationController.getOwnerNotifications
);

router.patch(
  "/owner/notifications/read",
  middleware.verifyToken,
  middleware.authorizeOwner,
  ownerNotificationController.markOwnerNotificationsRead
);

module.exports = router;
