const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const routes = require("./routes");
const morgan = require("morgan");
const config = require("./config");
const { verifyToken, authorizeSoldierData } = require("./middlewares/middleware");
const helmet = require("helmet");

/* ===================== Swagger ===================== */
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
/* =================================================== */

const app = express();
const PORT = process.env.PORT || 3000;

const TRUST_PROXY = process.env.TRUST_PROXY || "loopback";
app.set("trust proxy", TRUST_PROXY);

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
  })
);

app.use(
  cors({
    origin: ["https://rtcas.in.th", "https://www.rtcas.in.th"],
    credentials: true,
  })
);

app.use(morgan("dev"));

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
  apis: [path.join(__dirname, "routes/*.js")], // scan routes ทั้งหมด
});

/**
 * 🔒 เปิด Swagger เฉพาะ DEV
 * production ให้ดูผ่าน openapi.json หรือ VPN/SSH เท่านั้น
 */
if (process.env.NODE_ENV !== "production") {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// Definition file (ใช้กับ ZAP / Postman / CI)
app.get("/openapi.json", (req, res) => {
  res.json(swaggerSpec);
});
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

  if (process.env.NODE_ENV !== "production") {
    console.log(`Swagger UI → http://localhost:${PORT}/api-docs`);
  }

  console.log(`OpenAPI JSON → http://localhost:${PORT}/openapi.json`);
});
