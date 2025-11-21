-- AlterTable
ALTER TABLE `TeachingSchedule` ADD COLUMN `battalionCode` VARCHAR(32) NULL,
    ADD COLUMN `companyCode` VARCHAR(32) NULL;

-- CreateIndex
CREATE INDEX `TeachingSchedule_battalionCode_companyCode_start_idx` ON `TeachingSchedule`(`battalionCode`, `companyCode`, `start`);
