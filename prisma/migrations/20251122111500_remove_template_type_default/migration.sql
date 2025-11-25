-- Remove default value from templateType while keeping it required
ALTER TABLE `StudentEvaluationTemplate`
  MODIFY `templateType` ENUM('BATTALION') NOT NULL;
