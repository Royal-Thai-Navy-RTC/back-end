const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const routes = require("./routes");
const morgan = require("morgan");
const config = require("./config");

const app = express();
const PORT = process.env.PORT || 3000;

const TRUST_PROXY = process.env.TRUST_PROXY || "loopback";
app.set("trust proxy", TRUST_PROXY);

app.use(cors());
app.use(morgan("dev"));

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

// ---------- Static dist (Frontend) ----------
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// ---------- Start Server ----------
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
