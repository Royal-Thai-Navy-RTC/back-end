const multer = require("multer");
const fs = require("fs");
const path = require("path");

const uploadDir = path.join(process.cwd(), "uploads", "news");

// สร้างโฟลเดอร์ถ้ายังไม่มี
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "_");
    const unique = Date.now();
    cb(null, `${base}_${unique}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("รองรับเฉพาะไฟล์รูปภาพเท่านั้น"), false);
  }
  cb(null, true);
};

exports.uploadNewsImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});
