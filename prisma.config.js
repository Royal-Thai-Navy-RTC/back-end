require("dotenv").config();

// Prisma 7 config: keep datasource URL here (schema.prisma no longer stores it)
module.exports = {
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
};
