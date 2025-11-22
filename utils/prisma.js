require("dotenv").config();

const { PrismaClient } = require("../generated/prisma");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

let connectionString = process.env.DATABASE_URL;
// MariaDB driver expects the scheme "mariadb://". Convert if env uses "mysql://".
if (connectionString && connectionString.startsWith("mysql://")) {
  connectionString = connectionString.replace(/^mysql:\/\//i, "mariadb://");
}
if (!connectionString) {
  throw new Error("Missing DATABASE_URL for Prisma connection");
}

// Optionally override pool size via DB_POOL_SIZE by appending to the URL.
const poolLimit =
  Number(process.env.DB_POOL_SIZE) && Number(process.env.DB_POOL_SIZE) > 0
    ? Number(process.env.DB_POOL_SIZE)
    : null;
if (poolLimit) {
  try {
    const url = new URL(connectionString);
    if (!url.searchParams.has("connectionLimit")) {
      url.searchParams.set("connectionLimit", String(poolLimit));
      connectionString = url.toString();
    }
  } catch {
    // fallback silently if URL parsing fails
  }
}

// Driver adapter required for Prisma 7 client engine (MySQL/MariaDB)
const adapter = new PrismaMariaDb(connectionString);

// Shared Prisma client with MariaDB/MySQL adapter
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
