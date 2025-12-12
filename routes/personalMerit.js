const express = require("express");
const middleware = require("../middlewares/middleware");
const { excelUploadOne } = require("../middlewares/upload");
const personalMeritController = require("../controllers/personalMeritController");

const router = express.Router();

router.post(
  "/personal-merit-scores/import",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  excelUploadOne,
  personalMeritController.importPersonalMeritScores
);

router.get(
  "/personal-merit-scores",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  personalMeritController.listPersonalMeritScores
);

router.delete(
  "/personal-merit-scores/:id",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  personalMeritController.deletePersonalMeritScoreById
);

router.delete(
  "/personal-merit-scores",
  middleware.verifyToken,
  middleware.authorizeExamAccess,
  personalMeritController.deleteAllPersonalMeritScores
);

module.exports = router;
