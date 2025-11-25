-- Add templateType to student evaluation templates (default: BATTALION)
ALTER TABLE `StudentEvaluationTemplate`
ADD COLUMN `templateType` ENUM('BATTALION') NOT NULL DEFAULT 'BATTALION';
