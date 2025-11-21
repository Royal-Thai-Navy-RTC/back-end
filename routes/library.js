const express = require("express");
const middleware = require("../middlewares/middleware");
const libraryController = require("../controllers/libraryController");

const router = express.Router();

// Public listing
router.get("/library", libraryController.listLibraryItems);

// Admin/Owner only
router.post(
  "/library",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  libraryController.createLibraryItem
);

router.put(
  "/library/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  libraryController.updateLibraryItem
);

router.delete(
  "/library/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  libraryController.deleteLibraryItem
);

module.exports = router;
