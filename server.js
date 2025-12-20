const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const routes = require("./routes");
const morgan = require("morgan");
const config = require("./config");
const {
  verifyToken,
  authorizeSoldierData,
} = require("./middlewares/middleware");
const helmet = require("helmet");

/* ===================== Swagger ===================== */
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
/* =================================================== */

const app = express();
const PORT = process.env.PORT || 3000;

const TRUST_PROXY = process.env.TRUST_PROXY || "loopback";
app.set("trust proxy", TRUST_PROXY);

const isProd = process.env.NODE_ENV === "production";
const prodOrigins = ["https://rtcas.in.th", "https://www.rtcas.in.th"];
const allowedOrigins = isProd
  ? prodOrigins
  : [
      ...prodOrigins,
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
    ];
const isLocalNetworkOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3})/i.test(
    origin || ""
  );

// ซ่อน X-Powered-By: Express
app.disable("x-powered-by");

// ถ้าคุณคุม Security Headers ที่ Nginx แล้ว ให้ปิดใน helmet เพื่อไม่ให้ซ้ำ
app.use(
  helmet({
    contentSecurityPolicy: false,
    xContentTypeOptions: false,
    frameguard: false,
    referrerPolicy: false,
    permissionsPolicy: false,
    // Allow static assets (e.g., avatars) to be embedded from other origins in dev
    crossOriginResourcePolicy: isProd ? undefined : false,
    crossOriginOpenerPolicy: isProd ? undefined : false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Allow same-origin/non-browser clients
      if (!isProd && isLocalNetworkOrigin(origin)) {
        return callback(null, true);
      }
      const isAllowed = allowedOrigins.includes(origin);
      return callback(null, isAllowed);
    },
    credentials: true,
    exposedHeaders: [
      "Content-Length",
      "X-Archive-Uncompressed-Bytes",
      "Content-Disposition",
      "X-Archive-Total-Files",
    ],
  })
);

app.use(
  morgan("| :remote-addr | :method :url :status :response-time ms")
);

/* ===================== Swagger Config ===================== */
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "RTCAS API",
      version: "1.0.0",
      description: "RTCAS Backend API Definition",
    },
    servers: [
      { url: "http://localhost:3000" },
      { url: "https://api.rtcas.in.th" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // ✅ แนะนำให้เป็น **/*.js เพื่อครอบคลุม routes ซ้อนโฟลเดอร์
  apis: [path.join(__dirname, "routes/**/*.js")],
});

/**
 * 🔒 Swagger เปิดเฉพาะ Non-Production
 * Production: ปิดทั้ง /api-docs และ /openapi.json (ตอบ 404)
 */
if (!isProd) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Definition file (ใช้กับ ZAP / Postman / CI) เฉพาะ dev/staging
  app.get("/openapi.json", (req, res) => {
    res.json(swaggerSpec);
  });
} else {
  // กันเผื่อมีคนยิงมาที่ path นี้บน production
  app.get("/api-docs", (req, res) => res.sendStatus(404));
  app.get("/openapi.json", (req, res) => res.sendStatus(404));
}
/* ========================================================= */

const apiRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: "ขออภัย มีการส่งคำขอจำนวนมากเกินไป กรุณาลองใหม่ภายหลัง",
    });
  },
});

app.use(
  bodyParser.json({
    limit: process.env.REQUEST_BODY_LIMIT || "10mb",
  })
);

app.use(
  bodyParser.urlencoded({
    limit: process.env.REQUEST_BODY_LIMIT || "10mb",
    extended: true,
  })
);

// ---------- Body parser error handler ----------
// Handles invalid JSON payloads (e.g. `""John Doe""` which is not valid JSON)
app.use((err, req, res, next) => {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  const isJsonRequest =
    req.is?.("application/json") ||
    contentType.includes("application/json") ||
    contentType.includes("+json");

  const isBodyParserJsonError =
    err &&
    (err.type === "entity.parse.failed" ||
      (err instanceof SyntaxError && err.status === 400 && "body" in err));

  if (isJsonRequest && isBodyParserJsonError) {
    return res.status(400).json({
      message: "Invalid JSON payload",
      detail: err.message,
      hint: 'Make sure strings are quoted once, e.g. "John Doe" (not ""John Doe"")',
    });
  }

  return next(err);
});

// ---------- Static uploads ----------
const uploadsDir = path.join(__dirname, "uploads");
const idCardsDir = path.join(uploadsDir, "idcards");

// Protect sensitive ID card images with token auth
app.use(
  "/uploads/idcards",
  verifyToken,
  authorizeSoldierData,
  express.static(idCardsDir, {
    setHeaders: (res, filePath) => {
      res.setHeader("Cache-Control", "private, max-age=600");
    },
  })
);

app.use(
  "/uploads",
  express.static(uploadsDir, {
    setHeaders: (res, filePath) => {
      if (/\.(png|jpe?g|webp|gif|svg)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
    },
  })
);

// ---------- API ----------
app.use("/api", apiRateLimiter, routes);

// const distPath = path.join(__dirname, "..", "front-end", "dist");
// app.use(express.static(distPath));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

  if (!isProd) {
    console.log(`Swagger UI → http://localhost:${PORT}/api-docs`);
    console.log(`OpenAPI JSON → http://localhost:${PORT}/openapi.json`);
  }
});
