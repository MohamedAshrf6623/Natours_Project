# 🌿 Natours - Advanced Tour Booking API

A comprehensive, production-ready REST API for tour booking built with **Node.js**, **Express**, and **MongoDB**. Features advanced authentication (OAuth 2.0, 2FA), payment processing, caching, and much more.

## 🚀 Features

### 🔐 Authentication & Security
- **JWT Authentication** - Secure token-based authentication
- **Google OAuth 2.0** - Login/signup with Google via Passport.js
- **Two-Factor Authentication (2FA)** - TOTP-based 2FA with QR code setup
- **Account Locking** - Auto-lock after 5 failed login attempts
- **Password Reset** - Email-based password reset flow
- **Rate Limiting** - Separate limits for API and auth endpoints
- **Security Headers** - Helmet.js for HTTP security headers
- **Data Sanitization** - Protection against NoSQL injection and XSS

### 🏔️ Tours
- Full CRUD operations with role-based access
- **Advanced Search** - Multi-field search with difficulty, price, rating, and duration filters
- **Autocomplete** - Real-time tour name suggestions
- **Geospatial Queries** - Find tours within a radius, calculate distances
- **Image Upload** - Multi-image upload with Sharp resizing
- **Tour Statistics** - Aggregation pipeline stats
- **Monthly Plan** - Tour start dates per month
- **Redis Caching** - Cached GET responses with automatic invalidation

### 💳 Bookings & Payments
- **Stripe Integration** - Secure checkout sessions
- **Coupon/Promo Codes** - Percentage or fixed discounts with validation
- **Booking Cancellation** - Cancel bookings with reason tracking
- **Stripe Refunds** - Process refunds for cancelled bookings
- **Booking Stats** - Revenue and booking analytics

### ⭐ Reviews
- CRUD with nested routes (tour/:id/reviews)
- Auto-calculate tour rating averages
- One review per user per tour (unique compound index)

### ❤️ Wishlist
- Add/remove tours to favorites
- Check if a tour is in wishlist
- Get user's complete wishlist

### 🔔 Notifications
- Auto-generated notifications for bookings, reviews, password changes
- Mark as read/unread
- Mark all as read
- Unread count tracking

### 🎟️ Coupons
- Percentage or fixed amount discounts
- Validity period (from/until dates)
- Usage limits (total and per-user)
- Tour-specific restrictions
- Minimum booking amount

### 📋 Activity Logs
- User action audit trail
- Admin activity dashboard with stats
- Per-user activity history
- Daily active users analytics

### 📄 API Documentation
- **Swagger/OpenAPI 3.0** - Interactive API docs at `/api-docs`
- Complete schema definitions
- Request/response examples

### 📧 Email System
- Pug-based HTML email templates
- SendGrid (production) / Mailtrap (development)
- Welcome emails, password reset emails

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Node.js + Express | Backend framework |
| MongoDB + Mongoose | Database & ODM |
| JWT | Authentication tokens |
| Passport.js | Google OAuth 2.0 |
| Speakeasy + QRCode | Two-Factor Authentication |
| Stripe | Payment processing |
| Redis (ioredis) | Response caching |
| Multer + Sharp | Image upload & processing |
| Nodemailer | Email sending |
| Pug | Server-side templates |
| Swagger UI | API documentation |
| Helmet | Security headers |

## 📁 Project Structure

```
natours/
├── controllers/
│   ├── authController.js         # Auth, OAuth, 2FA
│   ├── tourController.js         # Tours CRUD, search, autocomplete
│   ├── userController.js         # User management, stats
│   ├── bookingController.js      # Bookings, cancel, refund
│   ├── reviewController.js       # Reviews CRUD
│   ├── wishlistController.js     # Wishlist operations
│   ├── notificationController.js # Notifications
│   ├── couponController.js       # Coupon validation & CRUD
│   ├── activityLogController.js  # Activity audit trail
│   ├── viewsController.js        # SSR page controllers
│   ├── errorController.js        # Global error handling
│   └── handlerFactory.js         # Generic CRUD factory
├── models/
│   ├── tourModel.js              # Tour schema (with geo)
│   ├── userModel.js              # User schema (OAuth, 2FA)
│   ├── bookingModel.js           # Booking schema (refunds, coupons)
│   ├── reviewModel.js            # Review schema
│   ├── wishlistModel.js          # Wishlist schema
│   ├── notificationModel.js      # Notification schema
│   ├── couponModel.js            # Coupon/promo schema
│   └── activityLogModel.js       # Activity log schema
├── routes/
│   ├── tourRoutes.js
│   ├── userRoutes.js
│   ├── bookingRoutes.js
│   ├── reviewRoutes.js
│   ├── wishlistRoutes.js
│   ├── notificationRoutes.js
│   ├── couponRoutes.js
│   ├── activityLogRoutes.js
│   └── viewRoutes.js
├── utils/
│   ├── apiFeatures.js            # Query filtering, sorting, pagination
│   ├── appError.js               # Custom error class
│   ├── catchAsync.js             # Async error wrapper
│   ├── email.js                  # Email utility (Pug templates)
│   ├── passport.js               # Google OAuth strategy
│   ├── redisCache.js             # Redis caching middleware
│   └── swagger.js                # OpenAPI specification
├── views/                        # Pug templates
├── public/                       # Static assets
├── app.js                        # Express app setup
├── server.js                     # Server entry point
└── config.env                    # Environment variables
```

## ⚡ Quick Start

### Prerequisites
- Node.js >= 10.0.0
- MongoDB (local or Atlas)
- Redis (optional - for caching)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
# Edit config.env with your credentials

# Start development server
npm start
```

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE` | MongoDB connection string |
| `DATABASE_PASSWORD` | MongoDB password |
| `JWT_SECRET` | JWT signing secret |
| `JWT_EXPIRES_IN` | JWT expiration (e.g., 90d) |
| `JWT_COOKIE_EXPIRES_IN` | Cookie expiration in days |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `REDIS_URL` | Redis connection URL |

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/users/signup` | Register new user |
| POST | `/api/v1/users/login` | Login with email/password |
| GET | `/api/v1/users/logout` | Logout |
| GET | `/api/v1/users/auth/google` | Google OAuth login |
| POST | `/api/v1/users/validate-2fa` | Validate 2FA code |
| POST | `/api/v1/users/enable-2fa` | Enable 2FA 🔒 |
| POST | `/api/v1/users/verify-2fa` | Verify 2FA setup 🔒 |
| POST | `/api/v1/users/disable-2fa` | Disable 2FA 🔒 |
| POST | `/api/v1/users/forgotPassword` | Request password reset |
| PATCH | `/api/v1/users/resetPassword/:token` | Reset password |

### Tours
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/tours` | Get all tours (cached) |
| GET | `/api/v1/tours/:id` | Get single tour |
| POST | `/api/v1/tours` | Create tour 🔒 |
| PATCH | `/api/v1/tours/:id` | Update tour 🔒 |
| DELETE | `/api/v1/tours/:id` | Delete tour 🔒 |
| GET | `/api/v1/tours/search` | Advanced search |
| GET | `/api/v1/tours/autocomplete` | Autocomplete |
| GET | `/api/v1/tours/tour-stats` | Tour statistics |

### Bookings
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/bookings/checkout-session/:tourId` | Stripe checkout 🔒 |
| GET | `/api/v1/bookings/my-bookings` | My bookings 🔒 |
| PATCH | `/api/v1/bookings/:id/cancel` | Cancel booking 🔒 |
| PATCH | `/api/v1/bookings/:id/refund` | Process refund 🔒👑 |
| GET | `/api/v1/bookings/stats` | Booking stats 🔒👑 |

### Wishlist, Notifications, Coupons, Activity
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/wishlist` | Get my wishlist 🔒 |
| POST | `/api/v1/wishlist/:tourId` | Add to wishlist 🔒 |
| DELETE | `/api/v1/wishlist/:tourId` | Remove from wishlist 🔒 |
| GET | `/api/v1/notifications` | Get my notifications 🔒 |
| POST | `/api/v1/coupons/validate` | Validate coupon 🔒 |
| GET | `/api/v1/activity/me` | My activity log 🔒 |

> 🔒 = Requires authentication | 👑 = Admin only

## 📖 Interactive API Docs

Visit `http://localhost:3000/api-docs` for the full Swagger UI documentation.

