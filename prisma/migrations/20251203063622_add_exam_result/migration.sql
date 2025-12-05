-- CreateTable
CREATE TABLE `ExamResult` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `timestamp` DATETIME(3) NOT NULL,
    `scoreText` VARCHAR(64) NULL,
    `scoreValue` DOUBLE NULL,
    `scoreTotal` DOUBLE NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `navyNumber` VARCHAR(32) NULL,
    `unit` VARCHAR(191) NULL,
    `importedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ExamResult_timestamp_idx`(`timestamp`),
    INDEX `ExamResult_navyNumber_idx`(`navyNumber`),
    UNIQUE INDEX `ExamResult_timestamp_navyNumber_fullName_scoreText_key`(`timestamp`, `navyNumber`, `fullName`, `scoreText`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ExamResult` ADD CONSTRAINT `ExamResult_importedById_fkey` FOREIGN KEY (`importedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
