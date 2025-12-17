const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");
const SoldierIntake = require("../models/soldierIntakeModel");
const FeatureToggle = require("../models/featureToggleModel");
const { ChildProcess } = require("child_process");

const ID_CARD_PUBLIC_PREFIX = "/uploads/idcards";
const ID_CARD_STORAGE_DIR = path.join(__dirname, "..", "uploads", "idcards");
const THAI_FONT_PATH = path.join(
  __dirname,
  "..",
  "assets",
  "fonts",
  "Kanit-Regular.ttf"
);
const LOGO_PATH = path.join(__dirname, "..", "assets", "logo.jpg");

const toPublicPath = (file) => {
  if (!file) return undefined;
  return `${ID_CARD_PUBLIC_PREFIX}/${file.filename}`.replace(/\\/g, "/");
};

const deleteIfExists = (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn("Failed to delete file:", filePath, err.message);
  }
};

const padTwo = (value) => String(value ?? "").padStart(2, "0");

const formatDateOnly = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(
    date.getDate()
  )}`;
};

const TH_MONTH_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

const formatDateThaiShort = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.getDate();
  const month = TH_MONTH_SHORT[date.getMonth()] || "";
  const year = date.getFullYear() + 543;
  return `${day} ${month} ${year}`;
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatDateOnly(date)} ${padTwo(date.getHours())}:${padTwo(
    date.getMinutes()
  )}:${padTwo(date.getSeconds())}`;
};

const formatDateTimeThai = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  // แปลงเป็นเวลาไทย (UTC+7)
  const TH_OFFSET_HOURS = 7;
  const thMs = date.getTime() + TH_OFFSET_HOURS * 60 * 60 * 1000;
  const thDate = new Date(thMs);

  const day = thDate.getUTCDate();
  const month = TH_MONTH_SHORT[thDate.getUTCMonth()] || "";
  const year = thDate.getUTCFullYear() + 543;
  const hh = padTwo(thDate.getUTCHours());
  const mm = padTwo(thDate.getUTCMinutes());

  return `${day} ${month} ${year} เวลา ${hh}:${mm}`;
};

const formatServiceYearsDisplay = (value) => {
  if (value === null || value === undefined) return "-";
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  if (num === 0.6) return "6 เดือน";
  if (num === 1) return "1 ปี";
  if (num === 2) return "2 ปี";
  return num;
};

const formatListField = (value) => {
  if (Array.isArray(value)) {
    return value.filter((item) => item != null && item !== "").join(", ");
  }
  if (value === undefined || value === null) return "";
  return String(value);
};

const formatBooleanLabel = (value) => {
  if (value === true) return "ใช่";
  if (value === false) return "ไม่";
  return "";
};

const normalizePresenceFilter = (value) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return undefined;
  const positive = new Set(["yes", "y", "true", "1", "has", "มี"]);
  const negative = new Set(["no", "n", "false", "0", "none", "ไม่มี"]);
  if (positive.has(normalized)) return true;
  if (negative.has(normalized)) return false;
  return undefined;
};

const normalizeFilterString = (value) => {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) =>
        item === undefined || item === null ? "" : String(item).trim()
      )
      .filter((item) => item);
    if (!normalized.length) return undefined;
    return normalized.join(", ");
  }
  const text = String(value).trim();
  return text || undefined;
};

const autoFitColumns = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const widths = headers.map((header) => Math.max(header.length, 8));
  rows.forEach((row) => {
    headers.forEach((header, idx) => {
      const cell = row[header];
      const length = cell != null ? String(cell).length : 0;
      if (length > widths[idx]) widths[idx] = length;
    });
  });
  return widths.map((width) => ({ wch: width + 2 }));
};

const createIntake = async (req, res) => {
  const uploaded = req.file;
  try {
    const isOpen = await FeatureToggle.getSoldierIntakeStatus();
    if (!isOpen) {
      deleteIfExists(uploaded?.path);
      return res.status(403).json({ message: "ปิดรับแบบฟอร์มแล้ว" });
    }
    const payload = { ...req.body, idCardImageUrl: toPublicPath(uploaded) };
    const created = await SoldierIntake.createIntake(payload);
    return res.status(201).json({ data: created });
  } catch (err) {
    deleteIfExists(uploaded?.path);
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "MIGRATION_REQUIRED") {
      return res.status(500).json({
        message:
          "ยังไม่ได้ setup ตาราง SoldierIntake (โปรดรัน prisma migrate/generate)",
      });
    }
    console.error("Failed to create soldier intake", err);
    return res
      .status(500)
      .json({ message: "ไม่สามารถบันทึกข้อมูลได้", detail: err.message });
  }
};

const mapRoleToUnitFilter = (role) => {
  if (!role || typeof role !== "string") return null;

  const match = /^BAT(\d+)_COM(\d+)$/.exec(role);
  if (!match) return null;

  return {
    battalionCode: String(Number(match[1])),
    companyCode: String(Number(match[2])),
  };
};

const buildExportFilters = (req) => {
  const filters = { ...(req.query || {}) };

  // normalize common string filters
  const normalize = (val) =>
    val === undefined || val === null ? undefined : String(val).trim();
  if (filters.battalionCode !== undefined) {
    const value = normalize(filters.battalionCode);
    filters.battalionCode = value || undefined;
  }
  if (filters.companyCode !== undefined) {
    const value = normalize(filters.companyCode);
    filters.companyCode = value || undefined;
  }
  const unitFilter = mapRoleToUnitFilter(req.userRole);

  if (unitFilter) {
    filters.battalionCode = unitFilter.battalionCode;
    filters.companyCode = unitFilter.companyCode;
  }

  // province filter: expect numeric province id
  const provinceRaw = req.query.provinceFilter;
  const provinceCode =
    provinceRaw === undefined || provinceRaw === null || provinceRaw === ""
      ? undefined
      : Number(provinceRaw);
  if (provinceCode !== undefined && Number.isInteger(provinceCode)) {
    filters.province = String(provinceCode);
  } else {
    delete filters.province;
  }
  delete filters.provinceFilter;

  return filters;
};

const getExportIntakeRecords = async (req, res) => {
  const filters = buildExportFilters(req);
  const records = await SoldierIntake.getIntakesForExport(filters);
  if (!records.length) {
    res.status(404).json({ message: "ไม่พบข้อมูลทหารใหม่สำหรับส่งออก" });
    return null;
  }
  return records;
};

const applyThaiFontIfAvailable = (doc) => {
  try {
    if (fs.existsSync(THAI_FONT_PATH)) {
      doc.font(THAI_FONT_PATH);
      return true;
    }
  } catch (err) {
    console.warn("ไม่สามารถโหลดฟอนต์ภาษาไทยได้", err.message);
  }
  return false;
};

const parseOrientation = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  const portrait = new Set(["portrait", "p", "vertical", "v"]);
  return portrait.has(normalized) ? "portrait" : "landscape";
};

const drawLogoIfAvailable = (doc) => {
  try {
    if (!fs.existsSync(LOGO_PATH)) return;
    const maxSize = 80;
    const availableWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const x = doc.page.margins.left + (availableWidth - maxSize) / 2;
    const startY = doc.y;
    doc.image(LOGO_PATH, x, startY, { fit: [maxSize, maxSize] });
    // ย้าย cursor ลงต่ำกว่ารูปเพื่อไม่ให้ทับข้อความ
    doc.y = startY + maxSize + 10;
  } catch (err) {
    console.warn("ไม่สามารถแสดงโลโก้ได้", err.message);
  }
};

const renderCoverPage = (doc, exportedAt, filters = {}) => {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margins = doc.page.margins;
  const contentWidth = pageWidth - margins.left - margins.right;

  const hasLogo = fs.existsSync(LOGO_PATH);
  const logoSize = hasLogo ? 80 : 0;
  const logoGap = hasLogo ? 12 : 0;

  const title = "รายการทหารใหม่";
  const subtitle = "RTcas (Recruit Training Center Academic System)";
  const meta = `สร้างเมื่อ: ${exportedAt}`;
  const unitLine =
    filters.battalionCode || filters.companyCode
      ? `กองพันฝึกที่ ${filters.battalionCode || "-"} กองร้อยฝึกที่ ${
          filters.companyCode || "-"
        }`
      : null;

  const titleHeight = doc.heightOfString(title, {
    width: contentWidth,
    align: "center",
  });
  const subtitleHeight = doc.heightOfString(subtitle, {
    width: contentWidth,
    align: "center",
  });
  const metaHeight = doc.heightOfString(meta, {
    width: contentWidth,
    align: "center",
  });
  const unitHeight = unitLine
    ? doc.heightOfString(unitLine, { width: contentWidth, align: "center" })
    : 0;

  const blockHeight =
    logoSize +
    logoGap +
    titleHeight +
    8 +
    subtitleHeight +
    (unitLine ? 6 + unitHeight : 0) +
    6 +
    metaHeight;

  const availableHeight = pageHeight - margins.top - margins.bottom;
  const startY = margins.top + Math.max(0, (availableHeight - blockHeight) / 2);

  let cursorY = startY;
  if (hasLogo) {
    const x = margins.left + (contentWidth - logoSize) / 2;
    doc.image(LOGO_PATH, x, cursorY, { fit: [logoSize, logoSize] });
    cursorY += logoSize + logoGap;
  }

  doc.y = cursorY;
  doc.fontSize(16).fillColor("#000").text(title, {
    align: "center",
    width: contentWidth,
  });
  doc.moveDown(0.2);
  doc.fontSize(12).fillColor("#000").text(subtitle, {
    align: "center",
    width: contentWidth,
  });
  if (unitLine) {
    doc.moveDown(0.2);
    doc.fontSize(11).fillColor("#000").text(unitLine, {
      align: "center",
      width: contentWidth,
    });
  }
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor("#444").text(meta, {
    align: "center",
    width: contentWidth,
  });
};

const resolveIdCardFilePath = (url) => {
  if (!url) return null;
  // strip domain if present, keep path
  const withoutDomain = url.replace(/^https?:\/\/[^/]+/i, "");
  const relative = withoutDomain.startsWith(ID_CARD_PUBLIC_PREFIX)
    ? withoutDomain.slice(ID_CARD_PUBLIC_PREFIX.length)
    : withoutDomain;
  const normalized = relative.replace(/^[/\\]+/, "");
  if (!normalized) return null;
  return path.join(ID_CARD_STORAGE_DIR, normalized);
};

const buildIntakesPdfBuffer = (records = [], options = {}) =>
  new Promise((resolve, reject) => {
    const layout = parseOrientation(options.orientation);
    const doc = new PDFDocument({ size: "A4", margin: 36, layout });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    applyThaiFontIfAvailable(doc);

    doc.info.Title = "รายการทหารใหม่";
    doc.info.Author = "RTCAS ระบบรับทหารใหม่";

    const exportedAt = formatDateTimeThai(new Date());
    const coverFilters = options.filters || {};
    renderCoverPage(doc, exportedAt, coverFilters);
    doc.addPage({ size: "A4", margin: 36, layout });

    const addField = (label, value) => {
      const display =
        value === undefined || value === null || value === ""
          ? "-"
          : String(value);
      doc.fontSize(10).fillColor("#111");
      doc.text(`${label}: ${display}`);
    };

    records.forEach((item, index) => {
      const fullName = `${item.firstName || ""} ${item.lastName || ""}`.trim();
      const chronicText = formatListField(item.chronicDiseases);
      const foodAllergy = formatListField(item.foodAllergies);
      const drugAllergy = formatListField(item.drugAllergies);
      const allergyText = [foodAllergy, drugAllergy]
        .filter((v) => v)
        .join(", ");

      doc
        .fillColor("#000")
        .fontSize(12)
        .text(`${index + 1}. ${fullName || "-"}`);

      doc.moveDown(0.2);
      addField("เลขบัตร", item.citizenId);
      addField("วันเกิด", formatDateThaiShort(item.birthDate));
      addField("อายุราชการ", formatServiceYearsDisplay(item.serviceYears));

      doc.moveDown(0.2);
      addField(
        "สังกัด",
        `กองพัน ${item.battalionCode || "-"} / กองร้อย ${
          item.companyCode || "-"
        } / หมวด ${item.platoonCode ?? "-"} / ลำดับ ${
          item.sequenceNumber ?? "-"
        }`
      );
      addField("การศึกษา", item.education || "-");
      addField("กรุ๊ปเลือด", item.bloodGroup || "-");
      addField(
        "สุขภาพ",
        `ว่ายน้ำ: ${formatBooleanLabel(item.canSwim) || "-"} | รอยสัก: ${
          formatBooleanLabel(item.tattoo) || "-"
        } | พร้อมรบ: ${
          item.combatReadiness?.score ?? item.combatReadiness?.percent ?? "-"
        }${
          Number.isFinite(item.combatReadiness?.score)
            ? ` (${Math.round((item.combatReadiness.score / 500) * 100)}%)`
            : ""
        }`
      );
      addField("โรคประจำตัว", chronicText || "-");
      addField("อาการแพ้", allergyText || "-");
      addField(
        "ทักษะ/อาชีพ",
        `ทักษะ: ${item.specialSkills || "-"} | ก่อนเป็นทหาร: ${
          item.previousJob || "-"
        }`
      );

      doc.moveDown(0.2);
      addField(
        "ที่อยู่",
        `${item.addressLine || "-"} ${item.subdistrict || ""} ${
          item.district || ""
        } ${item.province || ""} ${item.postalCode || ""}`.trim()
      );
      addField(
        "ติดต่อ",
        `${item.phone || "-"}${item.email ? ` | อีเมล: ${item.email}` : ""}`
      );
      addField(
        "ฉุกเฉิน",
        `${item.emergencyName || "-"}${
          item.emergencyPhone ? ` (${item.emergencyPhone})` : ""
        }`
      );
      addField("สร้างเมื่อ", formatDateTimeThai(item.createdAt) || "-");

      doc.moveDown(0.4);
      doc
        .moveTo(doc.x, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .strokeColor("#dddddd")
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(0.6);
    });

    doc.end();
  });
const buildIntakeProfilePdfBuffer = (item) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 36,
      bufferPages: true,
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    applyThaiFontIfAvailable(doc);

    // =========================
    // THEME (professional)
    // =========================
    const ACCENT = "#0f4c81";
    const TEXT = "#0b1221";
    const MUTED = "#6b7280";
    const BORDER = "#e5e7eb";
    const BG = "#ffffff";
    const BG_SOFT = "#f4f7fb";
    const BG_CARD = "#fbfdff";

    const PAGE_W = doc.page.width;
    const PAGE_H = doc.page.height;
    const L = doc.page.margins.left;
    const R = PAGE_W - doc.page.margins.right;
    const CONTENT_W = R - L;

    const LINE_GAP = 2;

    const clampText = (v) =>
      v === undefined || v === null || v === "" ? "-" : String(v);

    const textHeight = (text, width, fontSize) => {
      doc.fontSize(fontSize);
      return doc.heightOfString(String(text ?? ""), {
        width,
        lineGap: LINE_GAP,
      });
    };

    const computeAgeYears = (dateValue) => {
      const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
      if (Number.isNaN(d.getTime())) return null;
      const now = new Date();
      let age = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) {
        age -= 1;
      }
      return age >= 0 ? age : null;
    };

    // -------------------------
    // Helpers: rounded card
    // -------------------------
    const roundRectPath = (x, y, w, h, r = 10) => {
      const rr = Math.min(r, w / 2, h / 2);
      doc
        .moveTo(x + rr, y)
        .lineTo(x + w - rr, y)
        .quadraticCurveTo(x + w, y, x + w, y + rr)
        .lineTo(x + w, y + h - rr)
        .quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
        .lineTo(x + rr, y + h)
        .quadraticCurveTo(x, y + h, x, y + h - rr)
        .lineTo(x, y + rr)
        .quadraticCurveTo(x, y, x + rr, y)
        .closePath();
    };

    const drawCard = ({
      x,
      y,
      w,
      h,
      fill = BG_CARD,
      stroke = BORDER,
      radius = 14,
    }) => {
      doc.save();
      roundRectPath(x, y, w, h, radius);
      doc.fillColor(fill).fill();
      roundRectPath(x, y, w, h, radius);
      doc.strokeColor(stroke).lineWidth(1).stroke();
      doc.restore();
    };

    const drawAccentStripe = (x, y, h) => {
      doc.save();
      roundRectPath(x, y, 6, h, 3);
      doc.fillColor(ACCENT).fill();
      doc.restore();
    };

    // =========================
    // Pagination
    // =========================
    const fullName =
      `พลฯ  ${item.firstName || ""} ${item.lastName || ""}`.trim() || "-";
    const exportedAt = formatDateTimeThai(new Date());

    doc.info.Title = `ข้อมูลทหารใหม่ ${fullName}`;
    doc.info.Author = "RTCAS ระบบรับทหารใหม่";

    const drawMiniHeader = () => {
      // ใช้ header รูปแบบเดียวกับหน้าแรก เพื่อความสม่ำเสมอ
      drawFirstHeader();
    };

    const drawFirstHeader = () => {
      doc.save();
      doc.rect(0, 0, PAGE_W, 78).fill(BG_SOFT);
      doc.rect(0, 0, PAGE_W, 5).fill(ACCENT);
      doc.restore();

      doc.fillColor(TEXT).fontSize(16).text("ข้อมูลทหารใหม่", L, 18);
      doc
        .fillColor(TEXT)
        .fontSize(14)
        .text(fullName, L, 42, { width: CONTENT_W });

      doc
        .fillColor(MUTED)
        .fontSize(9.5)
        .text(`เลขบัตร: ${item.citizenId || "-"}`, L, 20, {
          width: CONTENT_W,
          align: "right",
        });
      doc
        .fillColor(MUTED)
        .fontSize(9.5)
        .text(`ส่งออกเมื่อ: ${exportedAt}`, L, 38, {
          width: CONTENT_W,
          align: "right",
        });

      doc.x = L;
      doc.y = 92;
    };

    const ensureSpace = (minHeight = 60) => {
      if (doc.y + minHeight > PAGE_H - doc.page.margins.bottom) {
        doc.addPage();
        drawMiniHeader();
      }
    };

    // =========================
    // ✅ Pills (fixed row, no stair-step) + Thai labels
    // =========================
    const drawPill = (text, x, y) => {
      const t = String(text || "").trim();
      if (!t) return { w: 0, h: 0 };

      const paddingX = 10;
      const paddingY = 4;

      doc.fontSize(9.5);
      const textW = doc.widthOfString(t);
      const h = doc.currentLineHeight() + paddingY * 2;
      const w = textW + paddingX * 2;

      doc.save();
      roundRectPath(x, y, w, h, 999);
      doc.fillColor(BG_SOFT).fill();
      roundRectPath(x, y, w, h, 999);
      doc.strokeColor(BORDER).lineWidth(1).stroke();
      doc.restore();

      doc
        .fillColor(ACCENT)
        .fontSize(9.5)
        .text(t, x + paddingX, y + paddingY, {
          lineBreak: false,
        });

      return { w, h };
    };

    const drawPillRow = (labels, options = {}) => {
      const startX = options.x ?? L;
      const startY = options.y ?? doc.y;
      const gap = options.gap ?? 8;

      let x = startX;
      let y = startY;
      let maxH = 0;

      for (const label of labels) {
        // วัดคร่าวๆ ก่อน ถ้าล้นค่อยขึ้นบรรทัดใหม่
        doc.fontSize(9.5);
        const w = doc.widthOfString(String(label)) + 10 * 2;
        const h = doc.currentLineHeight() + 4 * 2;

        if (x !== startX && x + w > R) {
          x = startX;
          y += maxH + 6;
          maxH = 0;
        }

        const res = drawPill(label, x, y);
        maxH = Math.max(maxH, res.h);
        x += res.w + gap;
      }

      doc.x = L;
      doc.y = y + maxH + 10;
    };

    // =========================
    // Section Title
    // =========================
    const drawSectionTitle = (title) => {
      ensureSpace(64);

      const x = L;
      const y = doc.y;
      const h = 34;

      drawCard({ x, y, w: CONTENT_W, h, fill: BG_SOFT, radius: 14 });
      drawAccentStripe(x + 10, y + 8, h - 16);

      doc
        .fillColor(ACCENT)
        .fontSize(11.5)
        .text(title, x + 26, y + 11);

      doc.y = y + h + 10;
      doc.x = L;
    };

    // =========================
    // Field Rows (AUTO HEIGHT)
    // =========================
    const drawFieldRow1 = ({ label, value }) => {
      const padX = 14;
      const padY = 10;
      const labelSize = 9.5;
      const valueSize = 10.5;
      const gap = 4;

      const usableW = CONTENT_W - padX * 2;

      const hLabel = textHeight(label || "", usableW, labelSize);
      const hValue = textHeight(clampText(value), usableW, valueSize);
      const rowH = Math.max(38, padY + hLabel + gap + hValue + padY);

      ensureSpace(rowH + 10);

      const x = L;
      const y = doc.y;

      drawCard({ x, y, w: CONTENT_W, h: rowH, fill: BG, radius: 12 });

      doc
        .fillColor(MUTED)
        .fontSize(labelSize)
        .text(label || "", x + padX, y + padY, {
          width: usableW,
          lineGap: LINE_GAP,
        });

      doc
        .fillColor(TEXT)
        .fontSize(valueSize)
        .text(clampText(value), x + padX, y + padY + hLabel + gap, {
          width: usableW,
          lineGap: LINE_GAP,
        });

      doc.y = y + rowH + 10;
      doc.x = L;
    };

    const drawFieldRow2 = ({
      leftLabel,
      leftValue,
      rightLabel,
      rightValue,
    }) => {
      const padX = 14;
      const padY = 10;
      const labelSize = 9.5;
      const valueSize = 10.5;
      const gap = 4;

      const colW = CONTENT_W / 2 - padX * 2;

      const hLL = textHeight(leftLabel || "", colW, labelSize);
      const hLV = textHeight(clampText(leftValue), colW, valueSize);
      const leftH = padY + hLL + gap + hLV + padY;

      const hRL = textHeight(rightLabel || "", colW, labelSize);
      const hRV = textHeight(clampText(rightValue), colW, valueSize);
      const rightH = padY + hRL + gap + hRV + padY;

      const rowH = Math.max(38, leftH, rightH);

      ensureSpace(rowH + 10);

      const x = L;
      const y = doc.y;
      const mid = x + CONTENT_W / 2;

      drawCard({ x, y, w: CONTENT_W, h: rowH, fill: BG, radius: 12 });

      doc.save();
      doc
        .moveTo(mid, y + 10)
        .lineTo(mid, y + rowH - 10)
        .strokeColor(BORDER)
        .lineWidth(1)
        .stroke();
      doc.restore();

      doc
        .fillColor(MUTED)
        .fontSize(labelSize)
        .text(leftLabel || "", x + padX, y + padY, {
          width: colW,
          lineGap: LINE_GAP,
        });
      doc
        .fillColor(TEXT)
        .fontSize(valueSize)
        .text(clampText(leftValue), x + padX, y + padY + hLL + gap, {
          width: colW,
          lineGap: LINE_GAP,
        });

      doc
        .fillColor(MUTED)
        .fontSize(labelSize)
        .text(rightLabel || "", mid + padX, y + padY, {
          width: colW,
          lineGap: LINE_GAP,
        });
      doc
        .fillColor(TEXT)
        .fontSize(valueSize)
        .text(clampText(rightValue), mid + padX, y + padY + hRL + gap, {
          width: colW,
          lineGap: LINE_GAP,
        });

      doc.y = y + rowH + 10;
      doc.x = L;
    };

    // =========================
    // Radar Chart (match document style - no blue background)
    // =========================
    const drawRadarChart = (profile) => {
      doc.addPage();
      drawMiniHeader();
      drawSectionTitle("สมรรถนะ ความพร้อมรบ");

      if (
        !profile ||
        !Array.isArray(profile.values) ||
        !profile.values.length
      ) {
        drawFieldRow1({ label: "ข้อมูล", value: "ไม่มีข้อมูลกราฟ" });
        return;
      }

      const count = profile.values.length;

      const maxValues = Array.isArray(profile.indicators)
        ? profile.indicators.map((i) => Number(i?.max) || 100)
        : Array(count).fill(100);

      const labels = Array.isArray(profile.indicators)
        ? profile.indicators.map((i, idx) => i?.name || `หัวข้อ ${idx + 1}`)
        : Array.isArray(profile.breakdown)
        ? profile.breakdown.map((b, idx) => b?.label || `หัวข้อ ${idx + 1}`)
        : profile.values.map((_, idx) => `หัวข้อ ${idx + 1}`);

      // ---- layout (card like other sections) ----
      const cardH = 320;
      ensureSpace(cardH + 16);

      const cardX = L;
      const cardY = doc.y;
      const cardW = CONTENT_W;

      // ---- colors (document theme) ----
      const GRID = "#d9e2ec"; // faint grid
      const GRID_SOFT = "#edf2f7"; // inner grid
      const AXIS = "#94a3b8"; // stronger axis
      const POLY_FILL = "#0f4c81"; // theme blue
      const POLY_STROKE = "#0b3c63"; // darker stroke
      const DOT_FILL = "#0f4c81"; // theme blue dots
      const DOT_STROKE = "#ffffff"; // clean dot border
      const LABEL_COLOR = TEXT;

      // ---- card container ----
      drawCard({
        x: cardX,
        y: cardY,
        w: cardW,
        h: cardH,
        fill: BG,
        radius: 14,
      });
      drawAccentStripe(cardX + 10, cardY + 14, cardH - 28);

      // title inside card
      doc
        .fillColor(ACCENT)
        .fontSize(11)
        .text("สมรรถนะ", cardX + 26, cardY + 16);

      // ---- radar geometry ----
      const paddingTop = 44; // เว้นหัวข้อใน card
      const paddingBottom = 18;

      const centerX = cardX + cardW / 2;
      const centerY =
        cardY + paddingTop + (cardH - paddingTop - paddingBottom) / 2;

      const radius = Math.min(cardW, cardH) * 0.26;
      const levels = 5;

      const polarToCartesian = (r, angle) => ({
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
      });

      // ---- grid polygons (soft) ----
      doc.save();
      doc.strokeColor(GRID_SOFT).lineWidth(1);
      for (let level = 1; level <= levels; level += 1) {
        const r = (radius * level) / levels;
        for (let i = 0; i < count; i += 1) {
          const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
          const p = polarToCartesian(r, angle);
          if (i === 0) doc.moveTo(p.x, p.y);
          else doc.lineTo(p.x, p.y);
        }
        doc.closePath().stroke();
      }
      doc.restore();

      // ---- axes (slightly stronger) ----
      doc.save();
      doc.strokeColor(AXIS).lineWidth(1);
      for (let i = 0; i < count; i += 1) {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
        const end = polarToCartesian(radius, angle);
        doc.moveTo(centerX, centerY).lineTo(end.x, end.y).stroke();
      }
      doc.restore();

      // ---- data polygon points ----
      const points = [];
      for (let i = 0; i < count; i += 1) {
        const value = Number(profile.values[i]) || 0;
        const max = Number(maxValues[i]) || 100;
        const ratio = Math.max(0, Math.min(1, value / (max || 100)));
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
        points.push(polarToCartesian(radius * ratio, angle));
      }

      // ---- polygon fill + stroke ----
      doc.save();
      // fill transparent (PDFKit: fillOpacity มีผล global ใน save/restore นี้)
      doc.fillColor(POLY_FILL).fillOpacity(0.2);
      doc.strokeColor(POLY_STROKE).lineWidth(2);

      points.forEach((p, idx) => {
        if (idx === 0) doc.moveTo(p.x, p.y);
        else doc.lineTo(p.x, p.y);
      });
      doc.closePath().fillAndStroke();
      doc.restore();

      // ---- points (dots) ----
      doc.save();
      for (const p of points) {
        doc.circle(p.x, p.y, 4).fillColor(DOT_FILL).fillOpacity(1).fill();
        doc.circle(p.x, p.y, 4).strokeColor(DOT_STROKE).lineWidth(1).stroke();
      }
      doc.restore();

      // ---- labels around (match doc typography) ----
      doc.save();
      doc.fillColor(LABEL_COLOR).fontSize(10.5);

      for (let i = 0; i < count; i += 1) {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;

        // ระยะ label ออกจากกราฟ
        const pos = polarToCartesian(radius + 40, angle);

        const w = 120;
        let x = pos.x - w / 2;
        let y = pos.y - 10;

        // nudges เล็กน้อยกันชนขอบ
        if (Math.abs(Math.cos(angle)) > 0.7) x += Math.cos(angle) * 10;
        if (Math.abs(Math.sin(angle)) > 0.7) y += Math.sin(angle) * 8;

        // clamp ให้อยู่ในกรอบการ์ด
        const minX = cardX + 18;
        const maxX = cardX + cardW - 18 - w;
        x = Math.max(minX, Math.min(maxX, x));

        const minY = cardY + 34;
        const maxY = cardY + cardH - 18;
        y = Math.max(minY, Math.min(maxY, y));

        // label
        doc.text(labels[i], x, y, { width: w, align: "center" });

        // value beneath label for contrast
        const val = Number(profile.values[i]) || 0;
        doc
          .fillColor(ACCENT)
          .fontSize(9.5)
          .text(`${val}`, x, y + 12, { width: w, align: "center" })
          .fillColor(LABEL_COLOR)
          .fontSize(10.5);
      }
      doc.restore();

      // move cursor after card
      doc.y = cardY + cardH + 14;
      doc.x = L;
    };

    // =========================
    // Image Block (professional)
    // =========================
    const drawImageBlock = () => {
      const cardH = 210;
      ensureSpace(cardH + 16);

      const cardX = L;
      const cardY = doc.y;
      const cardW = CONTENT_W;

      drawCard({
        x: cardX,
        y: cardY,
        w: cardW,
        h: cardH,
        fill: BG,
        radius: 14,
      });
      drawAccentStripe(cardX + 10, cardY + 14, cardH - 28);

      doc
        .fillColor(ACCENT)
        .fontSize(11)
        .text("รูปบัตรประชาชน", cardX + 26, cardY + 16);

      const imgBoxX = cardX + 26;
      const imgBoxY = cardY + 40;
      const imgBoxW = cardW - 52;
      const imgBoxH = 150;

      doc.save();
      roundRectPath(imgBoxX, imgBoxY, imgBoxW, imgBoxH, 12);
      doc.fillColor(BG_SOFT).fill();
      roundRectPath(imgBoxX, imgBoxY, imgBoxW, imgBoxH, 12);
      doc.strokeColor(BORDER).lineWidth(1).stroke();
      doc.restore();

      const imagePath = resolveIdCardFilePath(item.idCardImageUrl);
      if (imagePath && fs.existsSync(imagePath)) {
        try {
          doc.image(imagePath, imgBoxX + 10, imgBoxY + 10, {
            fit: [imgBoxW - 20, imgBoxH - 20],
            align: "center",
            valign: "center",
          });
        } catch (err) {
          doc
            .fillColor(MUTED)
            .fontSize(9.5)
            .text(
              "ไม่สามารถแสดงรูปบัตรประชาชนได้",
              imgBoxX + 12,
              imgBoxY + 60,
              {
                width: imgBoxW - 24,
                align: "center",
                lineGap: LINE_GAP,
              }
            );
          console.warn("Failed to render id card image", err.message);
        }
      } else {
        doc
          .fillColor(MUTED)
          .fontSize(9.5)
          .text("ไม่มีรูปบัตรประชาชน", imgBoxX + 12, imgBoxY + 60, {
            width: imgBoxW - 24,
            align: "center",
            lineGap: LINE_GAP,
          });
      }

      doc.y = cardY + cardH + 14;
      doc.x = L;
    };

    // =========================
    // Content
    // =========================
    const formatBoolSwim = (v) =>
      v === true ? "ได้" : v === false ? "ไม่ได้" : "-";
    const formatBoolTattoo = (v) =>
      v === true ? "มี" : v === false ? "ไม่มี" : "-";
    const formatBoolSurgery = (v) =>
      v === true ? "เคย" : v === false ? "ไม่เคย" : "-";
    const formatBool = (v) => (v === true ? "มี" : v === false ? "ไม่มี" : "-");

    const allergyText = formatListField(item.foodAllergies);
    const drugAllergy = formatListField(item.drugAllergies);
    const chronicText = formatListField(item.chronicDiseases);
    const certificateText = formatListField(item.certificates);

    // First page header + ✅ pills row (Thai)
    drawFirstHeader();
    drawPillRow([
      `กองพัน ${item.battalionCode || "-"}`,
      `กองร้อย ${item.companyCode || "-"}`,
      `หมวด ${item.platoonCode ?? "-"}`,
      `ลำดับ ${item.sequenceNumber ?? "-"}`,
    ]);

    drawImageBlock();

    drawSectionTitle("ข้อมูลพื้นฐาน");
    const ageYears = computeAgeYears(item.birthDate);
    drawFieldRow2({
      leftLabel: "เลขบัตรประชาชน",
      leftValue: item.citizenId,
      rightLabel: "วันเกิด",
      rightValue: ageYears !== null
        ? `${formatDateThaiShort(item.birthDate)} (${ageYears} ปี)`
        : formatDateThaiShort(item.birthDate),
    });
    drawFieldRow2({
      leftLabel: "อายุราชการ",
      leftValue: formatServiceYearsDisplay(item.serviceYears),
      rightLabel: "การศึกษา",
      rightValue: item.education || "-",
    });
    drawFieldRow1({
      label: "สังกัด",
      value: `กองพัน ${item.battalionCode || "-"} / กองร้อย ${
        item.companyCode || "-"
      } / หมวด ${item.platoonCode ?? "-"} / ลำดับ ${
        item.sequenceNumber ?? "-"
      }`,
    });
    drawFieldRow2({
      leftLabel: "ศาสนา",
      leftValue: item.religion || "-",
      rightLabel: "สถานะครอบครัว",
      rightValue: item.familyStatus || "-",
    });

    drawSectionTitle("ที่อยู่และการติดต่อ");
    drawFieldRow1({
      label: "ที่อยู่",
      value: `${item.addressLine || "-"} ${item.subdistrict || ""} ${
        item.district || ""
      } ${item.province || ""} ${item.postalCode || ""}`.trim(),
    });
    drawFieldRow2({
      leftLabel: "เบอร์โทรศัพท์",
      leftValue: item.phone || "-",
      rightLabel: "อีเมล",
      rightValue: item.email || "-",
    });
    drawFieldRow1({
      label: "ติดต่อฉุกเฉิน",
      value: `${item.emergencyName || "-"}${
        item.emergencyPhone ? ` (${item.emergencyPhone})` : ""
      }`,
    });

    drawSectionTitle("สุขภาพ");
    drawFieldRow2({
      leftLabel: "ส่วนสูง (ซม.)",
      leftValue: item.heightCm ?? "-",
      rightLabel: "น้ำหนัก (กก.)",
      rightValue: item.weightKg ?? "-",
    });
    drawFieldRow2({
      leftLabel: "กรุ๊ปเลือด",
      leftValue: item.bloodGroup || "-",
      rightLabel: "ว่ายน้ำ",
      rightValue: formatBoolSwim(item.canSwim),
    });
    drawFieldRow2({
      leftLabel: "รอยสัก",
      leftValue: formatBoolTattoo(item.tattoo),
      rightLabel: "เคยผ่าตัด",
      rightValue: formatBoolSurgery(item.surgeryHistory),
    });
    drawFieldRow2({
      leftLabel: "อุบัติเหตุ",
      leftValue: formatBoolSurgery(item.accidentHistory),
      rightLabel: "หมายเหตุแพทย์",
      rightValue: item.medicalNotes || "-",
    });
    drawFieldRow1({ label: "โรคประจำตัว", value: chronicText || "-" });
    drawFieldRow1({ label: "แพ้อาหาร", value: allergyText || "-" });
    drawFieldRow1({ label: "แพ้ยา", value: drugAllergy || "-" });

    drawSectionTitle("ทักษะและใบประกาศ");
    drawFieldRow1({ label: "ทักษะพิเศษ", value: item.specialSkills || "-" });
    drawFieldRow1({ label: "ใบประกาศนียบัตร", value: certificateText || "-" });
    drawFieldRow2({
      leftLabel: "อาชีพก่อนเป็นทหาร",
      leftValue: item.previousJob || "-",
      rightLabel: "ประสบการณ์ก่อนเป็นทหาร (ปี)",
      rightValue: item.experienced ?? "-",
    });
    drawFieldRow2({
      leftLabel: "คะแนนความพร้อมรบ",
      leftValue:  `${item.combatReadiness?.score}/500` ?? "-",
      rightLabel: "เปอร์เซ็นต์ความพร้อมรบ",
      rightValue: `${item.combatReadiness?.percent}%` ?? "-",
    });

    // drawSectionTitle("บันทึกระบบ");
    // drawFieldRow2({
    //   leftLabel: "สร้างเมื่อ",
    //   leftValue: formatDateTimeThai(item.createdAt) || "-",
    //   rightLabel: "อัปเดตล่าสุด",
    //   rightValue: formatDateTime(item.updatedAt) || "-",
    // });

    drawRadarChart(item.radarProfile);

    // footer ถูกถอดออกแล้วตามที่คุณสั่ง
    doc.end();
  });

const listIntakes = async (req, res) => {
  try {
    const filters = { ...(req.query || {}) };
    const unitFilter = mapRoleToUnitFilter(req.userRole);

    const applyStringFilter = (queryKey, filterKey = queryKey) => {
      const value = normalizeFilterString(req.query[queryKey]);
      if (value) {
        filters[filterKey] = value;
      } else {
        delete filters[filterKey];
      }
      if (filterKey !== queryKey) {
        delete filters[queryKey];
      }
    };

    applyStringFilter("battalionCode");
    applyStringFilter("companyCode");
    applyStringFilter("educationFilter", "education");
    applyStringFilter("bloodFilter", "bloodGroup");

    const parsePositiveIntFilter = (value) => {
      if (value === undefined || value === null || value === "")
        return undefined;
      const num = Number(value);
      return Number.isInteger(num) && num > 0 ? num : undefined;
    };

    const parseFloatFilter = (value) => {
      if (value === undefined || value === null || value === "")
        return undefined;
      const num = Number(value);
      return Number.isFinite(num) ? num : undefined;
    };

    const serviceYearsValue = parseFloatFilter(req.query.serviceYears);
    if (serviceYearsValue !== undefined) {
      filters.serviceYears = serviceYearsValue;
    } else {
      delete filters.serviceYears;
    }

    const hasSpecialSkills = normalizePresenceFilter(
      req.query.specialSkillFilter
    );
    if (hasSpecialSkills !== undefined) {
      filters.hasSpecialSkills = hasSpecialSkills;
      delete filters.specialSkillFilter;
    } else {
      delete filters.hasSpecialSkills;
    }

    const hasChronicDiseases = normalizePresenceFilter(req.query.healthFilter);
    if (hasChronicDiseases !== undefined) {
      filters.hasChronicDiseases = hasChronicDiseases;
      delete filters.healthFilter;
    } else {
      delete filters.hasChronicDiseases;
    }

    // province filter
    const provinceRaw = req.query.provinceFilter;
    const provinceCode =
      provinceRaw === undefined || provinceRaw === null || provinceRaw === ""
        ? undefined
        : Number(provinceRaw);

    if (provinceCode !== undefined && Number.isInteger(provinceCode)) {
      filters.province = String(provinceCode);
    } else {
      delete filters.province;
    }
    delete filters.provinceFilter;

    const platoonCodeValue = parsePositiveIntFilter(req.query.platoonCode);
    if (platoonCodeValue !== undefined) {
      filters.platoonCode = platoonCodeValue;
    } else {
      delete filters.platoonCode;
    }

    const sequenceNumberValue = parsePositiveIntFilter(
      req.query.sequenceNumber
    );
    if (sequenceNumberValue !== undefined) {
      filters.sequenceNumber = sequenceNumberValue;
    } else {
      delete filters.sequenceNumber;
    }

    const normalizedReligion = normalizeFilterString(req.query.religionFilter);
    if (normalizedReligion === "อื่นๆ") {
      filters.religionOther = true;
      delete filters.religion;
    } else if (normalizedReligion) {
      filters.religion = normalizedReligion;
      delete filters.religionOther;
    } else {
      delete filters.religion;
      delete filters.religionOther;
    }

    if (unitFilter) {
      filters.battalionCode = unitFilter.battalionCode;
      filters.companyCode = unitFilter.companyCode;
    }

    const combatReadinessSort = filters.combatReadinessSort;
    delete filters.combatReadinessSort;

    // ✅ eligibleNcoFilter true/false
    const eligibleNcoRaw = normalizePresenceFilter(req.query.eligibleNcoFilter);
    if (eligibleNcoRaw === true) {
      filters.eligibleNcoMode = "eligible";
    } else if (eligibleNcoRaw === false) {
      filters.eligibleNcoMode = "ineligible";
    } else {
      delete filters.eligibleNcoMode;
    }
    delete filters.eligibleNcoFilter;

    const result = await SoldierIntake.listIntakes({
      ...filters,
      combatReadinessSort,
    });

    res.json({
      data: result.items,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    });
  } catch (err) {
    console.error("Failed to list soldier intakes", err);
    res.status(500).json({ message: "ไม่สามารถดึงข้อมูลได้" });
  }
};

const exportIntakes = async (req, res) => {
  try {
    const records = await getExportIntakeRecords(req, res);
    if (!records) return;

    const rows = records.map((item) => ({
      เลขบัตรประชาชน: item.citizenId || "",
      ชื่อ: item.firstName || "",
      นามสกุล: item.lastName || "",
      วันเกิด: formatDateOnly(item.birthDate),
      "น้ำหนัก (กก.)": item.weightKg ?? "",
      "ส่วนสูง (ซม.)": item.heightCm ?? "",
      "อายุราชการ (ปี)": item.serviceYears ?? "",
      กรุ๊ปเลือด: item.bloodGroup || "",
      กองพัน: item.battalionCode || "",
      กองร้อย: item.companyCode || "",
      หมวด: item.platoonCode ?? "",
      ลำดับ: item.sequenceNumber ?? "",
      การศึกษา: item.education || "",
      อาชีพก่อนเป็นทหาร: item.previousJob || "",
      ศาสนา: item.religion || "",
      ว่ายน้ำได้: formatBooleanLabel(item.canSwim),
      ทักษะพิเศษ: item.specialSkills || "",
      ที่อยู่: item.addressLine || "",
      จังหวัด: item.province || "",
      อำเภอ: item.district || "",
      ตำบล: item.subdistrict || "",
      รหัสไปรษณีย์: item.postalCode || "",
      อีเมล: item.email || "",
      เบอร์โทรศัพท์: item.phone || "",
      ผู้ติดต่อฉุกเฉิน: item.emergencyName || "",
      เบอร์ฉุกเฉิน: item.emergencyPhone || "",
      โรคประจำตัว: formatListField(item.chronicDiseases),
      แพ้อาหาร: formatListField(item.foodAllergies),
      แพ้ยา: formatListField(item.drugAllergies),
      หมายเหตุแพทย์: item.medicalNotes || "",
      เคยประสบอุบัติเหตุ: formatBooleanLabel(item.accidentHistory),
      เคยผ่าตัด: formatBooleanLabel(item.surgeryHistory),
      มีรอยสัก: formatBooleanLabel(item.tattoo),
      "ประสบการณ์ก่อนเป็นทหาร (ปี)": item.experienced ?? "",
      สถานะครอบครัว: item.familyStatus || "",
      ประกาศนียบัตร: formatListField(item.certificates),
      "รูปบัตรประชาชน (URL)": item.idCardImageUrl || "",
      คะแนนความพร้อมรบ: item.combatReadiness?.score ?? "",
      เปอร์เซ็นต์ความพร้อมรบ: item.combatReadiness?.percent ?? "",
      สร้างเมื่อ: formatDateTimeThai(item.createdAt),
      อัปเดตล่าสุด: formatDateTime(item.updatedAt),
    }));

    const workbook = XLSX.utils.book_new();
    const sheetName = "ทหารใหม่".slice(0, 31);
    const worksheet =
      rows.length > 0
        ? XLSX.utils.json_to_sheet(rows)
        : XLSX.utils.aoa_to_sheet([["ไม่มีข้อมูล"]]);
    if (rows.length > 0) {
      worksheet["!cols"] = autoFitColumns(rows);
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="soldier-intakes.xlsx"'
    );
    return res.send(buffer);
  } catch (err) {
    console.error("Failed to export soldier intakes", err);
    return res
      .status(500)
      .json({ message: "ไม่สามารถส่งออกข้อมูลได้", detail: err.message });
  }
};

const exportIntakesPdf = async (req, res) => {
  try {
    const displayFilters = buildExportFilters(req);
    const records = await getExportIntakeRecords(req, res);
    if (!records) return;

    const buffer = await buildIntakesPdfBuffer(records, {
      orientation: req.query?.orientation,
      filters: displayFilters,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="soldier-intakes.pdf"'
    );
    res.send(buffer);
  } catch (err) {
    console.error("Failed to export soldier intakes pdf", err);
    return res
      .status(500)
      .json({ message: "ไม่สามารถส่งออก PDF ได้", detail: err.message });
  }
};

const exportIntakePdfByCitizenId = async (req, res) => {
  try {
    const citizenId = String(req.query?.citizenId || "").trim();
    const unitCode = String(req.query?.unitCode || req.query?.code || "").trim();
    if (!citizenId && !unitCode) {
      return res
        .status(400)
        .json({ message: "กรุณาระบุ citizenId หรือ unitCode 5 หลัก" });
    }

    const unitFilter = mapRoleToUnitFilter(req.userRole) || {};
    const record = citizenId
      ? await SoldierIntake.getIntakeByCitizenId(citizenId, unitFilter || {})
      : await SoldierIntake.getIntakeByUnitCode(unitCode, unitFilter || {});

    const buffer = await buildIntakeProfilePdfBuffer(record);
    const displayName =
      `${record.firstName || ""} ${record.lastName || ""}`.trim() ||
      record.firstName ||
      record.lastName ||
      "soldier";
    const asciiSafe = displayName
      .normalize("NFKD")
      .replace(/[^\w\s.-]/g, "")
      .trim();
    const safeName = (asciiSafe || "soldier").replace(/\s+/g, "_");
    const fileName = `${safeName}-intake.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );
    res.send(buffer);
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ message: err.message });
    }
    console.error("Failed to export soldier intake pdf by citizenId", err);
    return res.status(500).json({
      message: "ไม่สามารถส่งออก PDF รายบุคคลได้",
      detail: err.message,
    });
  }
};

const getIntakeById = async (req, res) => {
  try {
    const record = await SoldierIntake.getIntakeById(req.params.id);
    res.json({ data: record });
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ message: err.message });
    }
    console.error("Failed to get soldier intake", err);
    res.status(500).json({ message: "ไม่สามารถดึงข้อมูลได้" });
  }
};

const updateIntake = async (req, res) => {
  const uploaded = req.file;
  try {
    const payload = { ...req.body };
    if (uploaded) {
      payload.idCardImageUrl = toPublicPath(uploaded);
    }
    const updated = await SoldierIntake.updateIntake(req.params.id, payload);
    res.json({ data: updated });
  } catch (err) {
    deleteIfExists(uploaded?.path);
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ message: err.message });
    }
    console.error("Failed to update soldier intake", err);
    res.status(500).json({ message: "ไม่สามารถแก้ไขข้อมูลได้" });
  }
};

const deleteIntake = async (req, res) => {
  try {
    await SoldierIntake.deleteIntake(req.params.id);
    res.status(204).send();
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ message: err.message });
    }
    console.error("Failed to delete soldier intake", err);
    res.status(500).json({ message: "ไม่สามารถลบข้อมูลได้" });
  }
};

const deleteAllIntakes = async (_req, res) => {
  try {
    const result = await SoldierIntake.deleteAllIntakes();
    res.json({ deleted: result.deleted });
  } catch (err) {
    console.error("Failed to delete soldier intakes", err);
    res.status(500).json({ message: "ไม่สามารถลบข้อมูลได้" });
  }
};

const summary = async (req, res) => {
  try {
    const filters = { ...(req.query || {}) };
    const unitFilter = mapRoleToUnitFilter(req.userRole);

    if (unitFilter) {
      filters.battalionCode = unitFilter.battalionCode;
      filters.companyCode = unitFilter.companyCode;
    }
    const data = await SoldierIntake.summary(
      filters.battalionCode,
      filters.companyCode
    );
    res.json({ data });
  } catch (err) {
    console.error("Failed to summarize soldier intake", err);
    res.status(500).json({ message: "ไม่สามารถสรุปข้อมูลได้" });
  }
};

const getIntakePublicStatus = async (_req, res) => {
  try {
    const enabled = await FeatureToggle.getSoldierIntakeStatus();
    res.json({ enabled });
  } catch (err) {
    res.status(500).json({ message: "ไม่สามารถดึงสถานะได้" });
  }
};

const setIntakePublicStatus = async (req, res) => {
  try {
    const parsed = FeatureToggle.getBoolean(req.body?.enabled);
    if (parsed === null) {
      return res.status(400).json({ message: "enabled ต้องเป็น boolean" });
    }
    await FeatureToggle.setSoldierIntakeStatus(parsed, req.userId);
    res.json({ enabled: parsed });
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "ไม่สามารถอัปเดตสถานะได้" });
  }
};

const importUnitAssignments = async (req, res) => {
  const uploaded = req.file;
  if (!uploaded?.path) {
    return res.status(400).json({ message: "กรุณาอัปโหลดไฟล์ Excel" });
  }

  const cleanup = () => {
    try {
      if (fs.existsSync(uploaded.path)) {
        fs.unlinkSync(uploaded.path);
      }
    } catch {}
  };

  try {
    const workbook = XLSX.readFile(uploaded.path);
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      cleanup();
      return res.status(400).json({ message: "ไฟล์ไม่มีชีตข้อมูล" });
    }
    const sheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const normalizeNumber = (val) => {
      if (val === null || val === undefined || val === "") return undefined;
      const num = Number(val);
      return Number.isFinite(num) ? num : undefined;
    };
    const normalizeString = (val) => {
      if (val === null || val === undefined) return undefined;
      const text = String(val).trim();
      return text || undefined;
    };
    const normalizeCitizenId = (val) => {
      const text =
        typeof val === "string" || typeof val === "number" ? String(val) : "";
      const digits = text.replace(/\D/g, "").trim();
      return digits || undefined;
    };

    const records = rawRows.map((row) => ({
      battalionCode:
        normalizeNumber(row["กองพัน"]) ??
        normalizeNumber(row["battalion"]) ??
        normalizeString(row["กองพัน"]),
      companyCode:
        normalizeNumber(row["กองร้อย"]) ??
        normalizeNumber(row["company"]) ??
        normalizeString(row["กองร้อย"]),
      platoonCode:
        normalizeNumber(row["หมวด"]) ??
        normalizeNumber(row["platoon"]) ??
        normalizeString(row["หมวด"]),
      sequenceNumber:
        normalizeNumber(row["ลำดับ"]) ??
        normalizeNumber(row["seq"]) ??
        normalizeNumber(row["sequence"]),
      citizenId: normalizeCitizenId(row["เลขบัตรประชาชน"] ?? row["citizenId"]),
      firstName: normalizeString(row["ชื่อ"] ?? row["firstName"]),
      lastName: normalizeString(row["สกุล"] ?? row["lastName"]),
      registrationId: normalizeString(row["ทะเบียน"] ?? row["registration"]),
      birthDate: normalizeString(row["วันเกิด"] ?? row["birthDate"]),
    }));

    const filteredRecords = records.filter((r) => r.citizenId);
    if (!filteredRecords.length) {
      cleanup();
      return res.status(400).json({ message: "ไม่พบเลขบัตรประชาชนในไฟล์" });
    }

    const result = await SoldierIntake.importUnitAssignments(filteredRecords);
    cleanup();
    res.json({ message: "อัปเดตข้อมูลสำเร็จ", result });
  } catch (err) {
    cleanup();
    console.error("Failed to import soldier intake assignments", err);
    res
      .status(500)
      .json({ message: "ไม่สามารถนำเข้าไฟล์ได้", detail: err.message });
  }
};

module.exports = {
  createIntake,
  listIntakes,
  exportIntakes,
  getIntakeById,
  updateIntake,
  deleteIntake,
  summary,
  getIntakePublicStatus,
  setIntakePublicStatus,
  importUnitAssignments,
  deleteAllIntakes,
  exportIntakesPdf,
  exportIntakePdfByCitizenId,
};
