const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const THAI_FONT_PATH = path.join(
  __dirname,
  "..",
  "..",
  "assets",
  "fonts",
  "Kanit-Regular.ttf"
);
const LOGO_PATH = path.join(__dirname, "..", "..", "assets", "logo.jpg");
const LOGO_PATH_PNG = path.join(
  __dirname,
  "..",
  "..",
  "assets",
  "logo_png.png"
);

const getLogoPath = () => {
  if (LOGO_PATH_PNG && fs.existsSync(LOGO_PATH_PNG)) return LOGO_PATH_PNG;
  if (LOGO_PATH && fs.existsSync(LOGO_PATH)) return LOGO_PATH;
  return null;
};

const applyThaiFontIfAvailable = (doc) => {
  try {
    if (THAI_FONT_PATH && fs.existsSync(THAI_FONT_PATH)) {
      doc.registerFont("THAI", THAI_FONT_PATH);
      doc.font("THAI");
      return true;
    }
  } catch {}
  return false;
};

const padTwo = (value) => String(value ?? "").padStart(2, "0");

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

const formatDateTimeThai = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

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

const formatDateThaiShort = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.getDate();
  const month = TH_MONTH_SHORT[date.getMonth()] || "";
  const year = date.getFullYear() + 543;
  return `${day} ${month} ${year}`;
};

const formatList = (value) => {
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) =>
        item === undefined || item === null ? "" : String(item).trim()
      )
      .filter((item) => item);
    return normalized.length ? normalized.join(", ") : "-";
  }
  if (value === undefined || value === null) return "-";
  const text = String(value).trim();
  return text || "-";
};

const clampText = (value) => {
  if (value === undefined || value === null || value === "") return "-";
  const text = String(value).trim();
  return text || "-";
};

const LEAVE_TYPE_LABELS = {
  SICK: "ลาป่วย",
  PERSONAL: "ลากิจ",
  VACATION: "ลาพักผ่อน",
  OFFICIAL_DUTY: "ไปราชการ",
  OTHER: "อื่นๆ",
};

const LEAVE_STATUS_LABELS = {
  PENDING: "รอดำเนินการ",
  APPROVED: "อนุมัติ",
  REJECTED: "ไม่อนุมัติ",
  CANCELED: "ยกเลิก",
};

const APPROVAL_STATUS_LABELS = {
  PENDING: "รอดำเนินการ",
  APPROVED: "อนุมัติ",
  REJECTED: "ไม่อนุมัติ",
};

const formatEnumLabel = (value, map) => {
  if (value === undefined || value === null) return "-";
  const key = String(value).trim().toUpperCase();
  if (!key) return "-";
  return map && map[key] ? map[key] : value;
};

const formatBooleanThai = (value) => {
  if (value === true) return "ใช่";
  if (value === false) return "ไม่";
  return "-";
};

const ROLE_LABELS = {
  admin: "ผู้ดูแลระบบ",
  owner: "เจ้าของระบบ",
  sub_admin: "หัวหน้าหมวดวิชา",
  schedule_admin: "ผู้ดูแลตารางสอน",
  form_creator: "ผู้สร้างฟอร์มประเมิน",
  exam_uploader: "ผู้อัปโหลดผลสอบ",
  teacher: "ครูผู้สอน",
  student: "นักเรียน",
  commander: "ผู้บังคับบัญชา",
};

const PRIORITY_LABELS = {
  HIGH: "สูง",
  MEDIUM: "ปานกลาง",
  LOW: "ต่ำ",
};

const TASK_STATUS_LABELS = {
  PENDING: "รอดำเนินการ",
  IN_PROGRESS: "กำลังดำเนินการ",
  DONE: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
  CANCELED: "ยกเลิก",
};

const formatRoleLabel = (role) => {
  if (!role) return "-";
  const key = String(role).trim().toLowerCase();
  if (!key) return "-";
  // Support uppercase enums like "SUB_ADMIN"
  const normalized = key.replace(/-/g, "_");
  return (
    ROLE_LABELS[normalized] ||
    ROLE_LABELS[normalized.replace(/\s+/g, "_")] ||
    role
  );
};

const resolveAvatarFilePath = (avatarUrl) => {
  if (!avatarUrl) return null;
  const raw = String(avatarUrl).trim();
  if (!raw) return null;
  if (!raw.startsWith("/uploads/")) return null;
  const relative = raw.replace(/^\//, "");
  return path.join(__dirname, "..", "..", relative);
};

const formatRankedName = (person = {}) => {
  if (!person) return "-";
  const rank = person.rankLabel || person.rank;
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ");
  const combined = `${rank ? `${rank} ` : ""}${name}`.trim();
  return combined || "-";
};

const formatScore = (score) => {
  const num = Number(score);
  if (!Number.isFinite(num)) return "-";
  const text = num.toFixed(2).replace(/\.?0+$/, "");
  return text;
};

const formatPriority = (value) => formatEnumLabel(value, PRIORITY_LABELS);
const formatTaskStatus = (value) => formatEnumLabel(value, TASK_STATUS_LABELS);

const buildUserProfilePdfBuffer = (user) =>
  new Promise(async (resolve, reject) => {
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

    const textHeight = (text, width, fontSize) => {
      doc.fontSize(fontSize);
      return doc.heightOfString(String(text ?? ""), {
        width,
        lineGap: LINE_GAP,
      });
    };

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

    const ensureSpace = (minHeight = 60) => {
      if (doc.y + minHeight > PAGE_H - doc.page.margins.bottom) {
        doc.addPage();
        drawMiniHeader();
      }
    };

    const fullNameRaw = `${user?.rank ? `${user.rank} ` : ""}${
      user?.firstName || ""
    } ${user?.lastName || ""}`.trim();
    const fullName = fullNameRaw || "-";
    const exportedAt = formatDateTimeThai(new Date());
    const userId = user?.id ?? "-";

    doc.info.Title = `ข้อมูลผู้ใช้ ${fullName}`;
    doc.info.Author = "RTCAS";

    const drawFirstHeader = () => {
      doc.save();
      doc.rect(0, 0, PAGE_W, 78).fill(BG_SOFT);
      doc.rect(0, 0, PAGE_W, 5).fill(ACCENT);
      doc.restore();

      const headerLogoPath = getLogoPath();
      const headerHasLogo = Boolean(headerLogoPath);
      const headerLogoSize = 74;
      const headerLogoGap = 12;
      const headerLogoX = L;
      const headerLogoY = 5;
      const titleX = headerHasLogo
        ? headerLogoX + headerLogoSize + headerLogoGap
        : L;

      if (headerHasLogo) {
        try {
          doc.image(headerLogoPath, headerLogoX, headerLogoY, {
            fit: [headerLogoSize, headerLogoSize],
          });
        } catch {}
      }

      doc.fillColor(TEXT).fontSize(16).text("ข้อมูลผู้ใช้", titleX, 18);
      doc
        .fillColor(TEXT)
        .fontSize(14)
        .text(fullName, titleX, 42, { width: CONTENT_W - (titleX - L) });

      doc
        .fillColor(MUTED)
        .fontSize(9.5)
        .text(`User ID: ${userId}`, L, 20, {
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

    const drawMiniHeader = () => drawFirstHeader();

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

    const drawAvatarBlock = async () => {
      const avatarPath = resolveAvatarFilePath(user?.avatar);
      if (!avatarPath || !fs.existsSync(avatarPath)) return;

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
        .text("รูปโปรไฟล์", cardX + 26, cardY + 16);

      const imgBoxX = cardX + 26;
      const imgBoxY = cardY + 40;
      const imgBoxW = cardW - 52;
      const imgBoxH = 150;

      doc.save();
      roundRectPath(imgBoxX, imgBoxY, imgBoxW, imgBoxH, 12);
      doc.strokeColor(BORDER).lineWidth(1).stroke();
      doc.restore();

      try {
        doc.image(avatarPath, imgBoxX + 6, imgBoxY + 6, {
          fit: [imgBoxW - 12, imgBoxH - 12],
          align: "center",
          valign: "center",
        });
      } catch {}

      doc.y = cardY + cardH + 14;
      doc.x = L;
    };

    const drawRadarChart = (profile) => {
      if (!profile || !Array.isArray(profile.values) || !profile.values.length)
        return;

      doc.addPage();
      drawMiniHeader();
      drawSectionTitle("สรุปคะแนนภาพรวม");

      const count = profile.values.length;
      const maxValues = Array.isArray(profile.indicators)
        ? profile.indicators.map((i) => Number(i?.max) || 100)
        : Array(count).fill(100);

      const labels = Array.isArray(profile.indicators)
        ? profile.indicators.map((i, idx) => i?.name || `หัวข้อ ${idx + 1}`)
        : profile.values.map((_, idx) => `หัวข้อ ${idx + 1}`);

      const cardH = 320;
      ensureSpace(cardH + 16);

      const cardX = L;
      const cardY = doc.y;
      const cardW = CONTENT_W;

      const GRID_SOFT = "#edf2f7";
      const AXIS = "#94a3b8";
      const POLY_FILL = ACCENT;
      const POLY_STROKE = "#0b3c63";
      const DOT_FILL = ACCENT;
      const DOT_STROKE = "#ffffff";

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
        .text("Radar", cardX + 26, cardY + 16);

      const paddingTop = 44;
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

      doc.save();
      doc.strokeColor(AXIS).lineWidth(1);
      for (let i = 0; i < count; i += 1) {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
        const end = polarToCartesian(radius, angle);
        doc.moveTo(centerX, centerY).lineTo(end.x, end.y).stroke();
      }
      doc.restore();

      const points = [];
      for (let i = 0; i < count; i += 1) {
        const value = Number(profile.values[i]) || 0;
        const max = Number(maxValues[i]) || 100;
        const ratio = Math.max(0, Math.min(1, value / (max || 100)));
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
        points.push(polarToCartesian(radius * ratio, angle));
      }

      doc.save();
      doc.fillColor(POLY_FILL).fillOpacity(0.2);
      doc.strokeColor(POLY_STROKE).lineWidth(2);
      points.forEach((p, idx) => {
        if (idx === 0) doc.moveTo(p.x, p.y);
        else doc.lineTo(p.x, p.y);
      });
      doc.closePath().fillAndStroke();
      doc.restore();

      doc.save();
      for (const p of points) {
        doc.circle(p.x, p.y, 4).fillColor(DOT_FILL).fillOpacity(1).fill();
        doc.circle(p.x, p.y, 4).strokeColor(DOT_STROKE).lineWidth(1).stroke();
      }
      doc.restore();

      doc.save();
      doc.fillColor(TEXT).fontSize(10.5);
      for (let i = 0; i < count; i += 1) {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
        const pos = polarToCartesian(radius + 40, angle);

        const w = 120;
        let x = pos.x - w / 2;
        let y = pos.y - 10;
        if (Math.abs(Math.cos(angle)) > 0.7) x += Math.cos(angle) * 10;
        if (Math.abs(Math.sin(angle)) > 0.7) y += Math.sin(angle) * 8;

        const minX = cardX + 18;
        const maxX = cardX + cardW - 18 - w;
        x = Math.max(minX, Math.min(maxX, x));

        const minY = cardY + 34;
        const maxY = cardY + cardH - 18;
        y = Math.max(minY, Math.min(maxY, y));

        doc.text(labels[i], x, y, { width: w, align: "center" });

        const val = Number(profile.values[i]) || 0;
        doc
          .fillColor(ACCENT)
          .fontSize(9.5)
          .text(`${val}`, x, y + 12, { width: w, align: "center" })
          .fillColor(TEXT)
          .fontSize(10.5);
      }
      doc.restore();

      doc.y = cardY + cardH + 14;
      doc.x = L;
    };

    const drawStatsBarChart = ({
      studentAverageRating,
      studentTotalSheets,
      studentLastEvaluatedAt,
      teacherAverageOverallScore,
      teacherTotal,
      teacherLastSubmittedAt,
    }) => {
      // normalize to percent (0-100)
      const studentAvg = Number(studentAverageRating);
      const studentPercent = Number.isFinite(studentAvg)
        ? Math.max(0, Math.min(100, (studentAvg / 5) * 100))
        : null;

      const teacherAvg = Number(teacherAverageOverallScore);
      const inferMaxScore = (avg) => {
        if (!Number.isFinite(avg) || avg < 0) return null;
        if (avg <= 5) return 5;
        if (avg <= 10) return 10;
        if (avg <= 100) return 100;
        return null;
      };
      const teacherMaxScore = inferMaxScore(teacherAvg);
      const teacherPercent =
        teacherMaxScore && Number.isFinite(teacherAvg)
          ? Math.max(0, Math.min(100, (teacherAvg / teacherMaxScore) * 100))
          : null;

      const bars = [
        {
          label: "นักเรียนประเมินครู",
          valuePercent: studentPercent,
          valueText: Number.isFinite(studentAvg)
            ? `${studentAvg.toFixed(2)} / 5`
            : "-",
          meta: `จำนวน: ${studentTotalSheets ?? "-"} | ล่าสุด: ${
            formatDateTimeThai(studentLastEvaluatedAt) || "-"
          }`,
        },
        {
          label: "ครูประเมินนักเรียน",
          valuePercent: teacherPercent,
          valueText: Number.isFinite(teacherAvg)
            ? `${teacherAvg.toFixed(2)} / ${teacherMaxScore || "-"}`
            : "-",
          meta: `จำนวน: ${teacherTotal ?? "-"} | ล่าสุด: ${
            formatDateTimeThai(teacherLastSubmittedAt) || "-"
          }`,
        },
      ];

      // Layout (auto height) to avoid text overflow outside card
      const cardX = L;
      const cardW = CONTENT_W;
      const chartX = cardX + 26;
      const chartW = cardW - 52;
      const rowGap = 10;
      const titleBlockH = 44;
      const bottomPad = 16;

      const labelW = Math.min(160, Math.max(120, chartW * 0.38));
      const metaWidth = chartW - 24;
      const barLeftX = chartX + labelW;
      const barW = chartW - labelW - 10;
      const barH = 16;

      const calcRowHeight = (b) => {
        const topPad = 10;
        const gapAfterTop = 8;
        const bottomRowPad = 10;

        doc.fontSize(10.5);
        const labelH = doc.heightOfString(b.label || "", {
          width: labelW - 18,
          lineGap: LINE_GAP,
        });

        doc.fontSize(9.5);
        const metaText = `${b.valueText} | ${b.meta}`;
        const metaH = doc.heightOfString(metaText, {
          width: metaWidth,
          lineGap: LINE_GAP,
        });

        const topBandH = Math.max(labelH, barH);
        return topPad + topBandH + gapAfterTop + metaH + bottomRowPad;
      };

      const rowHeights = bars.map(calcRowHeight);
      const chartH =
        rowHeights.reduce((sum, h) => sum + h, 0) + rowGap * (bars.length - 1);
      const cardH = titleBlockH + chartH + bottomPad;

      ensureSpace(cardH + 16);

      const cardY = doc.y;

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
        .text("คะแนนประเมิน (กราฟแท่ง)", cardX + 26, cardY + 16);

      const chartY = cardY + titleBlockH;

      // chart frame
      doc.save();
      roundRectPath(chartX, chartY, chartW, chartH, 12);
      doc.fillColor(BG_SOFT).fill();
      roundRectPath(chartX, chartY, chartW, chartH, 12);
      doc.strokeColor(BORDER).lineWidth(1).stroke();
      doc.restore();

      let cursorY = chartY;
      bars.forEach((b, idx) => {
        const rowH = rowHeights[idx];
        const y = cursorY;

        const topPad = 10;
        const gapAfterTop = 8;

        doc.fontSize(10.5);
        const labelH = doc.heightOfString(b.label || "", {
          width: labelW - 18,
          lineGap: LINE_GAP,
        });
        const topBandH = Math.max(labelH, barH);

        const labelY = y + topPad;
        const barY = y + topPad + Math.max(0, (topBandH - barH) / 2);
        const metaY = y + topPad + topBandH + gapAfterTop;

        // label
        doc
          .fillColor(TEXT)
          .fontSize(10.5)
          .text(b.label, chartX + 12, labelY, {
            width: labelW - 18,
            lineGap: LINE_GAP,
          });

        // bar background
        doc.save();
        roundRectPath(barLeftX, barY, barW, barH, 999);
        doc.fillColor("#ffffff").fill();
        roundRectPath(barLeftX, barY, barW, barH, 999);
        doc.strokeColor(BORDER).lineWidth(1).stroke();
        doc.restore();

        // bar fill
        const pct = b.valuePercent;
        if (pct !== null) {
          const fillW = Math.max(0, Math.min(barW, (pct / 100) * barW));
          doc.save();
          roundRectPath(barLeftX, barY, fillW, barH, 999);
          doc.fillColor(ACCENT).fillOpacity(0.25).fill();
          doc.restore();

          doc
            .fillColor(ACCENT)
            .fontSize(10)
            .text(`${Math.round(pct)}%`, barLeftX, barY + 1, {
              width: barW,
              align: "center",
              lineBreak: false,
            });
        } else {
          doc
            .fillColor(MUTED)
            .fontSize(10)
            .text("ไม่มีข้อมูล", barLeftX, barY + 1, {
              width: barW,
              align: "center",
              lineBreak: false,
            });
        }

        // meta line (wrap within card)
        doc
          .fillColor(MUTED)
          .fontSize(9.5)
          .text(`${b.valueText} | ${b.meta}`, chartX + 12, metaY, {
            width: metaWidth,
            lineGap: LINE_GAP,
          });

        cursorY += rowH + (idx === bars.length - 1 ? 0 : rowGap);
      });

      doc.y = cardY + cardH + 14;
      doc.x = L;
    };

    const drawServiceEvaluationSection = (stats = {}) => {
      drawSectionTitle("สถิติประเมินราชการ");

      const total = stats.total ?? "-";
      const avg = formatScore(stats.averageOverallScore);
      const last = formatDateTimeThai(stats.lastSubmittedAt) || "-";

      drawFieldRow2({
        leftLabel: "จำนวนทั้งหมด",
        leftValue: total,
        rightLabel: "อัปเดตล่าสุด",
        rightValue: last,
      });
      drawFieldRow1({ label: "คะแนนเฉลี่ย", value: avg });

      const items = Array.isArray(stats.recentEvaluations)
        ? stats.recentEvaluations
        : [];
      if (!items.length) {
        drawFieldRow1({
          label: "แบบประเมินล่าสุด",
          value: "ไม่มีข้อมูลผลประเมินราชการ",
        });
        return;
      }

      items.forEach((ev) => {
        const evaluatorDisplay = (() => {
          const rankPart = ev.evaluatorRankLabel || ev.evaluatorRank || "";
          if (ev.evaluatorName) {
            return `${rankPart ? `${rankPart} ` : ""}${ev.evaluatorName}`.trim();
          }
          return rankPart || "-";
        })();

        drawFieldRow1({
          label: "แบบประเมิน",
          value: `${ev.templateName || "-"}`,
        });
        drawFieldRow2({
          leftLabel: "รอบ",
          leftValue: ev.evaluationRound || "-",
          rightLabel: "คะแนน",
          rightValue: formatScore(ev.overallScore),
        });
        drawFieldRow2({
          leftLabel: "ผู้ประเมิน",
          leftValue: evaluatorDisplay || "-",
          rightLabel: "ส่งเมื่อ",
          rightValue: formatDateTimeThai(ev.submittedAt) || "-",
        });
        if (ev.summary) {
          drawFieldRow1({ label: "สรุป", value: ev.summary });
        }
      });
    };

    const drawTaskCard = (task) => {
      drawFieldRow1({
        label: "ชื่องาน",
        value: `${task.title || "-"}${
          task.priority ? ` (${formatPriority(task.priority)})` : ""
        }`,
      });
      drawFieldRow2({
        leftLabel: "สถานะ",
        leftValue: formatTaskStatus(task.status),
        rightLabel: "ผู้มอบหมาย",
        rightValue: formatRankedName(task.creator),
      });
      drawFieldRow2({
        leftLabel: "เริ่ม",
        leftValue: formatDateTimeThai(task.startDate) || "-",
        rightLabel: "กำหนดส่ง",
        rightValue: formatDateTimeThai(task.dueDate) || "-",
      });
      drawFieldRow2({
        leftLabel: "ผู้รับผิดชอบ",
        leftValue: formatRankedName(task.assignee),
        rightLabel: "อัปเดตล่าสุด",
        rightValue: formatDateTimeThai(task.updatedAt) || "-",
      });
      if (task.description || task.noteToAssignee) {
        drawFieldRow1({
          label: "รายละเอียด",
          value: task.description || task.noteToAssignee || "-",
        });
      }
    };

    const drawTaskAssignmentsSection = (tasksData = {}) => {
      drawSectionTitle("ภารกิจ / มอบหมายงาน");
      const stats = tasksData.stats || {};
      drawFieldRow2({
        leftLabel: "ได้รับทั้งหมด",
        leftValue: stats.assignedTotal ?? "-",
        rightLabel: "กำลังทำ",
        rightValue: stats.assignedActive ?? "-",
      });
      // drawFieldRow1({
      //   label: "งานที่สร้าง (ทั้งหมด)",
      //   value: stats.createdTotal ?? "-",
      // });

      const received = Array.isArray(tasksData.asAssignee)
        ? tasksData.asAssignee
        : [];
      // const created = Array.isArray(tasksData.createdByUser)
      //   ? tasksData.createdByUser
      //   : [];

      if (!received.length) {
        drawFieldRow1({
          label: "งานที่ได้รับ",
          value: "ไม่มีข้อมูลงานที่ได้รับ",
        });
      } else {
        drawFieldRow1({
          label: "งานที่ได้รับ",
          value: `จำนวน ${received.length} งาน`,
        });
        received.forEach((task) => drawTaskCard(task));
      }

      // if (!created.length) {
      //   drawFieldRow1({
      //     label: "งานที่สร้าง",
      //     value: "ไม่มีข้อมูลงานที่สร้าง",
      //   });
      // } else {
      //   drawFieldRow1({
      //     label: "งานที่สร้าง",
      //     value: `จำนวน ${created.length} งาน`,
      //   });
      //   created.forEach((task) => drawTaskCard(task));
      // }
    };

    const drawLatestStudentEvaluationSheet = (sheet) => {
      if (!sheet) return;

      doc.addPage();
      drawMiniHeader();

      drawFieldRow2({
        leftLabel: "วิชา/หัวข้อ",
        leftValue: sheet.subject,
        rightLabel: "วันประเมิน",
        rightValue: formatDateThaiShort(sheet.evaluatedAt) || "-",
      });
      drawFieldRow2({
        leftLabel: "ชื่อครู",
        leftValue: sheet.teacherName,
        rightLabel: "หมายเหตุ",
        rightValue: sheet.notes || "-",
      });
    };

    const drawLeaveSection = (leaveStats = {}) => {
      drawSectionTitle("การลา (ครั้งล่าสุด)");

      const total = leaveStats?.total ?? null;
      const byStatus =
        leaveStats?.byStatus && typeof leaveStats.byStatus === "object"
          ? leaveStats.byStatus
          : null;

      const byStatusText = byStatus
        ? Object.entries(byStatus)
            .map(
              ([key, val]) =>
                `${formatEnumLabel(key, LEAVE_STATUS_LABELS)}: ${val}`
            )
            .join(" | ")
        : "-";

      drawFieldRow2({
        leftLabel: "จำนวนครั้ง (APPROVED)",
        leftValue:
          total === null || total === undefined ? "-" : String(total),
        rightLabel: "สรุปสถานะ",
        rightValue: byStatusText || "-",
      });

      const last = leaveStats?.lastLeave || null;
      if (!last) {
        drawFieldRow1({ label: "รายการล่าสุด", value: "ไม่มีข้อมูลการลาล่าสุด" });
        return;
      }

      drawFieldRow2({
        leftLabel: "ประเภทการลา",
        leftValue: formatEnumLabel(last.leaveType, LEAVE_TYPE_LABELS),
        rightLabel: "สถานะ",
        rightValue: formatEnumLabel(last.status, LEAVE_STATUS_LABELS),
      });
      drawFieldRow2({
        leftLabel: "วันที่เริ่ม",
        leftValue: formatDateTimeThai(last.startDate) || "-",
        rightLabel: "วันที่สิ้นสุด",
        rightValue: formatDateTimeThai(last.endDate) || "-",
      });
      drawFieldRow2({
        leftLabel: "ปลายทาง",
        leftValue: last.destination || "-",
        rightLabel: "ไปราชการ",
        rightValue: formatBooleanThai(last.isOfficialDuty),
      });
      drawFieldRow1({ label: "เหตุผล", value: last.reason || "-" });
      drawFieldRow2({
        leftLabel: "อนุมัติ (ผู้ดูแลระบบ)",
        leftValue: formatEnumLabel(last.adminApprovalStatus, APPROVAL_STATUS_LABELS),
        rightLabel: "อนุมัติ (เจ้าของระบบ)",
        rightValue: formatEnumLabel(last.ownerApprovalStatus, APPROVAL_STATUS_LABELS),
      });
      // drawFieldRow2({
      //   leftLabel: "สร้างเมื่อ",
      //   leftValue: formatDateTimeThai(last.createdAt) || "-",
      //   rightLabel: "อัปเดตล่าสุด",
      //   rightValue: formatDateTimeThai(last.updatedAt) || "-",
      // });
    };

    // =========================
    // Start drawing
    // =========================
    drawFirstHeader();

    drawSectionTitle("ข้อมูลพื้นฐาน");
    await drawAvatarBlock();
    drawFieldRow2({
      leftLabel: "Username",
      leftValue: user?.username,
      rightLabel: "บทบาท",
      rightValue: formatRoleLabel(user?.role),
    });
    drawFieldRow2({
      leftLabel: "สถานะ",
      leftValue: user?.isActive ? "Active" : "Inactive",
      rightLabel: "ยศ",
      rightValue: user?.rank,
    });
    drawFieldRow2({
      leftLabel: "อีเมล",
      leftValue: user?.email,
      rightLabel: "โทรศัพท์",
      rightValue: user?.phone,
    });
    drawFieldRow2({
      leftLabel: "ติดต่อฉุกเฉิน",
      leftValue: `${user?.emergencyContactName || "-"}${
        user?.emergencyContactPhone ? ` (${user.emergencyContactPhone})` : ""
      }`,
      rightLabel: "วันเกิด",
      rightValue: formatDateThaiShort(user?.birthDate) || "-",
    });
    drawFieldRow2({
      leftLabel: "ตำแหน่ง",
      leftValue: user?.position,
      rightLabel: "หมวดวิชา/ฝ่าย",
      rightValue: user?.division,
    });
    drawFieldRow2({
      leftLabel: "การศึกษา",
      leftValue: user?.education,
      rightLabel: "ศาสนา",
      rightValue: user?.religion,
    });
    // drawFieldRow2({
    //   leftLabel: "สร้างเมื่อ",
    //   leftValue: formatDateTimeThai(user?.createdAt) || "-",
    //   rightLabel: "อัปเดตล่าสุด",
    //   rightValue: formatDateTimeThai(user?.updatedAt) || "-",
    // });
    drawFieldRow1({ label: "ที่อยู่", value: user?.fullAddress });
    drawFieldRow1({ label: "ทักษะพิเศษ", value: user?.specialSkills });
    drawFieldRow1({ label: "อาชีพเสริม", value: user?.secondaryOccupation });

    drawSectionTitle("ข้อมูลสุขภาพ");
    drawFieldRow1({ label: "ประวัติการรักษา", value: user?.medicalHistory });
    drawFieldRow1({
      label: "โรคประจำตัว",
      value: formatList(user?.chronicDiseases),
    });
    drawFieldRow1({
      label: "แพ้อาหาร",
      value: formatList(user?.foodAllergies),
    });
    drawFieldRow1({
      label: "แพ้ยา",
      value: formatList(user?.drugAllergies),
    });

    drawSectionTitle("สถิติ");
    const teacherStats = user?.teacherEvaluationStats || {};
    const studentStats = user?.studentEvaluationStats || {};
    const leaveStats = user?.leaveStats || {};

    drawStatsBarChart({
      studentAverageRating: studentStats.averageRating,
      studentTotalSheets: studentStats.totalSheets,
      studentLastEvaluatedAt: studentStats.lastEvaluatedAt,
      teacherAverageOverallScore: teacherStats.averageOverallScore,
      teacherTotal: teacherStats.total,
      teacherLastSubmittedAt: teacherStats.lastSubmittedAt,
    });
    drawServiceEvaluationSection(user?.serviceEvaluationStats);
    drawTaskAssignmentsSection(user?.taskAssignments);
    drawLeaveSection(leaveStats);

    drawRadarChart(user?.radarProfile);

    doc.end();
  });

module.exports = { buildUserProfilePdfBuffer };
