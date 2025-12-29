const fs = require("fs");
const path = require("path");
const Library = require("../models/libraryModel");

const LIBRARY_PUBLIC_PREFIX = "/uploads/library";

const toLibraryPublicPath = (file) => {
  if (!file) return undefined;
  return `${LIBRARY_PUBLIC_PREFIX}/${file.filename}`.replace(/\\/g, "/");
};

const resolveLibraryDiskPath = (publicPath) => {
  if (!publicPath) return null;
  const stripped = String(publicPath).replace(/^\/+/, "");
  if (!stripped.startsWith("uploads/library")) return null;
  return path.join(__dirname, "..", stripped);
};

const deleteIfExists = (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn("Failed to delete file:", filePath, err.message);
  }
};

const handleError = (err, res, actionMessage) => {
  if (err.code === "VALIDATION_ERROR") {
    return res.status(400).json({ message: err.message });
  }
  if (err.code === "NOT_FOUND") {
    return res.status(404).json({ message: err.message });
  }
  console.error(actionMessage, err);
  return res.status(500).json({ message: actionMessage, detail: err.message });
};

const listLibraryItems = async (req, res) => {
  try {
    const { page, pageSize, search, category, includeInactive } = req.query || {};
    const result = await Library.listLibraryItems({
      page,
      pageSize,
      search,
      category,
      includeInactive,
    });
    res.json({
      data: result.items,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    });
  } catch (err) {
    handleError(err, res, "ไม่สามารถดึงข้อมูลคลัง");
  }
};

const createLibraryItem = async (req, res) => {
  const uploadedFile = req.file;
  if (!uploadedFile) {
    return res.status(400).json({ message: "กรุณาอัปโหลดไฟล์หนังสือ" });
  }
  try {
    const payload = { ...req.body, fileUrl: toLibraryPublicPath(uploadedFile) };
    const item = await Library.createLibraryItem(payload);
    res.status(201).json({ item });
  } catch (err) {
    deleteIfExists(uploadedFile?.path);
    handleError(err, res, "ไม่สามารถสร้างรายการคลัง");
  }
};

const updateLibraryItem = async (req, res) => {
  const uploadedFile = req.file;
  const payload = { ...req.body };
  if (uploadedFile) {
    payload.fileUrl = toLibraryPublicPath(uploadedFile);
  }

  try {
    const existing =
      uploadedFile && (await Library.getLibraryItemById(req.params.id));
    const item = await Library.updateLibraryItem(req.params.id, payload);
    if (
      uploadedFile &&
      existing?.fileUrl &&
      existing.fileUrl !== item.fileUrl
    ) {
      deleteIfExists(resolveLibraryDiskPath(existing.fileUrl));
    }
    res.json({ item });
  } catch (err) {
    deleteIfExists(uploadedFile?.path);
    handleError(err, res, "ไม่สามารถแก้ไขรายการคลัง");
  }
};

const deleteLibraryItem = async (req, res) => {
  try {
    const existing = await Library.getLibraryItemById(req.params.id);
    await Library.softDeleteLibraryItem(req.params.id);
    if (existing?.fileUrl) {
      deleteIfExists(resolveLibraryDiskPath(existing.fileUrl));
    }
    res.status(204).send();
  } catch (err) {
    handleError(err, res, "ไม่สามารถลบรายการคลัง");
  }
};

module.exports = {
  listLibraryItems,
  createLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
};
