-- AlterTable
ALTER TABLE `SoldierIntake` ADD COLUMN `accidentHistory` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `experienced` INTEGER NULL,
    ADD COLUMN `familyStatus` VARCHAR(100) NULL,
    ADD COLUMN `surgeryHistory` BOOLEAN NULL DEFAULT false;
