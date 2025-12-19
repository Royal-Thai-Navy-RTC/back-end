-- AlterTable
ALTER TABLE `User` ADD COLUMN `isOnOfficialDuty` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `officialDutyNote` TEXT NULL;
