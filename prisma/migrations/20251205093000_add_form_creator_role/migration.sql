-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('Owner', 'แอดมิน', 'ผู้ช่วยแอดมิน', 'ผู้ดูแลตารางสอน', 'ผู้สร้างแบบฟอร์ม', 'ครูผู้สอน', 'นักเรียน') NOT NULL DEFAULT 'นักเรียน';