import pg from "pg";

const { Pool, types } = pg;

// Načítá typ date z PostgreSQL jako string a ne jako JavaScript Date, aby nedocházelo k problémům s časovými zónami
types.setTypeParser(1082, (value) => value);

// Vytvoření poolu pro připojení k PostgreSQL databázi
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Test připojení k databázi
pool.connect((err, client, release) => {
  if (err) {
    console.error("Error connecting to Supabase PostgreSQL:", err.stack);
  } else {
    console.log("Connected to Supabase PostgreSQL");
    release();
  }
});

export default pool;
