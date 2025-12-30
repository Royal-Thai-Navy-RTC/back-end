-- AlterTable
ALTER TABLE `SoldierIntake` ADD COLUMN `updatedById` INTEGER NULL,
    ADD COLUMN `updatedByName` VARCHAR(255) NULL;

-- CreateIndex
CREATE INDEX `SoldierIntake_updatedById_fkey` ON `SoldierIntake`(`updatedById`);

-- AddForeignKey
ALTER TABLE `SoldierIntake` ADD CONSTRAINT `SoldierIntake_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
