const prisma = require("../utils/prisma");

const baseSelect = {
  id: true,
  title: true,
  url: true,
  platform: true,
  isActive: true,
  displayOrder: true,
  createdAt: true,
  updatedAt: true,
};

const validationError = (message) => {
  const err = new Error(message);
  err.code = "VALIDATION_ERROR";
  return err;
};

const notFoundError = () => {
  const err = new Error("ไม่พบวิดีโอที่ต้องการ");
  err.code = "NOT_FOUND";
  return err;
};

const normalizeString = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : undefined;
};

const parseId = (id) => {
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw validationError("id ต้องเป็นจำนวนเต็มบวก");
  }
  return numeric;
};

const parseBoolean = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  throw validationError("isActive ต้องเป็นค่า true/false");
};

const parseDisplayOrder = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw validationError("displayOrder ต้องเป็นจำนวนเต็มศูนย์ขึ้นไป หรือไม่ต้องส่งฟิลด์นี้");
  }
  return numeric;
};

const normalizePlatform = (value) => {
  if (value === undefined || value === null) return undefined;
  const upper = String(value).trim().toUpperCase();
  if (upper === "YOUTUBE" || upper === "TIKTOK") return upper;
  throw validationError("platform ต้องเป็น YOUTUBE หรือ TIKTOK");
};

const detectPlatformFromUrl = (url) => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("youtube.com") || host === "youtu.be") return "YOUTUBE";
    if (host.includes("tiktok.com")) return "TIKTOK";
  } catch {
    // ignore parse errors here; caller will handle
  }
  return null;
};

const normalizeUrl = (value) => {
  const urlString = normalizeString(value);
  if (!urlString) {
    throw validationError("ต้องระบุ url");
  }
  let normalized;
  try {
    const parsed = new URL(urlString);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("protocol");
    }
    normalized = parsed.toString();
  } catch {
    throw validationError("url ต้องเป็นลิงก์ http/https ที่ถูกต้อง");
  }
  const detectedPlatform = detectPlatformFromUrl(normalized);
  if (!detectedPlatform) {
    throw validationError("url ต้องเป็นลิงก์ของ YouTube หรือ TikTok เท่านั้น");
  }
  return { normalizedUrl: normalized, detectedPlatform };
};

const normalizeCreateInput = (input = {}) => {
  const { normalizedUrl, detectedPlatform } = normalizeUrl(input.url);
  const platform = normalizePlatform(input.platform) || detectedPlatform;
  if (platform !== detectedPlatform) {
    throw validationError("url ไม่ตรงกับ platform ที่เลือก");
  }

  const title =
    normalizeString(input.title) ||
    (platform === "YOUTUBE" ? "YouTube video" : "TikTok video");

  const isActive = parseBoolean(input.isActive);
  const displayOrder = parseDisplayOrder(input.displayOrder);

  return {
    title,
    url: normalizedUrl,
    platform,
    isActive: isActive !== undefined ? isActive : true,
    displayOrder: displayOrder === undefined ? null : displayOrder,
  };
};

const normalizeUpdateInput = (input = {}, existing) => {
  const data = {};

  let detectedPlatform;
  if (input.url !== undefined) {
    const result = normalizeUrl(input.url);
    data.url = result.normalizedUrl;
    detectedPlatform = result.detectedPlatform;
  }

  if (input.title !== undefined) {
    const title = normalizeString(input.title);
    if (!title) {
      throw validationError("title ต้องไม่ว่าง");
    }
    data.title = title;
  }

  if (input.isActive !== undefined) {
    const active = parseBoolean(input.isActive);
    if (active !== undefined) {
      data.isActive = active;
    }
  }

  if (input.displayOrder !== undefined) {
    const order = parseDisplayOrder(input.displayOrder);
    data.displayOrder = order;
  }

  const platformInput = normalizePlatform(input.platform);

  const finalUrl = data.url ?? existing.url;
  const urlPlatform = detectedPlatform || detectPlatformFromUrl(finalUrl);
  const finalPlatform =
    platformInput ??
    (data.url ? urlPlatform : undefined) ??
    existing.platform ??
    urlPlatform;

  if (!finalPlatform) {
    throw validationError("ต้องระบุ platform หรือส่ง url จาก YouTube/TikTok");
  }
  if (urlPlatform && finalPlatform !== urlPlatform) {
    throw validationError("url ไม่ตรงกับ platform ที่เลือก");
  }

  data.platform = finalPlatform;

  if (Object.keys(data).length === 0) {
    throw validationError("ไม่มีข้อมูลที่สามารถแก้ไขได้");
  }

  return data;
};

module.exports = {
  listVideoLinks: async (filters = {}) => {
    const where = {};
    const includeInactive = parseBoolean(filters.includeInactive);
    if (includeInactive !== true) {
      where.isActive = true;
    }
    const platform = normalizePlatform(filters.platform);
    if (platform) {
      where.platform = platform;
    }

    return prisma.videoLink.findMany({
      where,
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      select: baseSelect,
    });
  },

  createVideoLink: async (input = {}) => {
    const data = normalizeCreateInput(input);
    return prisma.videoLink.create({
      data,
      select: baseSelect,
    });
  },

  updateVideoLink: async (id, input = {}) => {
    const linkId = parseId(id);
    const existing = await prisma.videoLink.findUnique({
      where: { id: linkId },
      select: baseSelect,
    });
    if (!existing) {
      throw notFoundError();
    }

    const data = normalizeUpdateInput(input, existing);
    return prisma.videoLink.update({
      where: { id: linkId },
      data,
      select: baseSelect,
    });
  },
};
