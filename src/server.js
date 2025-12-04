// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors({
  origin: ['http://localhost:4200'], // add your Angular dev URL + prod domain
  credentials: true,
}));
app.use(express.json());

// Health check (optional)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' });
});

// Auth routes
app.use('/api/auth', authRoutes);

// TODO: other routes (projects, profile, etc.)
// app.use('/api/projects', projectRoutes);

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
