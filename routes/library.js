const express = require("express");
const middleware = require("../middlewares/middleware");
const { libraryUploadOne } = require("../middlewares/upload");
const libraryController = require("../controllers/libraryController");

const router = express.Router();

// Public listing
router.get("/library", libraryController.listLibraryItems);

// Admin/Owner only
router.post(
  "/library",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  libraryUploadOne,
  libraryController.createLibraryItem
);

router.put(
  "/library/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  libraryUploadOne,
  libraryController.updateLibraryItem
);

router.delete(
  "/library/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  libraryController.deleteLibraryItem
);

module.exports = router;
