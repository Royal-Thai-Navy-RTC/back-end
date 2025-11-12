const fs = require("fs");

const buildUserAvatarFilename = (userId, srcExt) => {
  const ext = String(srcExt || "").toLowerCase();
  const normalized = ext === ".jpeg" ? ".jpg" : ext;
  return `user-${userId}${normalized}`;
};

const tryPickupLocalFileFromBody = (body) => {
  if (!body) return null;
  const keys = ["avatar", "file", "image", "photo", "picture"];
  for (const k of keys) {
    if (typeof body[k] === "string" && body[k].trim() !== "") {
      let p = body[k].trim();
      if (p.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1);
      if (p.startsWith("/") && /^[A-Za-z]:/.test(p.slice(1))) {
        p = p.slice(1);
      }
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
};

module.exports = { buildUserAvatarFilename, tryPickupLocalFileFromBody };

