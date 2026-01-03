// db.js - Database Connection
const { Pool } = require('pg');
require('dotenv').config(); // Make sure environment variables are loaded

// Log environment variables to debug
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***HIDDEN***' : 'UNDEFINED');
console.log('DB_PORT:', process.env.DB_PORT);

const pool = new Pool({
  user: process.env.DB_USER || 'globeuser',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'globetrotter',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

module.exports = {
  query: (text, params) => {
    console.log('Executing query:', text.substring(0, 50) + '...');
    return pool.query(text, params);
  },
  pool
};