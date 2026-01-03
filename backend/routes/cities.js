// routes/cities.js
const express = require('express');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// In-memory storage for fallback
let cities = [
  { city_id: 1, city_name: "Paris", country: "France", description: "The City of Light", image_url: "https://example.com/paris.jpg", cost_index: 120, popularity_score: 95 },
  { city_id: 2, city_name: "Tokyo", country: "Japan", description: "Vibrant metropolis blending tradition and modernity", image_url: "https://example.com/tokyo.jpg", cost_index: 150, popularity_score: 98 },
  { city_id: 3, city_name: "New York", country: "USA", description: "The Big Apple", image_url: "https://example.com/ny.jpg", cost_index: 200, popularity_score: 97 },
  { city_id: 4, city_name: "London", country: "UK", description: "Historic capital of England", image_url: "https://example.com/london.jpg", cost_index: 140, popularity_score: 93 },
  { city_id: 5, city_name: "Sydney", country: "Australia", description: "Harbor city with iconic Opera House", image_url: "https://example.com/sydney.jpg", cost_index: 130, popularity_score: 88 }
];
let activities = [
  { activity_id: 1, activity_name: "Eiffel Tower Visit", city_id: 1, category: "Landmark", description: "Visit the iconic Eiffel Tower", image_url: "https://example.com/eiffel.jpg", estimated_cost: 25, duration_hours: 2, rating: 4.8 },
  { activity_id: 2, activity_name: "Louvre Museum", city_id: 1, category: "Museum", description: "Explore world-class art", image_url: "https://example.com/louvre.jpg", estimated_cost: 18, duration_hours: 4, rating: 4.9 },
  { activity_id: 3, activity_name: "Shibuya Crossing", city_id: 2, category: "Landmark", description: "Experience the famous scramble crossing", image_url: "https://example.com/shibuya.jpg", estimated_cost: 0, duration_hours: 1, rating: 4.7 },
  { activity_id: 4, activity_name: "Statue of Liberty", city_id: 3, category: "Landmark", description: "Visit the iconic symbol of freedom", image_url: "https://example.com/statue.jpg", estimated_cost: 20, duration_hours: 3, rating: 4.6 }
];

// Try to use database, fallback to in-memory if unavailable
const useDatabase = true; // Change to false to force in-memory mode
let db = null;

try {
  db = require('../db');
} catch (err) {
  console.log('Database module not available, using in-memory storage for cities');
}

// Search cities
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { query, country, region, limit = 20 } = req.query;

    if (useDatabase && db) {
      try {
        let sqlQuery = 'SELECT * FROM cities WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (query) {
          sqlQuery += ` AND (city_name ILIKE $${paramCount} OR country ILIKE $${paramCount})`;
          params.push(`%${query}%`);
          paramCount++;
        }

        if (country) {
          sqlQuery += ` AND country = $${paramCount}`;
          params.push(country);
          paramCount++;
        }

        if (region) {
          sqlQuery += ` AND region = $${paramCount}`;
          params.push(region);
          paramCount++;
        }

        sqlQuery += ` ORDER BY popularity_score DESC, city_name LIMIT $${paramCount}`;
        params.push(limit);

        const result = await db.query(sqlQuery, params);
        res.json(result.rows);
        return;
      } catch (dbError) {
        console.log('Database error in search cities, switching to in-memory mode:', dbError.message);
      }
    }

    // Fallback to in-memory storage
    let filteredCities = cities;
    
    if (query) {
      filteredCities = filteredCities.filter(city => 
        city.city_name.toLowerCase().includes(query.toLowerCase()) || 
        city.country.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    if (country) {
      filteredCities = filteredCities.filter(city => 
        city.country.toLowerCase() === country.toLowerCase()
      );
    }
    
    if (region) {
      // Assuming region filtering is based on some property if available
      // For now, skip region filtering in memory mode
    }

    const sortedCities = filteredCities
      .sort((a, b) => b.popularity_score - a.popularity_score)
      .slice(0, parseInt(limit));

    res.json(sortedCities);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get popular cities
router.get('/popular', authenticateToken, async (req, res) => {
  try {
    if (useDatabase && db) {
      try {
        const result = await db.query(
          'SELECT * FROM cities ORDER BY popularity_score DESC LIMIT 10'
        );
        res.json(result.rows);
        return;
      } catch (dbError) {
        console.log('Database error in get popular cities, switching to in-memory mode:', dbError.message);
      }
    }

    // Fallback to in-memory storage
    const popularCities = cities
      .sort((a, b) => b.popularity_score - a.popularity_score)
      .slice(0, 10);
    
    res.json(popularCities);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single city with activities
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const cityId = parseInt(req.params.id);

    if (useDatabase && db) {
      try {
        const cityResult = await db.query(
          'SELECT * FROM cities WHERE city_id = $1',
          [cityId]
        );

        if (cityResult.rows.length === 0) {
          return res.status(404).json({ error: 'City not found' });
        }

        const city = cityResult.rows[0];

        const activitiesResult = await db.query(
          'SELECT * FROM activities WHERE city_id = $1 ORDER BY category, activity_name',
          [cityId]
        );

        city.activities = activitiesResult.rows;
        res.json(city);
        return;
      } catch (dbError) {
        console.log('Database error in get single city, switching to in-memory mode:', dbError.message);
      }
    }

    // Fallback to in-memory storage
    const city = cities.find(c => c.city_id === cityId);
    if (!city) {
      return res.status(404).json({ error: 'City not found' });
    }

    const cityWithActivities = {
      ...city,
      activities: activities.filter(a => a.city_id === cityId)
    };
    
    res.json(cityWithActivities);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;