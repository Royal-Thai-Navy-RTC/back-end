const prisma = require("../utils/prisma");
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
    // ดึงค่าจาก query string เช่น /admin/news?page=2&pageSize=10
    const page = parseInt(req.query.page, 10) || 1;       // หน้าเริ่มต้น = 1
    const pageSize = parseInt(req.query.pageSize, 10) || 10; // ต่อหน้าเริ่มต้น = 10

    // กันค่าติดลบ/ผิดปกติ
    const safePage = page < 1 ? 1 : page;
    const safePageSize = pageSize < 1 ? 10 : pageSize;

    const skip = (safePage - 1) * safePageSize;

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
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 5;

    const safePage = page < 1 ? 1 : page;
    const safePageSize = pageSize < 1 ? 5 : pageSize;

    const skip = (safePage - 1) * safePageSize;

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
