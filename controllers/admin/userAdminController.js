const User = require("../../models/userModel");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const { buildUserProfilePdfBuffer } = require("../../utils/pdf/userProfilePdf");
const {
  buildUserAvatarFilename,
  tryPickupLocalFileFromBody,
} = require("../../utils/avatar");

const avatarDir = path.join(__dirname, "..", "..", "uploads", "avatars");
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

const mimeToExt = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
};

const cleanupUploadedFile = async (file) => {
  if (!file || !file.path) return;
  try {
    if (fs.existsSync(file.path)) {
      await fs.promises.unlink(file.path);
    }
  } catch {}
};

const finalizeAvatarUpload = async (userId, file) => {
  if (!file || !file.filename) return null;
  const extFromFile = path.extname(file.filename);
  const extFromOriginal = path.extname(file.originalname || "");
  const ext = extFromFile || extFromOriginal || ".png";
  const finalFilename = buildUserAvatarFilename(userId, ext);
  const finalPath = path.join(avatarDir, finalFilename);
  const publicPath = `/uploads/avatars/${finalFilename}`;

  if (file.path !== finalPath) {
    if (fs.existsSync(finalPath)) {
      await fs.promises.unlink(finalPath);
    }
    await fs.promises.rename(file.path, finalPath);
  }
  await User.setUserAvatar(userId, publicPath);
  return publicPath;
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
  } catch {
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

const adminUpdateUser = async (req, res) => {
  const targetId = req.params && req.params.id;
  if (!targetId) {
    return res
      .status(400)
      .json({ message: "ต้องระบุ id ผู้ใช้ใน URL (/admin/users/:id)" });
  }
  try {
    const input = { ...req.body };
    if (input.studentClassYear !== undefined) {
      const rawYear = input.studentClassYear;
      const normalizedYear =
        rawYear === null || String(rawYear).trim() === ""
          ? null
          : Number(rawYear);
      input.studentClassYear = normalizedYear;
    }
    if (input.password) {
      input.passwordHash = await bcrypt.hash(String(input.password), 10);
      delete input.password;
    }
    const updated = await User.updateUserByAdmin(targetId, input);
    res.json(updated);
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "P2002") {
      return res
        .status(409)
        .json({ message: "ข้อมูลซ้ำ (username/email/phone)" });
    }
    res.status(500).json({ message: "Error updating user" });
  }
};

const adminGetAllUsers = async (req, res) => {
  try {
    const {
      page,
      pageSize,
      search,
      role,
      division,
      isOnOfficialDuty,
      isAnnualHealthCheckDone,
    } = req.query || {};
    const result = await User.listUsers({
      page,
      pageSize,
      search,
      role,
      division,
      isOnOfficialDuty,
      isAnnualHealthCheckDone,
    });
    const totalPages = Math.ceil(result.total / result.pageSize) || 1;
    res.json({
      data: result.items,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages,
    });
  } catch (err) {
    console.error("adminGetAllUsers failed:", err);
    res
      .status(500)
      .json({ message: "Error fetching users", detail: err?.message });
  }
};

const adminGetUsersByDivision = async (req, res) => {
  const divisionId =
    (req.params && req.params.id) || (req.params && req.params.division);
  const divisionValue = divisionId ? String(divisionId).trim() : "";
  if (!divisionValue) {
    return res
      .status(400)
      .json({ message: "ต้องระบุ division id (/admin/division/:id)" });
  }
  try {
    const { page, pageSize, search, role, isOnOfficialDuty, isAnnualHealthCheckDone } =
      req.query || {};
    const result = await User.listUsers({
      page,
      pageSize,
      search,
      role,
      division: divisionValue,
      isOnOfficialDuty,
      isAnnualHealthCheckDone,
      onlyWithDivision: true,
    });
    const totalPages = Math.ceil(result.total / result.pageSize) || 1;
    return res.json({
      data: result.items,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages,
      division: divisionValue,
    });
  } catch (err) {
    console.error("adminGetUsersByDivision failed:", err);
    return res.status(500).json({
      message: "Error fetching division users",
      detail: err?.message,
    });
  }
};

const adminGetDivisionSummary = async (_req, res) => {
  try {
    const summary = await User.getDivisionSummary();
    return res.json({ data: summary });
  } catch (err) {
    console.error("adminGetDivisionSummary failed:", err);
    return res.status(500).json({
      message: "Error fetching division summary",
      detail: err?.message,
    });
  }
};

const adminGetRoleSummary = async (_req, res) => {
  try {
    const summary = await User.getRoleSummary();
    return res.json({ data: summary });
  } catch (err) {
    console.error("adminGetRoleSummary failed:", err);
    return res.status(500).json({
      message: "Error fetching role summary",
      detail: err?.message,
    });
  }
};

// Admin: list only STUDENT
const adminGetAllStudents = async (req, res) => {
  try {
    const { page, pageSize, search } = req.query || {};
    const result = await User.listUsers({ page, pageSize, search, role: "STUDENT" });
    const totalPages = Math.ceil(result.total / result.pageSize) || 1;
    res.json({ data: result.items, page: result.page, pageSize: result.pageSize, total: result.total, totalPages });
  } catch (err) {
    res.status(500).json({ message: "Error fetching students" });
  }
};

// Admin: list only TEACHER
const adminGetAllTeachers = async (req, res) => {
  try {
    const { page, pageSize, search } = req.query || {};
    const result = await User.listUsers({ page, pageSize, search, role: "TEACHER" });
    const totalPages = Math.ceil(result.total / result.pageSize) || 1;
    res.json({ data: result.items, page: result.page, pageSize: result.pageSize, total: result.total, totalPages });
  } catch (err) {
    res.status(500).json({ message: "Error fetching teachers" });
  }
};

const adminGetUserById = async (req, res) => {
  const targetId = req.params && req.params.id;
  if (!targetId)
    return res.status(400).json({ message: "ต้องระบุ id ผู้ใช้ใน URL" });
  try {
    const user = await User.getUserAdminDetail(targetId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Error fetching user" });
  }
};

const adminSearchUserPersonalInfo = async (req, res) => {
  const { q, query, limit } = req.query || {};
  const keyword = q !== undefined ? q : query;
  try {
    const result = await User.searchUserPersonalInfo({
      query: keyword,
      limit,
    });
    res.json({
      data: result.items,
      total: result.total,
    });
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    res
      .status(500)
      .json({ message: "Error searching user personal info", detail: err.message });
  }
};

const buildRoleDetailGetter =
  ({ expectRole, roleLabel, errorMessage }) =>
  async (req, res) => {
    const targetId = req.params && req.params.id;
    if (!targetId) {
      return res.status(400).json({ message: "ต้องระบุ id ผู้ใช้ใน URL" });
    }
    try {
      const user = await User.getUserById(targetId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.role !== expectRole) {
        return res.status(400).json({ message: errorMessage });
      }
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: `Error fetching ${roleLabel}` });
    }
  };

const adminGetTeacherById = buildRoleDetailGetter({
  expectRole: "TEACHER",
  roleLabel: "teacher",
  errorMessage: "ผู้ใช้นี้ไม่ได้มีบทบาทครูผู้สอน",
});

const adminGetStudentById = buildRoleDetailGetter({
  expectRole: "STUDENT",
  roleLabel: "student",
  errorMessage: "ผู้ใช้นี้ไม่ได้มีบทบาทนักเรียน",
});

const adminCreateUser = async (req, res) => {
  const localFilePath = tryPickupLocalFileFromBody(req.body);
  const base64Image = parseBase64Image(
    (req.body && (req.body.profileImage || req.body.avatar)) || ""
  );
  const userInput = { ...req.body };
  if (req.file || localFilePath || base64Image) {
    delete userInput.profileImage;
    delete userInput.avatar;
  }
  try {
    const created = await User.createUser(userInput);
    if (req.file) {
      try {
        await finalizeAvatarUpload(created.id, req.file);
      } catch (avatarErr) {
        console.error("Admin finalize avatar error:", avatarErr);
      }
    }
    if (localFilePath) {
      try {
        await copyAvatarFromLocalPath(created.id, localFilePath);
      } catch (avatarErr) {
        console.error("Admin copy avatar error:", avatarErr);
      }
    }
    if (base64Image) {
      try {
        await saveBase64Avatar(created.id, base64Image);
      } catch (avatarErr) {
        console.error("Admin base64 avatar error:", avatarErr);
      }
    }
    const user = await User.getUserById(created.id);
    res.status(201).json(user);
  } catch (err) {
    if (req.file) {
      await cleanupUploadedFile(req.file);
    }
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "P2002") {
      return res
        .status(409)
        .json({ message: "ข้อมูลซ้ำ (username/email/phone)" });
    }
    res.status(500).json({ message: "Error creating user" });
  }
};

const adminDeactivateUser = async (req, res) => {
  const targetId = req.params && req.params.id;
  if (!targetId)
    return res.status(400).json({ message: "ต้องระบุ id ผู้ใช้ใน URL" });
  const idNum = Number(targetId);
  if (!Number.isInteger(idNum))
    return res.status(400).json({ message: "id ต้องเป็นจำนวนเต็ม" });
  try {
    const user = await User.deactivateUser(idNum);
    res.json({ message: "ปิดการใช้งานผู้ใช้สำเร็จ", user });
  } catch (err) {
    if (err.code === "P2025")
      return res.status(404).json({ message: "User not found" });
    res.status(500).json({ message: "Error deactivating user" });
  }
};

const adminActivateUser = async (req, res) => {
  const targetId = req.params && req.params.id;
  if (!targetId)
    return res.status(400).json({ message: "ต้องระบุ id ผู้ใช้ใน URL" });
  const idNum = Number(targetId);
  if (!Number.isInteger(idNum))
    return res.status(400).json({ message: "id ต้องเป็นจำนวนเต็ม" });
  try {
    const user = await User.activateUser(idNum);
    res.json({ message: "เปิดการใช้งานผู้ใช้สำเร็จ", user });
  } catch (err) {
    if (err.code === "P2025")
      return res.status(404).json({ message: "User not found" });
    res.status(500).json({ message: "Error activating user" });
  }
};

const adminUploadAvatar = async (req, res) => {
  const targetId = req.params && req.params.id;
  if (!targetId)
    return res.status(400).json({ message: "ต้องระบุ id ผู้ใช้ใน URL" });
  const idNum = Number(targetId);
  if (!Number.isInteger(idNum)) {
    return res.status(400).json({ message: "id ต้องเป็นจำนวนเต็ม" });
  }
  try {
    let filenameOnDisk = req.file && req.file.filename;
    if (!filenameOnDisk) {
      const localPath = tryPickupLocalFileFromBody(req.body);
      if (localPath) {
        const uploadsDir = path.join(__dirname, "..", "..", "uploads", "avatars");
        if (!fs.existsSync(uploadsDir))
          fs.mkdirSync(uploadsDir, { recursive: true });
        const ext = path.extname(localPath).toLowerCase();
        filenameOnDisk = buildUserAvatarFilename(idNum, ext);
        fs.copyFileSync(localPath, path.join(uploadsDir, filenameOnDisk));
      }
    }
    if (!filenameOnDisk) {
      return res
        .status(400)
        .json({ message: "ไม่พบไฟล์ที่อัปโหลด (ฟิลด์ 'avatar')" });
    }
    const exists = await User.getUserById(idNum);
    if (!exists) {
      try {
        const p = path.join(
          __dirname,
          "..",
          "..",
          "uploads",
          "avatars",
          filenameOnDisk
        );
        fs.existsSync(p) && fs.unlinkSync(p);
      } catch {}
      return res.status(404).json({ message: "User not found" });
    }

    const publicPath = `/uploads/avatars/${filenameOnDisk}`;
    const updated = await User.setUserAvatar(idNum, publicPath);
    if (exists.avatar && exists.avatar !== publicPath) {
      const oldFile = path.join(
        __dirname,
        "..",
        "..",
        exists.avatar.replace(/^\//, "")
      );
      try {
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      } catch {}
    }
    res.status(200).json({
      message: "อัปโหลดรูปโปรไฟล์ผู้ใช้สำเร็จ",
      avatar: publicPath,
      user: updated,
    });
  } catch (err) {
    try {
      if (req.file && req.file.filename) {
        const p = path.join(
          __dirname,
          "..",
          "..",
          "uploads",
          "avatars",
          req.file.filename
        );
        fs.existsSync(p) && fs.unlinkSync(p);
      }
    } catch {}
    if (err.code === "P2025") {
      return res.status(404).json({ message: "User not found" });
    }
    res
      .status(500)
      .json({ message: "Error uploading avatar", detail: err.message });
  }
};

const adminExportUserPersonPdf = async (req, res) => {
  const targetId = req.params && req.params.id;
  if (!targetId) {
    return res
      .status(400)
      .json({ message: "ต้องระบุ id ผู้ใช้ใน URL (/admin/users/person/:id)" });
  }
  const idNum = Number(targetId);
  if (!Number.isInteger(idNum)) {
    return res.status(400).json({ message: "id ต้องเป็นจำนวนเต็ม" });
  }

  try {
    const user = await User.getUserAdminDetail(idNum);
    if (!user) return res.status(404).json({ message: "User not found" });

    const buffer = await buildUserProfilePdfBuffer(user);

    const displayName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    const asciiSafe = displayName
      .normalize("NFKD")
      .replace(/[^\w\s.-]/g, "")
      .trim();
    const safeName = (asciiSafe || `user_${idNum}`).replace(/\s+/g, "_");
    const fileName = `${safeName}-profile.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (err) {
    console.error("Failed to export user profile pdf", err);
    return res.status(500).json({
      message: "ไม่สามารถส่งออก PDF รายบุคคลได้",
      detail: err.message,
    });
  }
};

module.exports = {
  adminUpdateUser,
  adminGetAllUsers,
  adminGetAllStudents,
  adminGetAllTeachers,
  adminGetTeacherById,
  adminGetStudentById,
  adminGetUserById,
  adminGetUsersByDivision,
  adminGetDivisionSummary,
  adminGetRoleSummary,
  adminSearchUserPersonalInfo,
  adminCreateUser,
  adminDeactivateUser,
  adminActivateUser,
  adminUploadAvatar,
  adminExportUserPersonPdf,
};
