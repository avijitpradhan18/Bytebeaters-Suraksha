/* ======================================================
   Database Connection (MongoDB via Mongoose)
   ====================================================== */

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    // Fallback: continue without DB for demo purposes
    console.warn('⚠️  Running without database — using in-memory store.');
  }
};

module.exports = connectDB;
