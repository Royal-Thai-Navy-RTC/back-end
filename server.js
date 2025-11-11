const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const routes = require("./routes");

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins and standard headers/methods
app.use(cors());
app.use(bodyParser.json());
// Serve uploaded files publicly
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api", routes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
