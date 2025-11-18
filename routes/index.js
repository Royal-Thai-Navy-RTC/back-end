const express = require("express");

const authRoutes = require("./auth");
const userRoutes = require("./user");
const adminRoutes = require("./admin");
const teacherRoutes = require("./teacher");
const evaluationRoutes = require("./evaluation");
const departmentRoutes = require("./department");
const studentEvaluationRoutes = require("./studentEvaluation");

const router = express.Router();

// Mount route groups
router.use("/", authRoutes);
router.use("/", userRoutes);
router.use("/", adminRoutes);
router.use("/", teacherRoutes);
router.use("/", evaluationRoutes);
router.use("/", departmentRoutes);
router.use("/", studentEvaluationRoutes);

module.exports = router;

