const Library = require("../models/libraryModel");

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
  try {
    const item = await Library.createLibraryItem(req.body);
    res.status(201).json({ item });
  } catch (err) {
    handleError(err, res, "ไม่สามารถสร้างรายการคลัง");
  }
};

const updateLibraryItem = async (req, res) => {
  try {
    const item = await Library.updateLibraryItem(req.params.id, req.body);
    res.json({ item });
  } catch (err) {
    handleError(err, res, "ไม่สามารถแก้ไขรายการคลัง");
  }
};

const deleteLibraryItem = async (req, res) => {
  try {
    await Library.softDeleteLibraryItem(req.params.id);
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
