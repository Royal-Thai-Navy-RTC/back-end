const express = require("express");

const authRoutes = require("./auth");
const userRoutes = require("./user");
const adminRoutes = require("./admin");
const evaluationRoutes = require("./evaluation");

const router = express.Router();

// Mount route groups
router.use("/", authRoutes);
router.use("/", userRoutes);
router.use("/", adminRoutes);
router.use("/", evaluationRoutes);

module.exports = router;

