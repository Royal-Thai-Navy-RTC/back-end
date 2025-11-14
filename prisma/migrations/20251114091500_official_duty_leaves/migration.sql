-- AlterTable: add DEPARTMENT_HEAD role
ALTER TABLE `User`
  MODIFY `role` ENUM('แอดมิน', 'หัวหน้าแผนกศึกษา', 'ครูผู้สอน', 'นักเรียน') NOT NULL DEFAULT 'นักเรียน';

-- AlterTable: extend TeacherLeave for official duty workflow
ALTER TABLE `TeacherLeave`
  ADD COLUMN `isOfficialDuty` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `departmentApprovalStatus` ENUM('PENDING', 'APPROVED', 'REJECTED') NULL,
  ADD COLUMN `departmentApprovalBy` INTEGER NULL,
  ADD COLUMN `departmentApprovalAt` DATETIME(3) NULL;

-- Add index for filtering official duty leaves
CREATE INDEX `TeacherLeave_isOfficialDuty_status_idx`
  ON `TeacherLeave`(`isOfficialDuty`, `status`);

-- Add FK for department approval reference
ALTER TABLE `TeacherLeave`
  ADD CONSTRAINT `TeacherLeave_departmentApprovalBy_fkey`
  FOREIGN KEY (`departmentApprovalBy`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
