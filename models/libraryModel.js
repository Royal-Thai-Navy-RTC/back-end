const prisma = require("../utils/prisma");

const baseSelect = {
  id: true,
  title: true,
  description: true,
  category: true,
  fileUrl: true,
  coverUrl: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

const validationError = (message) => {
  const err = new Error(message);
  err.code = "VALIDATION_ERROR";
  return err;
};

const notFoundError = () => {
  const err = new Error("ไม่พบรายการที่ต้องการ");
  err.code = "NOT_FOUND";
  return err;
};

const normalizeString = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : undefined;
};

const toNullableString = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const str = normalizeString(value);
  return str !== undefined ? str : null;
};

const parseBoolean = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).toLowerCase().trim();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return undefined;
};

const parseId = (id) => {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw validationError("id ต้องเป็นจำนวนเต็มบวก");
  }
  return numericId;
};

const normalizeCreateInput = (input = {}) => {
  const title = normalizeString(input.title);
  if (!title) {
    throw validationError("ต้องระบุชื่อเรื่อง (title)");
  }

  const isActive = parseBoolean(input.isActive);
  if (input.isActive !== undefined && isActive === undefined) {
    throw validationError("isActive ต้องเป็นค่า true/false");
  }

  const fileUrl = toNullableString(input.fileUrl);
  if (!fileUrl) {
    throw validationError("ต้องอัปโหลดไฟล์หนังสือ");
  }

  return {
    title,
    description: toNullableString(input.description),
    category: toNullableString(input.category),
    fileUrl,
    coverUrl: toNullableString(input.coverUrl),
    isActive: isActive !== undefined ? isActive : true,
  };
};

const normalizeUpdateInput = (input = {}) => {
  const data = {};
  if (input.title !== undefined) {
    const title = normalizeString(input.title);
    if (!title) {
      throw validationError("title ต้องไม่ว่าง");
    }
    data.title = title;
  }
  const description = toNullableString(input.description);
  if (description !== undefined) data.description = description;

  const category = toNullableString(input.category);
  if (category !== undefined) data.category = category;

  const fileUrl = toNullableString(input.fileUrl);
  if (fileUrl !== undefined) {
    if (!fileUrl) {
      throw validationError("ต้องส่งไฟล์หนังสือใหม่หรือไม่ส่งฟิลด์ fileUrl");
    }
    data.fileUrl = fileUrl;
  }

  const coverUrl = toNullableString(input.coverUrl);
  if (coverUrl !== undefined) data.coverUrl = coverUrl;

  const isActive = parseBoolean(input.isActive);
  if (input.isActive !== undefined && isActive === undefined) {
    throw validationError("isActive ต้องเป็นค่า true/false");
  }
  if (isActive !== undefined) data.isActive = isActive;

  if (Object.keys(data).length === 0) {
    throw validationError("ไม่มีข้อมูลที่สามารถแก้ไขได้");
  }

  return data;
};

const buildListWhere = (filters = {}) => {
  const where = {};
  const includeInactive = parseBoolean(filters.includeInactive);
  if (includeInactive !== true) {
    where.isActive = true;
  }

  const category = normalizeString(filters.category);
  if (category) {
    where.category = { equals: category, mode: "insensitive" };
  }

  const search = normalizeString(filters.search);
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
};

module.exports = {
  listLibraryItems: async (filters = {}) => {
    const pageSize = Math.max(
      1,
      Math.min(Number(filters.pageSize) || 20, 100)
    );
    const page = Math.max(1, Number(filters.page) || 1);
    const skip = (page - 1) * pageSize;

    const where = buildListWhere(filters);

    const [items, total] = await Promise.all([
      prisma.libraryItem.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: pageSize,
        select: baseSelect,
      }),
      prisma.libraryItem.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  createLibraryItem: async (input = {}) => {
    const data = normalizeCreateInput(input);
    return prisma.libraryItem.create({
      data,
      select: baseSelect,
    });
  },

  updateLibraryItem: async (id, input = {}) => {
    const itemId = parseId(id);
    const data = normalizeUpdateInput(input);

    const existing = await prisma.libraryItem.findUnique({
      where: { id: itemId },
      select: { id: true },
    });
    if (!existing) {
      throw notFoundError();
    }

    return prisma.libraryItem.update({
      where: { id: itemId },
      data,
      select: baseSelect,
    });
  },

  softDeleteLibraryItem: async (id) => {
    const itemId = parseId(id);
    const existing = await prisma.libraryItem.findUnique({
      where: { id: itemId },
      select: { id: true, isActive: true },
    });
    if (!existing) {
      throw notFoundError();
    }
    await prisma.libraryItem.update({
      where: { id: itemId },
      data: { isActive: false },
    });
  },

  getLibraryItemById: async (id) => {
    const itemId = parseId(id);
    const item = await prisma.libraryItem.findUnique({
      where: { id: itemId },
      select: baseSelect,
    });
    if (!item) {
      throw notFoundError();
    }
    return item;
  },
};
