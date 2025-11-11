-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `birthDate` DATETIME(3) NOT NULL,
    `fullAddress` VARCHAR(191) NOT NULL,
    `role` ENUM('แอดมิน', 'ครูผู้สอน', 'นักเรียน') NOT NULL DEFAULT 'นักเรียน',
    `rank` ENUM('พลเรือเอก', 'พลเรือโท', 'พลเรือตรี', 'นาวาเอก', 'นาวาโท', 'นาวาตรี', 'เรือเอก', 'เรือโท', 'เรือตรี', 'พันจ่าเอก', 'พันจ่าโท', 'พันจ่าตรี', 'จ่าเอก', 'จ่าโท', 'จ่าตรี', 'พลฯ') NOT NULL DEFAULT 'พลฯ',
    `password` VARCHAR(191) NOT NULL,
    `avatar` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
