-- CreateTable
CREATE TABLE `PersonalMeritScore` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rankTitle` VARCHAR(64) NULL,
    `soldierName` VARCHAR(255) NOT NULL,
    `rawName` VARCHAR(255) NULL,
    `battalion` VARCHAR(64) NULL,
    `company` VARCHAR(64) NULL,
    `knowledgeScore` DOUBLE NULL,
    `disciplineScore` DOUBLE NULL,
    `physicalScore` DOUBLE NULL,
    `totalScore` DOUBLE NULL,
    `ranking` INTEGER NULL,
    `batchId` VARCHAR(64) NULL,
    `sourceFile` VARCHAR(255) NULL,
    `sheetName` VARCHAR(120) NULL,
    `importedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `importedById` INTEGER NULL,

    INDEX `PersonalMeritScore_batchId_idx`(`batchId`),
    INDEX `PersonalMeritScore_importedById_fkey`(`importedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PersonalMeritScore` ADD CONSTRAINT `PersonalMeritScore_importedById_fkey` FOREIGN KEY (`importedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
