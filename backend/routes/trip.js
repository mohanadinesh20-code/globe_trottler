// routes/trip.js
const express = require('express');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// In-memory storage for fallback
let trips = [];
let tripStops = [];
let tripActivities = [];
let budgetBreakdown = [];
let nextTripId = 1;
let nextStopId = 1;
let nextActivityId = 1;
let nextBudgetId = 1;

// Try to use database, fallback to in-memory if unavailable
const useDatabase = true; // Change to false to force in-memory mode
let db = null;

try {
  db = require('../db');
} catch (err) {
  console.log('Database module not available, using in-memory storage for trips');
}

// Get all trips for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    if (useDatabase && db) {
      try {
        const result = await db.query(
          `SELECT t.*, 
            COUNT(DISTINCT ts.stop_id) as stop_count,
            COALESCE(SUM(bb.estimated_amount), 0) as total_budget
           FROM trips t
           LEFT JOIN trip_stops ts ON t.trip_id = ts.trip_id
           LEFT JOIN budget_breakdown bb ON t.trip_id = bb.trip_id
           WHERE t.user_id = $1
           GROUP BY t.trip_id
           ORDER BY t.start_date DESC`,
          [req.user.user_id]
        );
        res.json(result.rows);
        return;
      } catch (dbError) {
        console.log('Database error in get trips, switching to in-memory mode:', dbError.message);
      }
    }

    // Fallback to in-memory storage
    const userTrips = trips.filter(t => t.user_id === req.user.user_id);
    const tripsWithCounts = userTrips.map(trip => {
      const stopCount = tripStops.filter(s => s.trip_id === trip.trip_id).length;
      const totalBudget = budgetBreakdown
        .filter(b => b.trip_id === trip.trip_id)
        .reduce((sum, b) => sum + (b.estimated_amount || 0), 0);
      
      return {
        ...trip,
        stop_count: stopCount,
        total_budget: totalBudget
      };
    });
    
    res.json(tripsWithCounts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single trip with full details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const tripId = parseInt(req.params.id);

    if (useDatabase && db) {
      try {
        // Get trip
        const tripResult = await db.query(
          'SELECT * FROM trips WHERE trip_id = $1 AND user_id = $2',
          [tripId, req.user.user_id]
        );

        if (tripResult.rows.length === 0) {
          return res.status(404).json({ error: 'Trip not found' });
        }

        const trip = tripResult.rows[0];

        // Get stops with cities
        const stopsResult = await db.query(
          `SELECT ts.*, c.city_name, c.country, c.image_url
           FROM trip_stops ts
           JOIN cities c ON ts.city_id = c.city_id
           WHERE ts.trip_id = $1
           ORDER BY ts.stop_order`,
          [tripId]
        );

        // Get activities for each stop
        for (let stop of stopsResult.rows) {
          const activitiesResult = await db.query(
            `SELECT ta.*, a.activity_name, a.category, a.description, a.image_url
             FROM trip_activities ta
             JOIN activities a ON ta.activity_id = a.activity_id
             WHERE ta.stop_id = $1
             ORDER BY ta.scheduled_date, ta.scheduled_time`,
            [stop.stop_id]
          );
          stop.activities = activitiesResult.rows;
        }

        // Get budget breakdown
        const budgetResult = await db.query(
          'SELECT * FROM budget_breakdown WHERE trip_id = $1',
          [tripId]
        );

        trip.stops = stopsResult.rows;
        trip.budget_breakdown = budgetResult.rows;

        res.json(trip);
        return;
      } catch (dbError) {
        console.log('Database error in get single trip, switching to in-memory mode:', dbError.message);
      }
    }

    // Fallback to in-memory storage
    const trip = trips.find(t => t.trip_id === tripId && t.user_id === req.user.user_id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const tripStopsForTrip = tripStops.filter(s => s.trip_id === tripId);
    const tripWithStops = {
      ...trip,
      stops: tripStopsForTrip.map(stop => {
        const activitiesForStop = tripActivities.filter(a => a.stop_id === stop.stop_id);
        return {
          ...stop,
          activities: activitiesForStop
        };
      })
    };

    res.json(tripWithStops);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new trip
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { trip_name, start_date, end_date, description, cover_photo } = req.body;

    if (!trip_name || !start_date || !end_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (useDatabase && db) {
      try {
        const result = await db.query(
          `INSERT INTO trips (user_id, trip_name, start_date, end_date, description, cover_photo)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [req.user.user_id, trip_name, start_date, end_date, description, cover_photo]
        );

        res.status(201).json(result.rows[0]);
        return;
      } catch (dbError) {
        console.log('Database error in create trip, switching to in-memory mode:', dbError.message);
      }
    }

    // Fallback to in-memory storage
    const newTrip = {
      trip_id: nextTripId++,
      user_id: req.user.user_id,
      trip_name,
      start_date,
      end_date,
      description,
      cover_photo,
      created_at: new Date(),
      updated_at: new Date()
    };

    trips.push(newTrip);
    res.status(201).json(newTrip);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update trip
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const tripId = parseInt(req.params.id);
    const { trip_name, start_date, end_date, description, cover_photo, is_public } = req.body;

    if (useDatabase && db) {
      try {
        const result = await db.query(
          `UPDATE trips 
           SET trip_name = COALESCE($1, trip_name),
               start_date = COALESCE($2, start_date),
               end_date = COALESCE($3, end_date),
               description = COALESCE($4, description),
               cover_photo = COALESCE($5, cover_photo),
               is_public = COALESCE($6, is_public),
               updated_at = CURRENT_TIMESTAMP
           WHERE trip_id = $7 AND user_id = $8
           RETURNING *`,
          [trip_name, start_date, end_date, description, cover_photo, is_public, tripId, req.user.user_id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Trip not found' });
        }

        res.json(result.rows[0]);
        return;
      } catch (dbError) {
        console.log('Database error in update trip, switching to in-memory mode:', dbError.message);
      }
    }

    // Fallback to in-memory storage
    const tripIndex = trips.findIndex(t => t.trip_id === tripId && t.user_id === req.user.user_id);
    if (tripIndex === -1) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const updatedTrip = {
      ...trips[tripIndex],
      ...(trip_name && { trip_name }),
      ...(start_date && { start_date }),
      ...(end_date && { end_date }),
      ...(description && { description }),
      ...(cover_photo && { cover_photo }),
      ...(is_public !== undefined && { is_public }),
      updated_at: new Date()
    };

    trips[tripIndex] = updatedTrip;
    res.json(updatedTrip);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete trip
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const tripId = parseInt(req.params.id);

    if (useDatabase && db) {
      try {
        const result = await db.query(
          'DELETE FROM trips WHERE trip_id = $1 AND user_id = $2 RETURNING *',
          [tripId, req.user.user_id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Trip not found' });
        }

        res.json({ message: 'Trip deleted successfully' });
        return;
      } catch (dbError) {
        console.log('Database error in delete trip, switching to in-memory mode:', dbError.message);
      }
    }

    // Fallback to in-memory storage
    const tripIndex = trips.findIndex(t => t.trip_id === tripId && t.user_id === req.user.user_id);
    if (tripIndex === -1) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Remove related stops and activities
    tripStops = tripStops.filter(s => s.trip_id !== tripId);
    tripActivities = tripActivities.filter(a => {
      const stop = tripStops.find(s => s.stop_id === a.stop_id);
      return !stop || stop.trip_id !== tripId;
    });
    budgetBreakdown = budgetBreakdown.filter(b => b.trip_id !== tripId);

    trips.splice(tripIndex, 1);
    res.json({ message: 'Trip deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add stop to trip
router.post('/:id/stops', authenticateToken, async (req, res) => {
  try {
    const tripId = parseInt(req.params.id);
    const { city_id, arrival_date, departure_date, stop_order, accommodation_cost, transport_cost } = req.body;

    if (useDatabase && db) {
      try {
        const result = await db.query(
          `INSERT INTO trip_stops (trip_id, city_id, arrival_date, departure_date, stop_order, accommodation_cost, transport_cost)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [tripId, city_id, arrival_date, departure_date, stop_order, accommodation_cost, transport_cost]
        );

        res.status(201).json(result.rows[0]);
        return;
      } catch (dbError) {
        console.log('Database error in add stop, switching to in-memory mode:', dbError.message);
      }
    }

    // Fallback to in-memory storage
    // Verify trip exists and belongs to user
    const trip = trips.find(t => t.trip_id === tripId && t.user_id === req.user.user_id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const newStop = {
      stop_id: nextStopId++,
      trip_id: tripId,
      city_id,
      arrival_date,
      departure_date,
      stop_order,
      accommodation_cost: accommodation_cost || 0,
      transport_cost: transport_cost || 0,
      created_at: new Date()
    };

    tripStops.push(newStop);
    res.status(201).json(newStop);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add activity to stop
router.post('/stops/:stopId/activities', authenticateToken, async (req, res) => {
  try {
    const stopId = parseInt(req.params.stopId);
    const { activity_id, scheduled_date, scheduled_time, actual_cost } = req.body;

    if (useDatabase && db) {
      try {
        const result = await db.query(
          `INSERT INTO trip_activities (stop_id, activity_id, scheduled_date, scheduled_time, actual_cost)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [stopId, activity_id, scheduled_date, scheduled_time, actual_cost]
        );

        res.status(201).json(result.rows[0]);
        return;
      } catch (dbError) {
        console.log('Database error in add activity, switching to in-memory mode:', dbError.message);
      }
    }

    // Fallback to in-memory storage
    // Verify stop exists and belongs to user's trip
    const stop = tripStops.find(s => s.stop_id === stopId);
    if (!stop) {
      return res.status(404).json({ error: 'Stop not found' });
    }
    
    const trip = trips.find(t => t.trip_id === stop.trip_id && t.user_id === req.user.user_id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const newActivity = {
      trip_activity_id: nextActivityId++,
      stop_id: stopId,
      activity_id,
      scheduled_date,
      scheduled_time,
      actual_cost: actual_cost || 0,
      created_at: new Date()
    };

    tripActivities.push(newActivity);
    res.status(201).json(newActivity);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;