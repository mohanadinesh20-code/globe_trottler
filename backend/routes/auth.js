// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();

// In-memory user storage for fallback (only for development/testing)
let users = [];
let nextUserId = 1;

// Try to use database, fallback to in-memory if unavailable
const useDatabase = true; // Change to false to force in-memory mode
let db = null;

try {
  db = require('../db');
} catch (err) {
  console.log('Database module not available, using in-memory storage');
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Try database first, fallback to in-memory
    if (useDatabase && db) {
      try {
        // Check if user exists
        const userExists = await db.query(
          'SELECT * FROM users WHERE email = $1',
          [email]
        );

        if (userExists.rows.length > 0) {
          return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Create user
        const result = await db.query(
          'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING user_id, email, full_name',
          [email, password_hash, full_name]
        );

        const user = result.rows[0];

        // Generate token
        const token = jwt.sign(
          { user_id: user.user_id, email: user.email },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        res.status(201).json({ token, user });
        return;
      } catch (dbError) {
        console.log('Database error during registration, switching to in-memory mode:', dbError.message);
      }
    }

    // Fallback to in-memory storage
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    
    const newUser = {
      user_id: nextUserId++,
      email,
      password_hash,
      full_name,
      created_at: new Date()
    };

    users.push(newUser);
    
    // Generate token
    const token = jwt.sign(
      { user_id: newUser.user_id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return user without password hash
    const { password_hash: _, ...user } = newUser;
    res.status(201).json({ token, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Try database first, fallback to in-memory
    if (useDatabase && db) {
      try {
        // Find user
        const result = await db.query(
          'SELECT * FROM users WHERE email = $1',
          [email]
        );

        if (result.rows.length === 0) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Check password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign(
          { user_id: user.user_id, email: user.email },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        // Remove password from response
        const { password_hash: _, ...cleanUser } = user;
        
        res.json({ token, user: cleanUser });
        return;
      } catch (dbError) {
        console.log('Database error during login, switching to in-memory mode:', dbError.message);
      }
    }

    // Fallback to in-memory storage
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return user without password hash
    const { password_hash: _, ...cleanUser } = user;
    res.json({ token, user: cleanUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;