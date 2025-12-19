const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream");

const backupDir = path.join(__dirname, "..", "backups");

const pad = (value) => String(value).padStart(2, "0");

const buildBackupFilename = (dbName) => {
  const now = new Date();
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate()
  )}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const safeName = dbName && dbName.trim() ? dbName.trim() : "database";
  return `${safeName}_backup_${timestamp}.sql`;
};

const parseDatabaseUrl = (connectionString) => {
  if (!connectionString || typeof connectionString !== "string") {
    throw new Error("DATABASE_URL ไม่ถูกตั้งค่า");
  }
  let normalized = connectionString.trim();
  if (normalized.startsWith("mariadb://")) {
    normalized = normalized.replace(/^mariadb:\/\//i, "mysql://");
  }
  let url;
  try {
    url = new URL(normalized);
  } catch (err) {
    throw new Error("รูปแบบ DATABASE_URL ไม่ถูกต้อง");
  }
  const database = (url.pathname || "").replace(/^\//, "");
  if (!database) {
    throw new Error("DATABASE_URL ไม่มีชื่อฐานข้อมูล");
  }
  return {
    host: url.hostname || "localhost",
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username || ""),
    password: decodeURIComponent(url.password || ""),
    database,
  };
};

const runDatabaseBackup = async (dbConfig, filePath) => {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

  const args = [
    "-h",
    dbConfig.host,
    "-P",
    String(dbConfig.port || 3306),
    "-u",
    dbConfig.user,
    "--single-transaction",
    "--routines",
    "--events",
    "--triggers",
    "--skip-lock-tables",
    dbConfig.database,
  ];

  const env = { ...process.env };
  if (dbConfig.password) {
    env.MYSQL_PWD = dbConfig.password;
  }

  await new Promise((resolve, reject) => {
    const dumpProcess = spawn("mysqldump", args, { env });
    const output = fs.createWriteStream(filePath);
    let stderr = "";

    dumpProcess.on("error", (err) => reject(err));

    output.on("error", (err) => {
      dumpProcess.kill("SIGTERM");
      reject(err);
    });

    dumpProcess.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    dumpProcess.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error(
            stderr || `mysqldump exited with code ${code || "unknown"}`
          )
        );
      }
      resolve();
    });

    dumpProcess.stdout.pipe(output);
  });
};

const streamFileToResponse = async (res, filePath, options = {}) => {
  const { filename, contentType = "application/octet-stream" } = options;
  const stat = await fs.promises.stat(filePath);
  const size = stat.size || 0;

  if (contentType) {
    res.setHeader("Content-Type", contentType);
  }
  if (filename) {
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  }
  if (size > 0) {
    res.setHeader("Content-Length", size);
    res.setHeader("X-Archive-Uncompressed-Bytes", size);
  }
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Length, X-Archive-Uncompressed-Bytes, Content-Disposition"
  );
  res.setHeader("Cache-Control", "no-cache");

  await new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(filePath);
    pipeline(readStream, res, (err) => (err ? reject(err) : resolve()));
  });
};

const downloadDatabaseBackup = async (req, res) => {
  let filePath = null;
  try {
    const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL);
    if (!dbConfig.user) {
      return res
        .status(500)
        .json({ message: "DATABASE_URL ต้องระบุ username สำหรับสำรองข้อมูล" });
    }

    const filename = buildBackupFilename(dbConfig.database);
    filePath = path.join(backupDir, filename);

    await runDatabaseBackup(dbConfig, filePath);

    await streamFileToResponse(res, filePath, {
      filename,
      contentType: "application/sql",
    });
  } catch (err) {
    if (
      err?.code === "ENOENT" ||
      err?.message?.toLowerCase().includes("mysqldump")
    ) {
      if (!res.headersSent) {
        res.status(500).json({
          message:
            "ไม่พบคำสั่ง mysqldump ในเซิร์ฟเวอร์ กรุณาติดตั้ง MySQL Client",
          detail: err.message,
        });
      }
      return;
    }
    if (err.message && err.message.includes("DATABASE_URL")) {
      if (!res.headersSent) {
        res.status(500).json({ message: err.message });
      }
      return;
    }
    if (!res.headersSent) {
      res.status(500).json({
        message: "ไม่สามารถสำรองฐานข้อมูลได้",
        detail: err.message,
      });
    }
  }
  if (filePath) {
    fs.promises.unlink(filePath).catch(() => {});
  }
};

module.exports = {
  downloadDatabaseBackup,
};
