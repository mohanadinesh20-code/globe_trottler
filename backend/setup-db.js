const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

// Try different possible superuser credentials
const possibleCredentials = [
  { user: 'postgres', password: 'postgres' },
  { user: 'postgres', password: 'your_password' },
  { user: 'postgres', password: '' },
  { user: process.env.DB_USER || 'globeuser', password: process.env.DB_PASSWORD || 'your_password' }
];

const schema = fs.readFileSync('./schema.sql', 'utf8');

async function setupDatabase() {
  let defaultClient = null;
  
  // Try to connect with different credentials
  for (const cred of possibleCredentials) {
    try {
      console.log(`Trying to connect with user: ${cred.user}`);
      defaultClient = new Client({
        user: cred.user,
        host: process.env.DB_HOST || 'localhost',
        database: 'postgres',
        password: cred.password,
        port: process.env.DB_PORT || 5432,
      });
      
      await defaultClient.connect();
      console.log(`Connected successfully with user: ${cred.user}`);
      break;
    } catch (connectErr) {
      console.log(`Failed to connect with user: ${cred.user}`, connectErr.message);
      defaultClient = null;
      continue;
    }
  }
  
  if (!defaultClient) {
    console.error('Could not connect to PostgreSQL with any of the tried credentials');
    console.log('Make sure PostgreSQL is running and the credentials are correct.');
    console.log('Default credentials to try: postgres/postgres, postgres/(empty), or your specific DB credentials');
    process.exit(1);
  }

  try {
    // Create the database if it doesn't exist
    const dbExists = await defaultClient.query(
      `SELECT 1 FROM pg_catalog.pg_database WHERE datname = '${process.env.DB_NAME || 'globetrotter'}'`
    );
    
    if (dbExists.rowCount === 0) {
      console.log('Creating database...');
      await defaultClient.query(`CREATE DATABASE "${process.env.DB_NAME || 'globetrotter'}"`);
      console.log('Database created');
    } else {
      console.log('Database already exists');
    }

    // Create user if it doesn't exist
    const userExists = await defaultClient.query(
      `SELECT 1 FROM pg_roles WHERE rolname = '${process.env.DB_USER || 'globeuser'}'`
    );
    
    if (userExists.rowCount === 0) {
      console.log('Creating user...');
      await defaultClient.query(`CREATE USER "${process.env.DB_USER || 'globeuser'}" WITH PASSWORD '${process.env.DB_PASSWORD || 'your_password'}'`);
      console.log('User created');
    } else {
      console.log('User already exists');
    }

    // Grant privileges
    await defaultClient.query(`GRANT ALL PRIVILEGES ON DATABASE "${process.env.DB_NAME || 'globetrotter'}" TO "${process.env.DB_USER || 'globeuser'}"`);
    console.log('Privileges granted to database');

    // Connect to the new database to create tables
    await defaultClient.end();
    
    // Connect with superuser to grant schema privileges
    const adminClient = new Client({
      user: 'postgres', // Try to connect as postgres for schema privileges
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'globetrotter',
      password: 'postgres', // You may need to update this to your actual postgres password
      port: process.env.DB_PORT || 5432,
    });
    
    try {
      await adminClient.connect();
      console.log('Connected to application database as admin');
      
      // Grant schema privileges
      await adminClient.query(`GRANT ALL ON SCHEMA public TO "${process.env.DB_USER || 'globeuser'}"`);
      await adminClient.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${process.env.DB_USER || 'globeuser'}"`);
      await adminClient.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${process.env.DB_USER || 'globeuser'}"`);
      console.log('Schema privileges granted');
      
      await adminClient.end();
    } catch (adminErr) {
      console.log('Could not connect as admin to grant schema privileges:', adminErr.message);
      console.log('Attempting to connect with user credentials to create tables...');
    }

    // Now connect with the application user to create tables
    const appClient = new Client({
      user: process.env.DB_USER || 'globeuser',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'globetrotter',
      password: process.env.DB_PASSWORD || 'your_password',
      port: process.env.DB_PORT || 5432,
    });
    
    await appClient.connect();
    console.log('Connected to application database');
    
    // Execute schema
    console.log('Creating tables...');
    await appClient.query(schema);
    console.log('Tables created successfully');
    
    await appClient.end();
    console.log('Database setup completed!');
    
  } catch (err) {
    console.error('Error setting up database:', err);
    process.exit(1);
  }
}

setupDatabase();