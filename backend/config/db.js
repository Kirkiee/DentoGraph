const { Pool } = require("pg");
require("dotenv").config();

const connectionString =
  process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT),
      ssl: { rejectUnauthorized: false },
    });

module.exports = pool;