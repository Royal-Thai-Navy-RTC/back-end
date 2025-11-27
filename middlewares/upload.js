const fs = require("fs");
const path = require("path");
const multer = require("multer");

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const uploadRoot = path.join(__dirname, "..", "uploads");
const avatarDir = path.join(uploadRoot, "avatars");
const excelDir = path.join(uploadRoot, "evaluations");
const libraryDir = path.join(uploadRoot, "library");
ensureDir(avatarDir);
ensureDir(excelDir);
ensureDir(libraryDir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, avatarDir);
  },
  filename: function (req, file, cb) {
    // ตั้งชื่อไฟล์ให้ผูกกับ user id เพื่อให้ทับไฟล์เดิมของผู้ใช้รายนั้น
    const mimeToExt = {
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/webp": ".webp",
    };
    const extFromMime = mimeToExt[file.mimetype];
    const extFromName = path.extname(file.originalname).toLowerCase();
    const safeExt =
      extFromMime ||
      ([".png", ".jpg", ".jpeg", ".webp"].includes(extFromName)
        ? extFromName
        : "");

    const targetId = (req.params && req.params.id) || req.userId || "unknown";
    const filename = `user-${targetId}${safeExt}`;
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("รองรับเฉพาะไฟล์ภาพ PNG/JPEG/WEBP เท่านั้น"));
  }
  cb(null, true);
};

const limits = { fileSize: 5 * 1024 * 1024 }; // 5MB

const avatarUpload = multer({ storage, fileFilter, limits });

// ยอมรับหลายชื่อฟิลด์ที่พบบ่อย และแมปเป็น req.file ตัวเดียว
const avatarUploadOne = (req, res, next) => {
  const uploadAny = avatarUpload.any();
  uploadAny(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ message: "ไฟล์รูปต้องมีขนาดไม่เกิน 5MB" });
      }
      return next(err);
    }
    if (!Array.isArray(req.files)) return next();
    const prefer = ["avatar", "file", "image", "photo", "picture"];
    let picked = null;
    for (const name of prefer) {
      picked = req.files.find((f) => f.fieldname === name);
      if (picked) break;
    }
    if (!picked) picked = req.files[0];
    if (picked) req.file = picked;
    next();
  });
};

// -----------------------------
// Library upload (book/document)
// -----------------------------
const bookStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, libraryDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
    const safeName =
      path
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "book";
    const ts = Date.now();
    cb(null, `book-${ts}-${safeName}${ext}`);
  },
});

const bookFileFilter = (req, file, cb) => {
  const allowedExt = new Set([".pdf", ".epub"]);
  const allowedMime = new Set([
    "application/pdf",
    "application/epub+zip",
    "application/octet-stream", // บาง client ส่งเป็น octet-stream
  ]);
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExt.has(ext) && !allowedMime.has(file.mimetype)) {
    return cb(new Error("รองรับไฟล์ PDF หรือ EPUB เท่านั้น"));
  }
  cb(null, true);
};

const bookUploadLimits = { fileSize: 100 * 1024 * 1024 }; // 100MB
const libraryUpload = multer({
  storage: bookStorage,
  fileFilter: bookFileFilter,
  limits: bookUploadLimits,
});

// ยอมรับหลายชื่อฟิลด์และ map เป็น req.file
const libraryUploadOne = (req, res, next) => {
  const uploadAny = libraryUpload.any();
  uploadAny(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ message: "ไฟล์ต้องมีขนาดไม่เกิน 100MB" });
      }
      return res.status(400).json({ message: err.message });
    }
    if (!Array.isArray(req.files)) return next();
    const prefer = ["file", "book", "document", "upload"];
    let picked = null;
    for (const name of prefer) {
      picked = req.files.find((f) => f.fieldname === name);
      if (picked) break;
    }
    if (!picked) picked = req.files[0];
    if (picked) req.file = picked;
    next();
  });
};

module.exports = { avatarUpload, avatarUploadOne, uploadRoot, libraryUploadOne };

// -----------------------------
// Excel upload for evaluations
// -----------------------------
const excelStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, excelDir);
  },
  filename: function (req, file, cb) {
    const ts = Date.now();
    const ext = path.extname(file.originalname).toLowerCase() || ".xlsx";
    cb(null, `eval-${ts}${ext}`);
  },
});

const excelFileFilter = (req, file, cb) => {
  const allowed = new Set([
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    // บาง client ส่งเป็น octet-stream ให้ตรวจจากนามสกุลไฟล์แทน
    "application/octet-stream",
  ]);
  if (!allowed.has(file.mimetype)) {
    return cb(new Error("รองรับเฉพาะไฟล์ Excel (.xlsx, .xls) เท่านั้น"));
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== ".xlsx" && ext !== ".xls") {
    return cb(new Error("กรุณาอัปโหลดไฟล์นามสกุล .xlsx หรือ .xls"));
  }
  cb(null, true);
};

const excelUpload = multer({ storage: excelStorage, fileFilter: excelFileFilter, limits });

// ยอมรับหลายชื่อฟิลด์สำหรับไฟล์ Excel และแมปเป็น req.file ตัวเดียว
const excelUploadOne = (req, res, next) => {
  const uploadAny = excelUpload.any();
  uploadAny(req, res, (err) => {
    if (err) return next(err);
    if (!Array.isArray(req.files)) return next();
    const prefer = ["file", "excel", "upload", "sheet"];
    let picked = null;
    for (const name of prefer) {
      picked = req.files.find((f) => f.fieldname === name);
      if (picked) break;
    }
    if (!picked) picked = req.files[0];
    if (picked) req.file = picked;
    next();
  });
};

module.exports.excelUploadOne = excelUploadOne;
