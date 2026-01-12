// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { xss } = require('express-xss-sanitizer');

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const contactRoutes = require('./routes/contactRoutes');

const app = express();
// 1. Use Helmet to set security headers (helps prevent XSS & Clickjacking)
app.use(helmet());

// 2. Body Parser (already in your code)
app.use(express.json({ limit: '10kb' })); // Limit body size to prevent DoS

// 3. Sanitize all incoming data to remove script tags
app.use(xss());

const PORT = process.env.PORT || 3000;

// Middlewares
const allowedOrigins = [
  'http://localhost:4200',
  'http://localhost:4000',
  'https://rohitnair321.github.io',
  'https://rohit-nair296.onrender.com',
  'https://portfolio-backend-bpmw.onrender.com'
];
const corsOptions = {
  origin: function (origin, callback) {
    // Allow server-to-server, Postman, curl
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

// Health check (optional)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' });
});

// Auth routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/contact', contactRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server started on port ${PORT}`);
});
