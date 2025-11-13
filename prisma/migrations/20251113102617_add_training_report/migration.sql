-- CreateTable
CREATE TABLE `TrainingReport` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `teacherId` INTEGER NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `participantCount` INTEGER NOT NULL,
    `company` VARCHAR(150) NULL,
    `battalion` VARCHAR(150) NULL,
    `trainingDate` DATETIME(3) NOT NULL,
    `trainingTime` VARCHAR(16) NULL,
    `location` VARCHAR(191) NULL,
    `durationHours` DOUBLE NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TrainingReport_teacherId_trainingDate_idx`(`teacherId`, `trainingDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TrainingReport` ADD CONSTRAINT `TrainingReport_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
