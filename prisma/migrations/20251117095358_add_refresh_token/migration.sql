-- AlterTable
ALTER TABLE `User` ADD COLUMN `refreshTokenExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `refreshTokenHash` VARCHAR(191) NULL;
