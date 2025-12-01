-- AlterTable
ALTER TABLE `StudentEvaluation` ADD COLUMN `evaluatedPersonId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `StudentEvaluation` ADD CONSTRAINT `StudentEvaluation_evaluatedPersonId_fkey` FOREIGN KEY (`evaluatedPersonId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
