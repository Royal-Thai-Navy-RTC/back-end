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
ensureDir(avatarDir);

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
    const safeExt = extFromMime || ( [".png", ".jpg", ".jpeg", ".webp"].includes(extFromName) ? extFromName : "" );

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
    if (err) return next(err);
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

module.exports = { avatarUpload, avatarUploadOne, uploadRoot };
