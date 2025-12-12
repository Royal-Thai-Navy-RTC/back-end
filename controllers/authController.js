const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const jwt = require("jsonwebtoken"); // เรียกใช้งาน jwt เพื่อใช้ในการสร้าง token
const bcrypt = require("bcryptjs"); // เรียกใช้งาน bcryptjs เพื่อใช้ในการเข้ารหัสรหัสผ่าน
const config = require("../config"); // เรียกใช้งานไฟล์ config.js ที่เราสร้างไว้
const User = require("../models/userModel"); // เรียกใช้งาน userModel.js ที่เราสร้างไว้
const {
  registerLoginFailure,
  registerLoginSuccess,
} = require("../utils/loginAttemptLimiter");
const {
  buildUserAvatarFilename,
  tryPickupLocalFileFromBody,
} = require("../utils/avatar");

const avatarDir = path.join(__dirname, "..", "uploads", "avatars");
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

const mimeToExt = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
};

const ACCESS_TOKEN_EXPIRES_IN = "24h";
const REFRESH_TOKEN_EXPIRY_DAYS = Number(config.refreshTokenExpiryDays || 7);
const REFRESH_TOKEN_BYTE_LENGTH = 48;

const generateAccessToken = (user) => {
  return jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
};

const generateRawRefreshToken = () =>
  crypto.randomBytes(REFRESH_TOKEN_BYTE_LENGTH).toString("hex");

const hashRefreshToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

const calculateRefreshTokenExpiry = () => {
  const expires = new Date();
  expires.setDate(expires.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return expires;
};

const issueTokensForUser = async (user) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRawRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);
  const expiresAt = calculateRefreshTokenExpiry();
  await User.saveRefreshTokenForUser(user.id, tokenHash, expiresAt);
  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_EXPIRES_IN };
};

const buildLoginResponse = (user, tokens) => ({
  // token: tokens.accessToken,
  accessToken: tokens.accessToken,
  refreshToken: tokens.refreshToken,
  tokenType: "Bearer",
  expiresIn: tokens.expiresIn,
  user: {
    id: user.id,
    username: user.username,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  },
});

const cleanupUploadedFile = async (file) => {
  if (!file || !file.path) return;
  try {
    if (fs.existsSync(file.path)) {
      await fs.promises.unlink(file.path);
    }
  } catch (err) {
    console.warn("Failed to clean up uploaded file:", err.message);
  }
};

const finalizeAvatarUpload = async (userId, file) => {
  if (!file || !file.filename) return null;
  const extFromFile = path.extname(file.filename);
  const extFromOriginal = path.extname(file.originalname || "");
  const ext = extFromFile || extFromOriginal || ".png";
  const finalFilename = buildUserAvatarFilename(userId, ext);
  const finalPath = path.join(avatarDir, finalFilename);
  const publicPath = `/uploads/avatars/${finalFilename}`;

  try {
    if (file.path !== finalPath) {
      if (fs.existsSync(finalPath)) {
        await fs.promises.unlink(finalPath);
      }
      await fs.promises.rename(file.path, finalPath);
    }
    await User.setUserAvatar(userId, publicPath);
    return publicPath;
  } catch (err) {
    try {
      if (fs.existsSync(finalPath)) {
        await fs.promises.unlink(finalPath);
      } else if (fs.existsSync(file.path)) {
        await fs.promises.unlink(file.path);
      }
    } catch {}
    throw err;
  }
};

const copyAvatarFromLocalPath = async (userId, sourcePath) => {
  if (!sourcePath) return null;
  const ext = path.extname(sourcePath) || ".png";
  const finalFilename = buildUserAvatarFilename(userId, ext);
  const finalPath = path.join(avatarDir, finalFilename);
  const publicPath = `/uploads/avatars/${finalFilename}`;
  await fs.promises.copyFile(sourcePath, finalPath);
  await User.setUserAvatar(userId, publicPath);
  return publicPath;
};

const parseBase64Image = (value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const dataUrlMatch = trimmed.match(
    /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i
  );
  let mime = "image/png";
  let base64Payload = trimmed;
  if (dataUrlMatch) {
    mime = dataUrlMatch[1].toLowerCase();
    base64Payload = dataUrlMatch[2];
  }
  const normalized = base64Payload.replace(/\s/g, "");
  if (
    normalized.length < 40 ||
    normalized.length % 4 !== 0 ||
    !/^[a-z0-9+/=]+$/i.test(normalized)
  ) {
    return null;
  }
  try {
    const buffer = Buffer.from(normalized, "base64");
    if (!buffer || !buffer.length) return null;
    return { buffer, mime };
  } catch (err) {
    return null;
  }
};

const saveBase64Avatar = async (userId, parsed) => {
  if (!parsed) return null;
  const ext = mimeToExt[parsed.mime] || ".png";
  const finalFilename = buildUserAvatarFilename(userId, ext);
  const finalPath = path.join(avatarDir, finalFilename);
  const publicPath = `/uploads/avatars/${finalFilename}`;
  await fs.promises.writeFile(finalPath, parsed.buffer);
  await User.setUserAvatar(userId, publicPath);
  return publicPath;
};

const register = async (req, res) => {
  const {
    username,
    password,
    firstName,
    lastName,
    email,
    phone,
    rank,
    profileImage,
    birthDate,
    fullAddress,
    emergencyContactName,
    emergencyContactPhone,
    role,
    education,
    position,
    medicalHistory,
    avatar,
    isActive,
    division,
  } = req.body;

  const localFilePath = tryPickupLocalFileFromBody(req.body);
  const base64Image = parseBase64Image(profileImage || avatar);
  const fullAddressValue =
    fullAddress === undefined || fullAddress === null
      ? ""
      : String(fullAddress).trim();
  const requiredFields = [
    { key: "username", value: username },
    { key: "password", value: password },
    { key: "firstName", value: firstName },
    { key: "lastName", value: lastName },
    { key: "email", value: email },
    { key: "phone", value: phone },
    { key: "rank", value: rank },
  ];
  const missing = requiredFields
    .filter(({ value }) => value === undefined || value === null || value === "")
    .map(({ key }) => key);
  const normalizedRole = role ? String(role).trim().toUpperCase() : "";
  if (normalizedRole === "TEACHER" && (!division || String(division).trim() === "")) {
    missing.push("division");
  }
  const hasUploadedAvatar =
    Boolean(profileImage) ||
    Boolean(avatar) ||
    Boolean(req.file) ||
    Boolean(localFilePath) ||
    Boolean(base64Image);
  if (!hasUploadedAvatar) {
    missing.push("profileImage");
  }
  if (missing.length) {
    return res
      .status(400)
      .json({ message: `ข้อมูลไม่ครบถ้วน: ต้องมี ${missing.join(", ")}` });
  }
  const passwordString =
    password === undefined || password === null ? "" : String(password);
  if (passwordString.length < 8) {
    return res
      .status(400)
      .json({ message: "รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร" });
  }

  try {
    const avatarPayload =
      req.file || localFilePath || base64Image
        ? undefined
        : profileImage || avatar;
    const newUser = await User.createUser({
      username,
      password,
      firstName,
      lastName,
      email,
      phone,
      rank,
      profileImage: avatarPayload,
      birthDate,
      fullAddress: fullAddressValue,
      emergencyContactName,
      emergencyContactPhone,
      role,
      education,
      position,
      medicalHistory,
      avatar: avatarPayload,
      isActive,
      division,
    });
    if (req.file) {
      try {
        await finalizeAvatarUpload(newUser.id, req.file);
      } catch (avatarErr) {
        console.error("Failed to finalize avatar upload:", avatarErr);
      }
    }
    if (localFilePath) {
      try {
        await copyAvatarFromLocalPath(newUser.id, localFilePath);
      } catch (avatarErr) {
        console.error("Failed to copy avatar from provided path:", avatarErr);
      }
    }
    if (base64Image) {
      try {
        await saveBase64Avatar(newUser.id, base64Image);
      } catch (avatarErr) {
        console.error("Failed to save avatar from base64 payload:", avatarErr);
      }
    }
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    if (req.file) {
      await cleanupUploadedFile(req.file);
    }
    // Prisma unique constraint หรือ validation อื่น ๆ
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "P2002") {
      // P2002: Unique constraint failed
      return res
        .status(409)
        .json({ message: "ข้อมูล (username/email/phone) ซ้ำในระบบ" });
    }
    console.error("Register error:", err);
    res
      .status(500)
      .json({ message: "Error registering user", detail: err.message });
  }
};

const login = async (req, res) => {
  const { username, password } = req.body; // รับข้อมูล username และ password จาก body ของ request
  try {
    const user = await User.findUserByUsername(username); // ค้นหาผู้ใช้จากชื่อผู้ใช้
    if (!user) {
      // หากไม่พบผู้ใช้
      registerLoginFailure(req);
      return res.status(401).json({ message: "Invalid username or password" });
    }
    // หากรหัสผ่านไม่ตรงกับที่เก็บไว้ในฐานข้อมูล
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      registerLoginFailure(req);
      return res.status(401).json({ message: "Invalid username or password" });
    }
    // บล็อกผู้ใช้ที่ถูกปิดการใช้งานไม่ให้เข้าสู่ระบบ
    if (user.isActive === false) {
      return res.status(403).json({ message: "บัญชีผู้ใช้นี้ถูกปิดการใช้งาน" });
    }
    const tokens = await issueTokensForUser(user);
    registerLoginSuccess(req);
    res.json(buildLoginResponse(user, tokens));
  } catch (err) {
    // หากเกิดข้อผิดพลาดในการเข้าสู่ระบบ
    res.status(500).json({ message: "Error logging in" });
  }
};

const refreshToken = async (req, res) => {
  const providedToken =
    (req.body && (req.body.refreshToken || req.body.refresh_token || req.body.token)) ||
    req.headers["x-refresh-token"];

  if (!providedToken || typeof providedToken !== "string") {
    return res.status(400).json({ message: "ต้องระบุ refreshToken" });
  }

  const hashedToken = hashRefreshToken(providedToken.trim());

  try {
    const user = await User.findUserByRefreshTokenHash(hashedToken);
    if (!user) {
      return res.status(401).json({ message: "refresh token ไม่ถูกต้อง" });
    }
    if (user.isActive === false) {
      await User.clearRefreshTokenForUser(user.id);
      return res.status(403).json({ message: "บัญชีผู้ใช้นี้ถูกปิดการใช้งาน" });
    }
    if (
      !user.refreshTokenExpiresAt ||
      user.refreshTokenExpiresAt.getTime() < Date.now()
    ) {
      await User.clearRefreshTokenForUser(user.id);
      return res.status(401).json({ message: "refresh token หมดอายุ" });
    }

    const tokens = await issueTokensForUser(user);
    res.json(buildLoginResponse(user, tokens));
  } catch (err) {
    console.error("Refresh token error:", err);
    res.status(500).json({ message: "Error refreshing token" });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
};
