-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(64) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` ENUM('แอดมิน', 'ครูผู้สอน', 'นักเรียน') NOT NULL DEFAULT 'นักเรียน',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `firstName` VARCHAR(100) NOT NULL,
    `lastName` VARCHAR(100) NOT NULL,
    `birthDate` DATETIME(3) NOT NULL,
    `rank` ENUM('พลเรือเอก', 'พลเรือเอกหญิง', 'พลเรือโท', 'พลเรือโทหญิง', 'พลเรือตรี', 'พลเรือตรีหญิง', 'นาวาเอก', 'นาวาเอกหญิง', 'นาวาโท', 'นาวาโทหญิง', 'นาวาตรี', 'นาวาตรีหญิง', 'เรือเอก', 'เรือเอกหญิง', 'เรือโท', 'เรือโทหญิง', 'เรือตรี', 'เรือตรีหญิง', 'พันจ่าเอก', 'พันจ่าเอกหญิง', 'พันจ่าโท', 'พันจ่าโทหญิง', 'พันจ่าตรี', 'พันจ่าตรีหญิง', 'พันโท', 'พันโทหญิง', 'พันตรี', 'พันตรีหญิง', 'จ่าเอก', 'จ่าเอกหญิง', 'จ่าโท', 'จ่าโทหญิง', 'จ่าตรี', 'จ่าตรีหญิง', 'พลฯ') NOT NULL DEFAULT 'พลฯ',
    `fullAddress` VARCHAR(255) NOT NULL,
    `education` VARCHAR(255) NULL,
    `position` VARCHAR(150) NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(32) NOT NULL,
    `emergencyContactName` VARCHAR(100) NOT NULL,
    `emergencyContactPhone` VARCHAR(32) NOT NULL,
    `medicalHistory` TEXT NULL,
    `avatar` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_phone_key`(`phone`),
    INDEX `User_lastName_firstName_idx`(`lastName`, `firstName`),
    INDEX `User_rank_idx`(`rank`),
    INDEX `User_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EvaluationSheet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subject` VARCHAR(191) NOT NULL,
    `teacherName` VARCHAR(191) NOT NULL,
    `teacherId` INTEGER NULL,
    `evaluatorName` VARCHAR(191) NOT NULL,
    `evaluatorUnit` VARCHAR(255) NULL,
    `evaluatedAt` DATETIME(3) NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EvaluationSheet_teacherId_idx`(`teacherId`),
    INDEX `EvaluationSheet_teacherName_idx`(`teacherName`),
    INDEX `EvaluationSheet_subject_idx`(`subject`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EvaluationAnswer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sheetId` INTEGER NOT NULL,
    `section` VARCHAR(32) NULL,
    `itemCode` VARCHAR(32) NULL,
    `itemText` VARCHAR(255) NOT NULL,
    `rating` INTEGER NOT NULL,

    INDEX `EvaluationAnswer_sheetId_idx`(`sheetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- CreateTable
CREATE TABLE `TeacherLeave` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `teacherId` INTEGER NOT NULL,
    `leaveType` VARCHAR(100) NOT NULL,
    `destination` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TeacherLeave_teacherId_startDate_idx`(`teacherId`, `startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EvaluationSheet` ADD CONSTRAINT `EvaluationSheet_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvaluationAnswer` ADD CONSTRAINT `EvaluationAnswer_sheetId_fkey` FOREIGN KEY (`sheetId`) REFERENCES `EvaluationSheet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainingReport` ADD CONSTRAINT `TrainingReport_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeacherLeave` ADD CONSTRAINT `TeacherLeave_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
