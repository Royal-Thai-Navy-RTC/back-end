-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('Owner', 'แอดมิน', 'ผู้ช่วยแอดมิน', 'ครูผู้สอน', 'นักเรียน') NOT NULL DEFAULT 'นักเรียน';
