# Backend Architecture Documentation

## 🏗️ System Architecture

### High-Level Overview

```
┌─────────────────┐
│   Frontend      │
│   (Angular 19)  │
└────────┬────────┘
         │ HTTP/HTTPS
         │ (JWT Cookie)
         ▼
┌─────────────────────────────────────────┐
│         Express Server                   │
│  ┌─────────────────────────────────┐   │
│  │  Middleware Layer               │   │
│  │  - CORS                         │   │
│  │  - Helmet (Security)            │   │
│  │  - Rate Limiting                │   │
│  │  - Request Logging              │   │
│  │  - Auth (JWT/Guest)             │   │
│  │  - Error Handling               │   │
│  └─────────────────────────────────┘   │
│                                          │
│  ┌─────────────────────────────────┐   │
│  │  API Layer (/api/v1)            │   │
│  │  - Auth Routes                  │   │
│  │  - Chat Routes                  │   │
│  │  - Profile Routes               │   │
│  │  - Contact Routes               │   │
│  └─────────────────────────────────┘   │
│                                          │
│  ┌─────────────────────────────────┐   │
│  │  Service Layer                  │   │
│  │  - authService                  │   │
│  │  - chatService                  │   │
│  │  - aiService (OpenAI)           │   │
│  └─────────────────────────────────┘   │
└─────────────┬───────────────────────────┘
              │
         ┌────┴────┐
         ▼         ▼
   ┌─────────┐ ┌────────┐
   │Supabase │ │OpenAI  │
   │(PostgreSQL)│ │API    │
   └─────────┘ └────────┘
```

## 🔄 Request Flow

### 1. Guest User Chat Request

```
Client
  │
  ├─► POST /api/v1/chat/send
  │   { message: "Tell me about Rohit" }
  │
  ▼
CORS Check
  │
  ▼
Rate Limiting (10 msg/min)
  │
  ▼
Optional Auth Middleware
  ├─► No token found
  │   └─► Check guestId cookie
  │       ├─► Exists: Use existing
  │       └─► New: Create UUID & set cookie
  │
  ▼
Ensure Guest ID Middleware
  └─► Attach guestId to req
  │
  ▼
Validation (Joi)
  └─► Validate message format
  │
  ▼
Chat Controller
  │
  ▼
Chat Service
  ├─► checkGuestLimit(guestId)
  │   └─► Query DB for messages in 24hrs
  │   └─► Return count
  │
  ├─► If limit reached → Return limit message
  │
  ├─► If OK → Call AI Service
  │   └─► askAI(message, role='guest')
  │       └─► OpenAI API call with system prompt
  │       └─► Return AI response
  │
  ├─► Create/Update Session in DB
  │   └─► { guest_id, messages[], role='guest' }
  │
  └─► Return response
      │
      ▼
Standard API Response
  {
    success: true,
    data: {
      response: "AI answer...",
      sessionId: "uuid",
      remainingQuestions: 3
    }
  }
  │
  ▼
Client receives response
```

### 2. Admin Login Flow

```
Client
  │
  ├─► POST /api/v1/auth/login
  │   { email, password }
  │
  ▼
CORS + Rate Limiter (5 attempts/15min)
  │
  ▼
Validation (Joi)
  └─► Email & password format
  │
  ▼
Auth Controller
  │
  ▼
Auth Service
  ├─► Query user from DB
  │   └─► SELECT * FROM users WHERE email=?
  │
  ├─► Verify password (bcrypt.compare)
  │   └─► Match? Continue : Reject
  │
  ├─► Check is_active status
  │
  ├─► Update last_login timestamp
  │
  ├─► Generate JWT token
  │   └─► jwt.sign({ sub, email, role }, SECRET)
  │
  └─► Return { token, user }
      │
      ▼
Auth Controller
  └─► Set httpOnly cookie
      └─► Cookie: token=<jwt>
      │
      ▼
Standard API Response
  {
    success: true,
    data: {
      user: { id, email, role },
      token: "jwt..."
    }
  }
  │
  ▼
Client stores token (cookie auto-managed)
```

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  role VARCHAR DEFAULT 'admin',
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Chat Sessions Table
```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  guest_id UUID,                    -- For guest tracking
  title VARCHAR(100),
  model VARCHAR(50),
  role VARCHAR(20),                 -- 'admin' or 'guest'
  is_guest BOOLEAN DEFAULT false,
  user_ip VARCHAR(50),
  messages JSONB DEFAULT '[]',      -- Array of messages
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_guest_sessions ON chat_sessions(guest_id, created_at);
CREATE INDEX idx_user_sessions ON chat_sessions(user_id, created_at);
CREATE INDEX idx_role_sessions ON chat_sessions(role, is_guest);
```

### Profiles Table
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  full_name VARCHAR,
  location VARCHAR,
  email VARCHAR,
  primary_phone VARCHAR,
  linkedin VARCHAR,
  website VARCHAR,
  description TEXT,
  skills JSONB,
  themes JSONB,
  currenttheme VARCHAR,
  experiences JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🔐 Authentication & Authorization

### JWT Token Structure
```json
{
  "sub": "user-uuid",
  "email": "admin@example.com",
  "role": "admin",
  "iat": 1234567890,
  "exp": 1234654290
}
```

### Cookie Configuration
```javascript
{
  httpOnly: true,           // Prevents XSS
  sameSite: 'none',         // Production (cross-site)
  secure: true,             // HTTPS only in production
  maxAge: 24 * 60 * 60 * 1000,  // 24 hours
  path: '/'
}
```

### Access Control

| Route | Guest | Admin |
|-------|-------|-------|
| POST /chat/send | ✅ (5/day) | ✅ (unlimited) |
| GET /chat/sessions | ✅ (own) | ✅ (all) |
| GET /chat/stats | ❌ | ✅ |
| DELETE /chat/sessions | ❌ | ✅ |
| PUT /profile | ❌ | ✅ |

## 🎯 Error Handling Strategy

### Error Flow

```
Error occurs in controller/service
  │
  ▼
catchAsync wrapper catches it
  │
  ▼
Pass to next(error)
  │
  ▼
errorConverter middleware
  ├─► If ApiError: Pass through
  └─► If other: Convert to ApiError
  │
  ▼
errorHandler middleware
  ├─► Log error (Winston)
  ├─► Determine status code
  ├─► Format response
  │   └─► Production: Hide stack trace
  │   └─► Development: Show stack trace
  └─► Send JSON response
```

### Error Response Format

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Error",
  "timestamp": "2026-03-30T10:30:45.123Z",
  "errors": [
    {
      "field": "email",
      "message": "Please provide a valid email address"
    }
  ]
}
```

## 📊 Logging Strategy

### Log Levels

- **error**: System failures, exceptions
- **warn**: Unusual events, recoverable issues
- **info**: Normal operations, user actions
- **debug**: Detailed debugging info

### What We Log

**Requests:**
```javascript
{
  level: 'info',
  message: 'Incoming Request',
  method: 'POST',
  url: '/api/v1/auth/login',
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
}
```

**Responses:**
```javascript
{
  level: 'info',
  message: 'Response Sent',
  method: 'POST',
  url: '/api/v1/auth/login',
  statusCode: 200,
  duration: '45ms'
}
```

**Errors:**
```javascript
{
  level: 'error',
  message: 'Database connection failed',
  statusCode: 500,
  stack: 'Error: ...',
  timestamp: '2026-03-30T10:30:45.123Z'
}
```

## ⚡ Performance Optimizations

### Rate Limiting

```javascript
// API-wide: 100 requests per 15 minutes
apiLimiter: { windowMs: 15min, max: 100 }

// Auth: 5 attempts per 15 minutes
authLimiter: { windowMs: 15min, max: 5 }

// Chat: 10 messages per minute
chatLimiter: { windowMs: 1min, max: 10 }
```

### Guest Chat Limiting

```javascript
// Check count in last 24 hours
SELECT messages FROM chat_sessions
WHERE guest_id = ? AND created_at >= NOW() - INTERVAL '24 hours'

// Count user messages
messages.filter(m => m.sender === 'user').length

// Limit: 5 messages per 24 hours
```

## 🔄 Service Layer Pattern

### Example: Chat Service

```javascript
// Service handles business logic
chatService.sendChatMessage({
  message,
  sessionId,
  role,
  guestId,
  userIp
})
  ├─► Check rate limit
  ├─► Call AI service
  ├─► Create/update session in DB
  └─► Return structured data

// Controller handles HTTP
chatController.sendMessage()
  ├─► Extract request data
  ├─► Call service
  ├─► Format API response
  └─► Send HTTP response
```

**Benefits:**
- Separation of concerns
- Reusable business logic
- Easy testing
- Clear responsibilities

## 🎨 Response Standardization

### Success Response
```javascript
{
  success: true,
  statusCode: 200,
  data: { /* actual data */ },
  message: "Operation successful",
  timestamp: "2026-03-30T10:30:45.123Z"
}
```

### Error Response
```javascript
{
  success: false,
  statusCode: 400,
  message: "Error message",
  timestamp: "2026-03-30T10:30:45.123Z"
}
```

**Benefits:**
- Consistent format
- Easy client parsing
- Standard error handling
- Better debugging

## 📈 Scalability Considerations

### Current Architecture
- ✅ Stateless (JWT tokens)
- ✅ Horizontal scaling ready
- ✅ Database connection pooling (Supabase)
- ✅ Rate limiting per IP

### Future Enhancements
- [ ] Redis for session storage
- [ ] Caching layer (Redis)
- [ ] Message queue (Bull/RabbitMQ)
- [ ] CDN for static assets
- [ ] Database read replicas
- [ ] Load balancer (Nginx)

## 🔒 Security Layers

1. **Network**: HTTPS, CORS
2. **Input**: Joi validation, XSS sanitization
3. **Authentication**: JWT, httpOnly cookies
4. **Authorization**: Role-based access
5. **Database**: Parameterized queries
6. **Headers**: Helmet.js
7. **Rate Limiting**: Per endpoint
8. **Logging**: Audit trail

## 🎓 Best Practices Implemented

✅ **Separation of Concerns**: Controllers → Services → DB  
✅ **Error Handling**: Centralized & consistent  
✅ **Validation**: Input validation at entry  
✅ **Logging**: Comprehensive audit trail  
✅ **Security**: Multiple layers  
✅ **Testing**: Unit + integration tests  
✅ **Documentation**: Swagger + README  
✅ **Versioning**: API versioning (/v1/)  
✅ **Standards**: RESTful conventions  
✅ **Code Quality**: ESLint, Prettier ready  

---

**This architecture is production-ready and follows industry best practices for scalable, maintainable, and secure backend systems.**
