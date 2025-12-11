-- CreateTable
CREATE TABLE `SoldierPersonalScore` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderNumber` INTEGER NULL,
    `rankAndName` VARCHAR(191) NOT NULL,
    `battalion` VARCHAR(191) NULL,
    `company` VARCHAR(191) NULL,
    `knowledgeScore` DOUBLE NULL,
    `disciplineScore` DOUBLE NULL,
    `physicalScore` DOUBLE NULL,
    `totalScore` DOUBLE NULL,
    `ranking` INTEGER NULL,
    `remark` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SoldierPersonalScore_battalion_company_idx`(`battalion`, `company`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
