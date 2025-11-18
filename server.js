const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const routes = require("./routes");
const morgan = require("morgan");

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins and standard headers/methods
app.use(cors());
app.use(morgan("dev"));
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
// Serve uploaded files publicly with aggressive caching for static assets
const uploadsDir = path.join(__dirname, "uploads");
app.use(
  "/uploads",
  express.static(uploadsDir, {
    setHeaders: (res, filePath) => {
      if (/\.(png|jpe?g|webp|gif|svg)$/i.test(filePath)) {
        // Avatar/ภาพให้ cache ยาวนาน เพื่อลดการยิงซ้ำ
        res.setHeader(
          "Cache-Control",
          "public, max-age=31536000, immutable"
        );
      } else {
        // ไฟล์อื่น cache พอประมาณ
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
    },
  })
);
app.use("/api", routes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
