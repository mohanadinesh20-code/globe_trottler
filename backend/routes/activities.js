// routes/activities.js
const express = require('express');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// The activities array is already defined in cities.js and would be shared
// For this fallback approach, we'll use the same activities array

// Try to use database, fallback to in-memory if unavailable
const useDatabase = true; // Change to false to force in-memory mode
let db = null;

try {
  db = require('../db');
} catch (err) {
  console.log('Database module not available, using in-memory storage for activities');
}

// Since activities array is defined in cities.js, we need to access it differently
// For this implementation, we'll define it here as well for consistency
let activities = [
  { activity_id: 1, activity_name: "Eiffel Tower Visit", city_id: 1, category: "Landmark", description: "Visit the iconic Eiffel Tower", image_url: "https://example.com/eiffel.jpg", estimated_cost: 25, duration_hours: 2, rating: 4.8 },
  { activity_id: 2, activity_name: "Louvre Museum", city_id: 1, category: "Museum", description: "Explore world-class art", image_url: "https://example.com/louvre.jpg", estimated_cost: 18, duration_hours: 4, rating: 4.9 },
  { activity_id: 3, activity_name: "Shibuya Crossing", city_id: 2, category: "Landmark", description: "Experience the famous scramble crossing", image_url: "https://example.com/shibuya.jpg", estimated_cost: 0, duration_hours: 1, rating: 4.7 },
  { activity_id: 4, activity_name: "Statue of Liberty", city_id: 3, category: "Landmark", description: "Visit the iconic symbol of freedom", image_url: "https://example.com/statue.jpg", estimated_cost: 20, duration_hours: 3, rating: 4.6 }
];

// Search activities
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { city_id, category, min_cost, max_cost, query, limit = 50 } = req.query;

    if (useDatabase && db) {
      try {
        let sqlQuery = 'SELECT * FROM activities WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (city_id) {
          sqlQuery += ` AND city_id = $${paramCount}`;
          params.push(city_id);
          paramCount++;
        }

        if (category) {
          sqlQuery += ` AND category = $${paramCount}`;
          params.push(category);
          paramCount++;
        }

        if (min_cost) {
          sqlQuery += ` AND estimated_cost >= $${paramCount}`;
          params.push(min_cost);
          paramCount++;
        }

        if (max_cost) {
          sqlQuery += ` AND estimated_cost <= $${paramCount}`;
          params.push(max_cost);
          paramCount++;
        }

        if (query) {
          sqlQuery += ` AND (activity_name ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
          params.push(`%${query}%`);
          paramCount++;
        }

        sqlQuery += ` ORDER BY activity_name LIMIT $${paramCount}`;
        params.push(limit);

        const result = await db.query(sqlQuery, params);
        res.json(result.rows);
        return;
      } catch (dbError) {
        console.log('Database error in search activities, switching to in-memory mode:', dbError.message);
      }
    }

    // Fallback to in-memory storage
    let filteredActivities = activities;
    
    if (city_id) {
      filteredActivities = filteredActivities.filter(activity => 
        activity.city_id === parseInt(city_id)
      );
    }
    
    if (category) {
      filteredActivities = filteredActivities.filter(activity => 
        activity.category.toLowerCase() === category.toLowerCase()
      );
    }
    
    if (min_cost) {
      filteredActivities = filteredActivities.filter(activity => 
        activity.estimated_cost >= parseFloat(min_cost)
      );
    }
    
    if (max_cost) {
      filteredActivities = filteredActivities.filter(activity => 
        activity.estimated_cost <= parseFloat(max_cost)
      );
    }
    
    if (query) {
      filteredActivities = filteredActivities.filter(activity => 
        activity.activity_name.toLowerCase().includes(query.toLowerCase()) || 
        activity.description.toLowerCase().includes(query.toLowerCase())
      );
    }

    const limitedActivities = filteredActivities
      .sort((a, b) => a.activity_name.localeCompare(b.activity_name))
      .slice(0, parseInt(limit));

    res.json(limitedActivities);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get activity categories
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    if (useDatabase && db) {
      try {
        const result = await db.query(
          'SELECT DISTINCT category FROM activities WHERE category IS NOT NULL ORDER BY category'
        );
        res.json(result.rows.map(row => row.category));
        return;
      } catch (dbError) {
        console.log('Database error in get activity categories, switching to in-memory mode:', dbError.message);
      }
    }

    // Fallback to in-memory storage
    const categories = [...new Set(activities
      .filter(activity => activity.category)
      .map(activity => activity.category)
    )].sort();
    
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single activity
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const activityId = parseInt(req.params.id);

    if (useDatabase && db) {
      try {
        const result = await db.query(
          'SELECT * FROM activities WHERE activity_id = $1',
          [activityId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Activity not found' });
        }

        res.json(result.rows[0]);
        return;
      } catch (dbError) {
        console.log('Database error in get single activity, switching to in-memory mode:', dbError.message);
      }
    }

    // Fallback to in-memory storage
    const activity = activities.find(a => a.activity_id === activityId);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json(activity);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;