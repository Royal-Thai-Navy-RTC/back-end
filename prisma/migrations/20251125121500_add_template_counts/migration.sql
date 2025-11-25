-- Add battalion/evaluator counts for student evaluation templates
ALTER TABLE `StudentEvaluationTemplate`
  ADD COLUMN `battalionCount` INT NULL,
  ADD COLUMN `teacherEvaluatorCount` INT NULL;
