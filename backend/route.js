/* ======================================================
   Auth Routes — Register & Login
   ====================================================== */

const express = require('express');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// ---- In-memory user store (fallback when MongoDB is unavailable) ----
let inMemoryUsers = [];
let useInMemory   = false;

// Try to load the Mongoose model; fall back gracefully
let User;
try {
  User = require('../models/User');
} catch (e) {
  useInMemory = true;
}

// Helper: generate JWT
function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// ---- Determine storage mode on first request ----
function isMongoConnected() {
  try {
    const mongoose = require('mongoose');
    return mongoose.connection.readyState === 1;
  } catch {
    return false;
  }
}

/* ==========================
   POST  /api/auth/register
   ========================== */
router.post(
  '/register',
  [
    body('fullname').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ],
  async (req, res) => {
    try {
      // Validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: errors.array()[0].msg,
          errors: errors.array(),
        });
      }

      const { fullname, email, password } = req.body;

      if (isMongoConnected()) {
        // ---- MongoDB path ----
        const existing = await User.findOne({ email });
        if (existing) {
          return res.status(409).json({ message: 'Email is already registered' });
        }

        const user = await User.create({ fullname, email, password });

        return res.status(201).json({
          message: 'Registration successful',
          user: { id: user._id, fullname: user.fullname, email: user.email },
        });
      } else {
        // ---- In-memory path ----
        const existing = inMemoryUsers.find((u) => u.email === email.toLowerCase());
        if (existing) {
          return res.status(409).json({ message: 'Email is already registered' });
        }

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = {
          id: Date.now().toString(),
          fullname,
          email: email.toLowerCase(),
          password: hashedPassword,
          role: 'user',
          createdAt: new Date().toISOString(),
        };
        inMemoryUsers.push(newUser);

        return res.status(201).json({
          message: 'Registration successful',
          user: { id: newUser.id, fullname: newUser.fullname, email: newUser.email },
        });
      }
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ message: 'Server error during registration' });
    }
  }
);

/* ==========================
   POST  /api/auth/login
   ========================== */
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: errors.array()[0].msg,
          errors: errors.array(),
        });
      }

      const { email, password } = req.body;

      if (isMongoConnected()) {
        // ---- MongoDB path ----
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
          return res.status(401).json({ message: 'Invalid email or password' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = signToken({ id: user._id, email: user.email, role: user.role });

        return res.json({
          message: 'Login successful',
          token,
          user: { id: user._id, fullname: user.fullname, email: user.email, role: user.role },
        });
      } else {
        // ---- In-memory path ----
        const user = inMemoryUsers.find((u) => u.email === email.toLowerCase());
        if (!user) {
          return res.status(401).json({ message: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = signToken({ id: user.id, email: user.email, role: user.role });

        return res.json({
          message: 'Login successful',
          token,
          user: { id: user.id, fullname: user.fullname, email: user.email, role: user.role },
        });
      }
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ message: 'Server error during login' });
    }
  }
);

module.exports = router;
