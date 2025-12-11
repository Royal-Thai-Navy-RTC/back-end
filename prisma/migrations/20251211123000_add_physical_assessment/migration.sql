-- CreateTable
CREATE TABLE PhysicalAssessment (
    id INTEGER NOT NULL AUTO_INCREMENT,
    orderNumber INTEGER NULL,
    battalion VARCHAR(64) NULL,
    company VARCHAR(64) NULL,
    sitUpScore DOUBLE NULL,
    pushUpScore DOUBLE NULL,
    runScore DOUBLE NULL,
    physicalRoutineScore DOUBLE NULL,
    totalScore DOUBLE NULL,
    averageScore DOUBLE NULL,
    note VARCHAR(255) NULL,
    ranking INTEGER NULL,
    batchId VARCHAR(64) NULL,
    sourceFile VARCHAR(255) NULL,
    sheetName VARCHAR(120) NULL,
    importedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    importedById INTEGER NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX PhysicalAssessment_battalion_company_idx(battalion, company),
    INDEX PhysicalAssessment_batchId_idx(batchId),
    INDEX PhysicalAssessment_importedById_fkey(importedById),
    PRIMARY KEY (id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE PhysicalAssessment ADD CONSTRAINT PhysicalAssessment_importedById_fkey FOREIGN KEY (importedById) REFERENCES User(id) ON DELETE SET NULL ON UPDATE CASCADE;
