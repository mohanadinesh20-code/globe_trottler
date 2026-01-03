const db = require('./db');
const fs = require('fs');

async function createTables() {
  try {
    // Read the schema file
    const schema = fs.readFileSync('./schema.sql', 'utf8');
    
    console.log('Creating database tables...');
    
    // Execute the schema
    await db.query(schema);
    
    console.log('Schema created successfully!');
  } catch (err) {
    console.error('Error creating schema:', err.message);
    
    // If the full schema fails, try creating just the users table
    const createUserTable = `
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    try {
      await db.query(createUserTable);
      console.log('Users table created successfully!');
      
      // Create other essential tables
      const createCitiesTable = `
        CREATE TABLE IF NOT EXISTS cities (
          city_id SERIAL PRIMARY KEY,
          city_name VARCHAR(255) NOT NULL,
          country VARCHAR(255) NOT NULL,
          description TEXT,
          image_url VARCHAR(500),
          cost_index DECIMAL(10,2),
          popularity_score INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      await db.query(createCitiesTable);
      console.log('Cities table created successfully!');
      
      const createActivitiesTable = `
        CREATE TABLE IF NOT EXISTS activities (
          activity_id SERIAL PRIMARY KEY,
          activity_name VARCHAR(255) NOT NULL,
          city_id INTEGER REFERENCES cities(city_id),
          category VARCHAR(100),
          description TEXT,
          image_url VARCHAR(500),
          estimated_cost DECIMAL(10,2),
          duration_hours DECIMAL(5,2),
          rating DECIMAL(3,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      await db.query(createActivitiesTable);
      console.log('Activities table created successfully!');
      
      const createTripsTable = `
        CREATE TABLE IF NOT EXISTS trips (
          trip_id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
          trip_name VARCHAR(255) NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          description TEXT,
          cover_photo VARCHAR(500),
          is_public BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      await db.query(createTripsTable);
      console.log('Trips table created successfully!');
      
      console.log('All essential tables created successfully!');
    } catch (err2) {
      console.error('Error creating individual tables:', err2.message);
      console.error('The database connection or permissions may need to be configured properly.');
      process.exit(1);
    }
  }
  
  console.log('Database setup completed!');
  process.exit(0);
}

createTables();