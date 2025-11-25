-- Extend templateType enum to support COMPANY (กองร้อย) in addition to BATTALION (กองพัน)
ALTER TABLE `StudentEvaluationTemplate`
  MODIFY `templateType` ENUM('BATTALION', 'COMPANY') NOT NULL;
