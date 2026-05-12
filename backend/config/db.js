const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'DentoGraphDB',
  password: '1000MunaKase',
  port: 5432,
});

module.exports = pool;