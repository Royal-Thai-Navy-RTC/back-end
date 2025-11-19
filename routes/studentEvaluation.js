const express = require("express");
const middleware = require("../middlewares/middleware");
const templateController = require("../controllers/studentEvaluationTemplateController");
const evaluationController = require("../controllers/studentEvaluationController");

const router = express.Router();

// Template management (Admin only)
router.post(
  "/admin/student-evaluation-templates",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  templateController.createTemplate
);

router.get(
  "/admin/student-evaluation-templates",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  templateController.listTemplates
);

router.get(
  "/admin/student-evaluation-templates/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  templateController.getTemplateById
);

router.put(
  "/admin/student-evaluation-templates/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  templateController.updateTemplate
);

router.delete(
  "/admin/student-evaluation-templates/:id",
  middleware.verifyToken,
  middleware.authorizeAdmin,
  templateController.deleteTemplate
);

// Student evaluation submissions (Admin or Teacher)
router.post(
  "/student-evaluations",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  evaluationController.createEvaluation
);

router.get(
  "/student-evaluations",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  evaluationController.listEvaluations
);

router.get(
  "/student-evaluations/:id",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  evaluationController.getEvaluationById
);

router.put(
  "/student-evaluations/:id",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  evaluationController.updateEvaluation
);

router.delete(
  "/student-evaluations/:id",
  middleware.verifyToken,
  middleware.authorizeAdminOrTeacher,
  evaluationController.deleteEvaluation
);

module.exports = router;
