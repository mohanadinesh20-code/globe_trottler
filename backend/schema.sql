-- Database schema for GlobeTrotter application

-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cities table
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

-- Activities table
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

-- Trips table
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

-- Trip stops table
CREATE TABLE IF NOT EXISTS trip_stops (
    stop_id SERIAL PRIMARY KEY,
    trip_id INTEGER REFERENCES trips(trip_id) ON DELETE CASCADE,
    city_id INTEGER REFERENCES cities(city_id),
    arrival_date DATE NOT NULL,
    departure_date DATE NOT NULL,
    stop_order INTEGER,
    accommodation_cost DECIMAL(10,2) DEFAULT 0,
    transport_cost DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trip activities table
CREATE TABLE IF NOT EXISTS trip_activities (
    trip_activity_id SERIAL PRIMARY KEY,
    stop_id INTEGER REFERENCES trip_stops(stop_id) ON DELETE CASCADE,
    activity_id INTEGER REFERENCES activities(activity_id),
    scheduled_date DATE,
    scheduled_time TIME,
    actual_cost DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Budget breakdown table
CREATE TABLE IF NOT EXISTS budget_breakdown (
    budget_id SERIAL PRIMARY KEY,
    trip_id INTEGER REFERENCES trips(trip_id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    estimated_amount DECIMAL(10,2),
    actual_amount DECIMAL(10,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);