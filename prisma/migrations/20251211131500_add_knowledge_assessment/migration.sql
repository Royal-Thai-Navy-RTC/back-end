-- CreateTable
CREATE TABLE `KnowledgeAssessment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderNumber` INTEGER NULL,
    `battalion` VARCHAR(64) NULL,
    `company` VARCHAR(64) NULL,
    `practicalScore` DOUBLE NULL,
    `theoryScore` DOUBLE NULL,
    `totalScore` DOUBLE NULL,
    `averagePercentage` DOUBLE NULL,
    `note` VARCHAR(255) NULL,
    `ranking` INTEGER NULL,
    `batchId` VARCHAR(64) NULL,
    `sourceFile` VARCHAR(255) NULL,
    `sheetName` VARCHAR(120) NULL,
    `importedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `importedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `KnowledgeAssessment_battalion_company_idx`(`battalion`, `company`),
    INDEX `KnowledgeAssessment_batchId_idx`(`batchId`),
    INDEX `KnowledgeAssessment_importedById_fkey`(`importedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `KnowledgeAssessment` ADD CONSTRAINT `KnowledgeAssessment_importedById_fkey` FOREIGN KEY (`importedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
