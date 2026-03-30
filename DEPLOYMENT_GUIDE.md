# 🚀 DEPLOYMENT & MIGRATION GUIDE

## 📋 PRE-DEPLOYMENT CHECKLIST

### ✅ Backend Preparation

- [ ] Review all new files created
- [ ] Test locally with `npm run dev`
- [ ] Verify environment variables in `.env`
- [ ] Check database schema (guest_id column)
- [ ] Test API endpoints with Swagger
- [ ] Review logs for any errors

---

## 🔧 LOCAL TESTING

### 1. Setup Environment

```bash
cd /app/backend

# Copy environment template
cp .env.example .env

# Edit with your credentials
nano .env  # or use your editor
```

**Required Variables**:
```env
NODE_ENV=development
PORT=3000
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-key
JWT_SECRET=generate-a-secure-random-string
OPENAI_API_KEY=your-openai-key
PROFILE_OWNER_ID=your-user-uuid-from-database
FRONTEND_URL=http://localhost:4200
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

**Expected Output**:
```
==================================================
✅ Server started successfully
🚀 Environment: development
📍 Port: 3000
🌐 Host: 0.0.0.0
📚 API Docs: http://localhost:3000/api-docs
🏥 Health Check: http://localhost:3000/health
🔧 API v1: http://localhost:3000/api/v1
==================================================
🔍 Testing Supabase connection...
✅ Supabase connected successfully
```

### 4. Test Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Database health
curl http://localhost:3000/api/health/db

# API v1 health
curl http://localhost:3000/api/v1/health

# Visit Swagger docs
open http://localhost:3000/api-docs
```

---

## 📊 DATABASE MIGRATION

### Check if guest_id Column Exists

```sql
-- Connect to your Supabase database
-- Run this query:

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chat_sessions';
```

### Add guest_id Column (if missing)

```sql
-- Add guest_id column
ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS guest_id UUID;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_guest_sessions 
ON chat_sessions(guest_id, created_at);

-- Update existing guest sessions with UUID
UPDATE chat_sessions 
SET guest_id = gen_random_uuid() 
WHERE is_guest = true AND guest_id IS NULL;
```

---

## 🎯 TESTING CRITICAL FIXES

### Test 1: Guest Chat Session

```bash
# Send a chat message as guest
curl -X POST http://localhost:3000/api/v1/chat/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tell me about Rohit"
  }'

# Response should include:
# - response: AI answer
# - sessionId: UUID
# - limitReached: false
# - remainingQuestions: 4
```

### Test 2: Guest Session Persistence

```bash
# First message
curl -c cookies.txt -X POST http://localhost:3000/api/v1/chat/send \
  -H "Content-Type: application/json" \
  -d '{"message": "First question"}'

# Second message (should use same session)
curl -b cookies.txt -X POST http://localhost:3000/api/v1/chat/send \
  -H "Content-Type: application/json" \
  -d '{"message": "Second question"}'

# Both should have same guestId in database
```

### Test 3: Rate Limiting

```bash
# Send 6 messages rapidly (guest limit is 5)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/v1/chat/send \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"Question $i\"}"
  echo ""
done

# 6th message should return limitReached: true
```

### Test 4: Admin Login

```bash
# Login as admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-admin@email.com",
    "password": "your-password"
  }'

# Should return token and set cookie
```

---

## 🚢 DEPLOYMENT TO RENDER

### 1. Push to GitHub

```bash
cd /app/backend

# If not already a git repo
git init
git add .
git commit -m "Backend v2.0 - Complete restructuring with critical fixes"

# Push to your GitHub
git remote add origin https://github.com/yourusername/portfolio-backend.git
git push -u origin main
```

### 2. Render Configuration

**Build Command**:
```bash
npm install
```

**Start Command**:
```bash
npm start
```

**Environment Variables** (Set in Render Dashboard):
```
NODE_ENV=production
PORT=3000
SUPABASE_URL=your-production-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-production-key
JWT_SECRET=your-secure-production-secret
OPENAI_API_KEY=your-openai-key
PROFILE_OWNER_ID=your-user-uuid
FRONTEND_URL=https://your-frontend-domain.com
CORS_ORIGINS=https://your-frontend-domain.com,https://www.mintpixel.in
LOG_LEVEL=info
```

### 3. CORS Configuration

Update `server.js` (already done) with your production URLs:

```javascript
const allowedOrigins = [
  'http://localhost:4200',           // Development
  'https://your-frontend.com',       // Production frontend
  'https://www.mintpixel.in',       // Your domain
  // Add more as needed
];
```

### 4. Deploy

1. Connect GitHub repo to Render
2. Set environment variables
3. Deploy
4. Check logs for successful startup

---

## 🔄 FRONTEND MIGRATION

### Option A: Gradual Migration (Recommended)

**Step 1**: Keep using old routes initially
```typescript
// Angular services - no changes needed yet
http.post('/api/auth/login', ...)    // Still works
http.post('/api/chat/chat', ...)     // Still works
```

**Step 2**: Update gradually to v1
```typescript
// Update one service at a time
http.post('/api/v1/auth/login', ...)
http.post('/api/v1/chat/send', ...)
```

### Option B: Complete Migration

Update all API calls to v1:

```typescript
// OLD                          → NEW
/api/auth/login                → /api/v1/auth/login
/api/auth/logout               → /api/v1/auth/logout
/api/auth/forgot-password      → /api/v1/auth/forgot-password
/api/chat/chat                 → /api/v1/chat/send
/api/chat/getSessions          → /api/v1/chat/sessions
/api/chat/getSessionById/:id   → /api/v1/chat/sessions/:id
/api/profile                   → /api/v1/profile
/api/contact                   → /api/v1/contact
```

### Frontend Changes Needed

**1. Update API Service**:
```typescript
// src/app/core/services/api.service.ts

export class ApiService {
  private baseUrl = environment.apiUrl;
  
  // Update to v1
  private apiV1 = `${this.baseUrl}/api/v1`;
  
  login(credentials: any) {
    return this.http.post(`${this.apiV1}/auth/login`, credentials);
  }
  
  sendChatMessage(message: any) {
    return this.http.post(`${this.apiV1}/chat/send`, message);
  }
}
```

**2. Handle New Response Format**:
```typescript
// All responses now follow:
interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  data: T;
  message: string;
  timestamp: string;
}

// Update your interceptors/handlers
this.apiService.login(creds).subscribe({
  next: (response: ApiResponse<any>) => {
    if (response.success) {
      const userData = response.data;
      // Handle success
    }
  },
  error: (error) => {
    // Error format is same
    console.error(error.message);
  }
});
```

**3. Update Chat Service**:
```typescript
// Chat service needs to handle new response
sendMessage(message: string, sessionId?: string) {
  return this.http.post<ApiResponse<ChatResponse>>('/api/v1/chat/send', {
    message,
    sessionId
  }).pipe(
    map(res => res.data)  // Extract data
  );
}

interface ChatResponse {
  response: string;
  sessionId: string;
  limitReached: boolean;
  remainingQuestions: number;
}
```

---

## 🎨 FRONTEND UX CHANGES (Phase 3)

### Current Flow → New Flow

**OLD**:
```
User visits → Login Page
  ├─> Continue as Guest → Portfolio
  └─> Admin Login → Portfolio (admin features)
```

**NEW** (Your Requested Change):
```
User visits → Portfolio (Guest Mode) ← Direct landing!
  └─> Navbar has "Login" button
      └─> Click → Login Modal/Dialog
          └─> Admin Login → Unlock admin features
```

### Implementation Steps

1. **Remove Login Route as Default**:
```typescript
// app.routes.ts
const routes: Routes = [
  { path: '', component: PortfolioComponent },  // ← Default route
  { path: 'about', component: AboutComponent },
  // Remove: { path: '', redirectTo: '/login', pathMatch: 'full' }
];
```

2. **Add Login Button to Navbar**:
```typescript
// navbar.component.ts
export class NavbarComponent {
  isAuthenticated = false;
  userRole: string = 'guest';
  
  ngOnInit() {
    this.authService.user$.subscribe(user => {
      this.isAuthenticated = user?.role === 'admin';
      this.userRole = user?.role || 'guest';
    });
  }
  
  openLoginDialog() {
    this.dialog.open(LoginDialogComponent);
  }
}
```

```html
<!-- navbar.component.html -->
<nav>
  <div class="nav-items">
    <a routerLink="/">Home</a>
    <a routerLink="/about">About</a>
    <a routerLink="/portfolio">Portfolio</a>
    
    <!-- Show login button for guests -->
    <button *ngIf="!isAuthenticated" 
            (click)="openLoginDialog()"
            class="login-btn">
      Login
    </button>
    
    <!-- Show admin menu for authenticated users -->
    <div *ngIf="isAuthenticated" class="admin-menu">
      <button [matMenuTriggerFor]="menu">
        Admin Panel
      </button>
      <mat-menu #menu="matMenu">
        <button mat-menu-item routerLink="/settings">Settings</button>
        <button mat-menu-item routerLink="/analytics">Analytics</button>
        <button mat-menu-item (click)="logout()">Logout</button>
      </mat-menu>
    </div>
  </div>
</nav>
```

3. **Create Login Dialog Component**:
```typescript
// login-dialog.component.ts
@Component({
  selector: 'app-login-dialog',
  template: `
    <h2 mat-dialog-title>Admin Login</h2>
    <mat-dialog-content>
      <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
        <mat-form-field>
          <input matInput placeholder="Email" formControlName="email">
        </mat-form-field>
        <mat-form-field>
          <input matInput type="password" placeholder="Password" 
                 formControlName="password">
        </mat-form-field>
        <button mat-raised-button color="primary" type="submit">
          Login
        </button>
      </form>
    </mat-dialog-content>
  `
})
export class LoginDialogComponent {
  // Implementation
}
```

4. **Update Auth Service**:
```typescript
// auth.service.ts
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();
  
  initApp() {
    // Call on app startup
    this.http.get<ApiResponse<any>>('/api/v1/auth/init')
      .subscribe(res => {
        const user = {
          id: res.data.id,
          role: res.data.role,
          email: res.data.email
        };
        this.userSubject.next(user);
      });
  }
  
  login(credentials: any) {
    return this.http.post<ApiResponse<any>>('/api/v1/auth/login', credentials)
      .pipe(
        tap(res => {
          this.userSubject.next(res.data.user);
        })
      );
  }
}
```

---

## 🧪 POST-DEPLOYMENT TESTING

### Test Checklist

- [ ] Health endpoint responds
- [ ] Database connection works
- [ ] API documentation accessible
- [ ] Guest chat works (5 questions limit)
- [ ] Guest session persists across page reload
- [ ] Admin login works
- [ ] Admin sees all chat sessions
- [ ] Guest sees only their sessions
- [ ] Rate limiting works
- [ ] Error handling works properly
- [ ] Logs are being written
- [ ] Frontend can connect to backend

### Monitoring

**Check Logs**:
```bash
# On Render
- Go to Logs tab
- Look for startup messages
- Check for errors

# Locally
tail -f logs/combined.log
tail -f logs/error.log
```

**Test Endpoints**:
```bash
# Replace with your Render URL
curl https://your-app.onrender.com/health
curl https://your-app.onrender.com/api/health/db
curl https://your-app.onrender.com/api/v1/health
```

---

## 🚨 TROUBLESHOOTING

### Issue: Server Won't Start

**Check**:
1. All environment variables set?
2. Database connection string correct?
3. Port available?
4. Check logs: `tail -f logs/error.log`

### Issue: Guest Sessions Not Working

**Check**:
1. `guest_id` column exists in database?
2. Cookies are being set? (Check browser DevTools)
3. CORS configured correctly?
4. Frontend sending requests correctly?

### Issue: Rate Limiting Not Working

**Check**:
1. Redis not required (using in-memory)
2. Check logs for rate limit messages
3. Test with curl commands above

### Issue: Database Connection Fails

**Check**:
1. SUPABASE_URL correct?
2. SUPABASE_SERVICE_ROLE_KEY correct?
3. Database accessible from server?
4. Check `/api/health/db` endpoint

---

## 📞 NEXT STEPS

### Immediate (Today)
1. ✅ Test locally
2. ✅ Verify all endpoints work
3. ✅ Check database migration
4. ✅ Review documentation

### Short-term (This Week)
1. Deploy to Render
2. Test in production
3. Update frontend to use v1 endpoints
4. Implement frontend UX changes

### Long-term (Future)
1. Complete integration tests
2. Add caching layer (Redis)
3. Implement email service
4. Add Google Analytics UI
5. Performance optimization

---

## 🎉 SUCCESS CRITERIA

Backend v2.0 is successful when:

- ✅ Server starts without errors
- ✅ All health checks pass
- ✅ Guest chat sessions work properly
- ✅ Admin can see all chats
- ✅ Guests see only their chats
- ✅ Rate limiting works (5 guest questions)
- ✅ API documentation accessible
- ✅ Logs are being written
- ✅ Frontend can connect
- ✅ Zero breaking changes for existing functionality

---

**Ready to deploy?** Follow this guide step by step! 🚀

**Questions?** Refer to README.md and ARCHITECTURE.md for details.
