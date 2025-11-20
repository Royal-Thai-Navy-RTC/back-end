-- AlterTable
ALTER TABLE `User` ADD COLUMN `chronicDiseases` JSON NULL,
    ADD COLUMN `drugAllergies` JSON NULL,
    ADD COLUMN `foodAllergies` JSON NULL,
    ADD COLUMN `religion` VARCHAR(100) NULL,
    ADD COLUMN `secondaryOccupation` VARCHAR(255) NULL,
    ADD COLUMN `specialSkills` VARCHAR(255) NULL;
