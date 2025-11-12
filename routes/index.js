const express = require("express");

const authRoutes = require("./auth");
const userRoutes = require("./user");
const adminRoutes = require("./admin");

const router = express.Router();

// Mount route groups
router.use("/", authRoutes);
router.use("/", userRoutes);
router.use("/", adminRoutes);

module.exports = router;

