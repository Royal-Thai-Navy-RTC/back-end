/*
  Warnings:

  - You are about to alter the column `overallScore` on the `StudentEvaluation` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.

*/
-- AlterTable
ALTER TABLE `StudentEvaluation` MODIFY `overallScore` DOUBLE NULL;
