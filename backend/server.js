/* ======================================================
   AI Fake ID Detector — Express Server Entry Point
   ====================================================== */

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const connectDB  = require('./config/db');
const authRoutes = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 3000;

// ---- Connect to MongoDB ----
connectDB();

// ---- Middleware ----
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10kb' }));

// Rate-limiter: max 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests. Please try again later.' },
});
app.use('/api/', limiter);

// ---- Routes ----
app.use('/api/auth', authRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    service: 'AI Fake ID Detector — Auth Server',
    timestamp: new Date().toISOString(),
  });
});

// ---- Global error handler ----
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// ---- Start server ----
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
