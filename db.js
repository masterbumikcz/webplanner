import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.connect((err, client, release) => {
  if (err) {
    console.error("Error connecting to Supabase PostgreSQL:", err.stack);
  } else {
    console.log("Connected to Supabase PostgreSQL");
    release();
  }
});

export default pool;
