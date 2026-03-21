// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { xss } = require('express-xss-sanitizer');

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const contactRoutes = require('./routes/contactRoutes');
const chatRoutes = require('./routes/chatRoutes')
const swaggerUi = require('swagger-ui-express');
const cookieParser = require("cookie-parser");
const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');
const { supabase } = require('./db/supabaseClient');
const https = require('https');
const app = express();

// Swagger Definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Portfolio Backend API',
      version: '1.0.0',
      description: 'API Documentation for the Developer Portfolio system',
      contact: {
        name: 'Developer Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  // Path to the API docs (where your routes are)
  apis: [path.join(__dirname, './routes/*.js')], 
};
const swaggerDocs = swaggerJsdoc(swaggerOptions);
// 1. Use Helmet to set security headers (helps prevent XSS & Clickjacking)
app.use(helmet());

// 2. Body Parser (already in your code)
app.use(express.json({ limit: '10kb' })); // Limit body size to prevent DoS

// 3. Sanitize all incoming data to remove script tags
app.use(xss());

const PORT = process.env.PORT || 3000;

async function checkSupabaseConnection() {
  try {
    console.log('🔍 Checking Supabase connection...');

    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (error) {
      console.error('❌ Supabase connection error:', error.message);
      return;
    }

    console.log('✅ Supabase connected successfully');
  } catch (err) {
    console.error('🔥 Supabase network failure:', err.message);
  }
}

// Middlewares
const allowedOrigins = [
  'http://localhost:4200',
  'http://localhost:3000',
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
app.use(cookieParser());
app.use(express.json());

// Health check (optional)
app.get('/api/health/db', async (req, res) => {
  try {
    const { error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (error) {
      return res.status(500).json({
        status: 'error',
        database: 'unreachable',
        message: error.message
      });
    }

    return res.status(200).json({
      status: 'ok',
      database: 'connected'
    });

  } catch (err) {
    return res.status(500).json({
      status: 'error',
      database: 'network failure',
      message: err.message
    });
  }
});

// Auth routes
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/ai', chatRoutes);
app.use('/api/chat', chatRoutes);
checkSupabaseConnection();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server started on port ${PORT}`);
});
