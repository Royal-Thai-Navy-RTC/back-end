const prisma = require("../utils/prisma");
const fs = require("fs");
const path = require("path");

const MAX_SAFE_INT = BigInt(Number.MAX_SAFE_INTEGER);

const parsePositiveInt = (raw, { name, defaultValue, min = 1, max }) => {
  if (raw === undefined || raw === null || raw === "") return defaultValue;

  const str = String(raw).trim();
  if (!/^\d+$/.test(str)) {
    const err = new Error(`${name} must be a positive integer`);
    err.code = "INVALID_QUERY";
    throw err;
  }

  const valueBigInt = BigInt(str);
  if (valueBigInt > MAX_SAFE_INT) {
    const err = new Error(`${name} is too large`);
    err.code = "INVALID_QUERY";
    throw err;
  }

  const value = Number(valueBigInt);
  if (!Number.isSafeInteger(value)) {
    const err = new Error(`${name} must be a safe integer`);
    err.code = "INVALID_QUERY";
    throw err;
  }

  if (value < min) {
    const err = new Error(`${name} must be >= ${min}`);
    err.code = "INVALID_QUERY";
    throw err;
  }

  if (typeof max === "number" && value > max) {
    const err = new Error(`${name} must be <= ${max}`);
    err.code = "INVALID_QUERY";
    throw err;
  }

  return value;
};

const parseSkip = ({ page, pageSize, maxSkip }) => {
  const skipBigInt = BigInt(page - 1) * BigInt(pageSize);
  if (skipBigInt > BigInt(maxSkip)) {
    const err = new Error("pagination is too large");
    err.code = "INVALID_QUERY";
    throw err;
  }
  return Number(skipBigInt);
};
/**
 * สร้างข่าวใหม่
 * POST /admin/news
 */
exports.createNews = async (req, res) => {
  try {
    const { title, content, externalLink, isPublished } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        message: "กรุณากรอกหัวข้อข่าวและรายละเอียดให้ครบถ้วน",
      });
    }

    // ถ้ามีอัปโหลดรูป
    let imageUrl = null;
    if (req.file) {
      // เช่นเก็บเป็น /uploads/news/xxxx.jpg
      imageUrl = `/uploads/news/${req.file.filename}`;
    }

    const news = await prisma.news.create({
      data: {
        title,
        content,
        imageUrl,
        externalLink: externalLink || null,
        isPublished:
          typeof isPublished === "string"
            ? isPublished === "true"
            : isPublished ?? true,
      },
    });

    return res.status(201).json({
      message: "สร้างข่าวประชาสัมพันธ์สำเร็จ",
      data: news,
    });
  } catch (err) {
    console.error("createNews error:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });
  }
};

/**
 * ดึงข่าวทั้งหมด (สำหรับหน้า Admin จัดการข่าว)
 * GET /admin/news
 */
exports.getAllNews = async (req, res) => {
  try {
    const safePage = parsePositiveInt(req.query.page, {
      name: "page",
      defaultValue: 1,
      min: 1,
      max: 100000,
    });
    const safePageSize = parsePositiveInt(req.query.pageSize, {
      name: "pageSize",
      defaultValue: 10,
      min: 1,
      max: 100,
    });

    const skip = parseSkip({ page: safePage, pageSize: safePageSize, maxSkip: 100000 });

    // ดึงข้อมูล + นับจำนวนทั้งหมดพร้อมกัน
    const [newsList, totalItems] = await Promise.all([
      prisma.news.findMany({
        skip,
        take: safePageSize,
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      }),
      prisma.news.count(), // ถ้ามี where เฉพาะก็ใส่ให้เหมือนกับ findMany
    ]);

    const totalPages = Math.ceil(totalItems / safePageSize);

    return res.json({
      data: newsList,
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        totalItems,
        totalPages,
      },
    });
  } catch (err) {
    if (err?.code === "INVALID_QUERY") {
      return res.status(400).json({ message: err.message });
    }
    console.error("getAllNews error:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });
  }
};


/**
 * ดึงข่าวสำหรับหน้า Home (เฉพาะที่ isPublished = true)
 * GET /news/home
 * optional query: ?limit=5
 */
exports.getNewsForHome = async (req, res) => {
  try {
    const safePage = parsePositiveInt(req.query.page, {
      name: "page",
      defaultValue: 1,
      min: 1,
      max: 100000,
    });
    const safePageSize = parsePositiveInt(req.query.pageSize, {
      name: "pageSize",
      defaultValue: 5,
      min: 1,
      max: 20,
    });

    const skip = parseSkip({ page: safePage, pageSize: safePageSize, maxSkip: 10000 });

    const [newsList, totalItems] = await Promise.all([
      prisma.news.findMany({
        where: { isPublished: true },
        skip,
        take: safePageSize,
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      }),
      prisma.news.count({
        where: { isPublished: true },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / safePageSize);

    return res.json({
      data: newsList,
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        totalItems,
        totalPages,
      },
    });
  } catch (err) {
    if (err?.code === "INVALID_QUERY") {
      return res.status(400).json({ message: err.message });
    }
    console.error("getNewsForHome error:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });
  }
};

/**
 * ดึงข่าวรายละเอียดทีละข่าว
 * GET /news/:id
 */
exports.getNewsById = async (req, res) => {
  try {
    const rawId = req.params.id;

    if (!rawId || !/^\d+$/.test(rawId)) {
      return res.status(400).json({
        message: "รูปแบบรหัสข่าวไม่ถูกต้อง",
      });
    }

    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "รูปแบบรหัสข่าวไม่ถูกต้อง",
      });
    }

    const news = await prisma.news.findUnique({
      where: { id },
    });

    if (!news) {
      return res.status(404).json({
        message: "ไม่พบข่าวตามรหัสที่ระบุ",
      });
    }

    return res.json({ data: news });
  } catch (err) {
    console.error("getNewsById error:", err);
    return res.status(500).json({
      message: "ไม่สามารถดำเนินการได้ในขณะนี้",
    });
  }
};

// ฟังก์ชันเล็ก ๆ ช่วยลบไฟล์รูปเก่า
const removeOldImage = (imageUrl) => {
  try {
    if (!imageUrl) return;
    // imageUrl รูปแบบ /uploads/news/xxxx.jpg
    const filePath = path.join(process.cwd(), imageUrl.replace(/^\//, ""));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error("removeOldImage error:", err);
  }
};

/**
 * แก้ไขข่าว
 * PUT /admin/news/:id
 */
exports.updateNews = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "รหัสข่าวไม่ถูกต้อง" });
    }

    const existing = await prisma.news.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "ไม่พบข่าวที่ต้องการแก้ไข" });
    }

    const { title, content, externalLink, isPublished } = req.body;

    const dataToUpdate = {};

    if (typeof title !== "undefined") dataToUpdate.title = title;
    if (typeof content !== "undefined") dataToUpdate.content = content;
    if (typeof externalLink !== "undefined")
      dataToUpdate.externalLink = externalLink || null;

    if (typeof isPublished !== "undefined") {
      dataToUpdate.isPublished =
        typeof isPublished === "string"
          ? isPublished === "true"
          : Boolean(isPublished);
    }

    // มีการอัปโหลดรูปใหม่ → ลบรูปเก่าแล้วเซ็ตค่าใหม่
    if (req.file) {
      const newImageUrl = `/uploads/news/${req.file.filename}`;

      // ลบรูปเก่า (ถ้ามี)
      if (existing.imageUrl) {
        removeOldImage(existing.imageUrl);
      }

      dataToUpdate.imageUrl = newImageUrl;
    }

    const updated = await prisma.news.update({
      where: { id },
      data: dataToUpdate,
    });

    return res.json({
      message: "แก้ไขข่าวประชาสัมพันธ์สำเร็จ",
      data: updated,
    });
  } catch (err) {
    console.error("updateNews error:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });
  }
};


/**
 * ลบข่าว
 * DELETE /admin/news/:id
 */
exports.deleteNews = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "รหัสข่าวไม่ถูกต้อง" });
    }

    const existing = await prisma.news.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "ไม่พบข่าวที่ต้องการลบ" });
    }

    // ลบจากฐานข้อมูล
    await prisma.news.delete({ where: { id } });

    // ลบไฟล์รูป (ถ้ามี)
    if (existing.imageUrl) {
      removeOldImage(existing.imageUrl);
    }

    return res.json({
      message: "ลบข่าวประชาสัมพันธ์สำเร็จ",
    });
  } catch (err) {
    console.error("deleteNews error:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });
  }
};
