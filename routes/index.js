const express = require("express");

const authRoutes = require("./auth");
const userRoutes = require("./user");
const adminRoutes = require("./admin");
const teacherRoutes = require("./teacher");
const evaluationRoutes = require("./evaluation");
const ownerRoutes = require("./owner");
const studentEvaluationRoutes = require("./studentEvaluation");
const libraryRoutes = require("./library");
const soldierIntakeRoutes = require("./soldierIntake");

const router = express.Router();

// Mount route groups
router.use("/", authRoutes);
router.use("/", userRoutes);
router.use("/", adminRoutes);
router.use("/", teacherRoutes);
router.use("/", evaluationRoutes);
router.use("/", ownerRoutes);
router.use("/", studentEvaluationRoutes);
router.use("/", libraryRoutes);
router.use("/", soldierIntakeRoutes);

module.exports = router;

