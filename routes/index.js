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
const examRoutes = require("./exam");
const personalMeritRoutes = require("./personalMerit");
const physicalAssessmentRoutes = require("./physicalAssessment");
const newsRoutes = require("./news");

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
router.use("/", examRoutes);
router.use("/", personalMeritRoutes);
router.use("/", physicalAssessmentRoutes);
router.use("/", newsRoutes);

module.exports = router;

