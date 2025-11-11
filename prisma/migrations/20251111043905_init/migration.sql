/*
  Warnings:

  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - You are about to alter the column `username` on the `User` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(64)`.
  - You are about to alter the column `firstName` on the `User` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(100)`.
  - You are about to alter the column `lastName` on the `User` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(100)`.
  - You are about to alter the column `phone` on the `User` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(32)`.
  - Added the required column `emergencyContactName` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `emergencyContactPhone` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passwordHash` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `User` DROP COLUMN `password`,
    ADD COLUMN `education` VARCHAR(255) NULL,
    ADD COLUMN `emergencyContactName` VARCHAR(100) NOT NULL,
    ADD COLUMN `emergencyContactPhone` VARCHAR(32) NOT NULL,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `medicalHistory` TEXT NULL,
    ADD COLUMN `passwordHash` VARCHAR(255) NOT NULL,
    ADD COLUMN `position` VARCHAR(150) NULL,
    MODIFY `username` VARCHAR(64) NOT NULL,
    MODIFY `firstName` VARCHAR(100) NOT NULL,
    MODIFY `lastName` VARCHAR(100) NOT NULL,
    MODIFY `phone` VARCHAR(32) NOT NULL,
    MODIFY `fullAddress` VARCHAR(255) NOT NULL,
    MODIFY `avatar` VARCHAR(255) NULL;

-- CreateIndex
CREATE INDEX `User_lastName_firstName_idx` ON `User`(`lastName`, `firstName`);

-- CreateIndex
CREATE INDEX `User_rank_idx` ON `User`(`rank`);

-- CreateIndex
CREATE INDEX `User_role_idx` ON `User`(`role`);
