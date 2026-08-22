const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Natours API',
      version: '2.0.0',
      description:
        'A comprehensive tour booking REST API built with Node.js, Express, and MongoDB. Features include OAuth 2.0, 2FA, coupons, wishlists, notifications, and more.',
      contact: {
        name: 'Natours API Support',
        email: 'support@natours.com'
      },
      license: {
        name: 'ISC'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        Tour: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'The Forest Hiker' },
            duration: { type: 'number', example: 5 },
            maxGroupSize: { type: 'number', example: 25 },
            difficulty: {
              type: 'string',
              enum: ['easy', 'medium', 'difficult']
            },
            ratingsAverage: { type: 'number', example: 4.7 },
            ratingsQuantity: { type: 'number', example: 37 },
            price: { type: 'number', example: 397 },
            summary: { type: 'string' },
            description: { type: 'string' },
            imageCover: { type: 'string' },
            images: { type: 'array', items: { type: 'string' } },
            startDates: {
              type: 'array',
              items: { type: 'string', format: 'date-time' }
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'John Doe' },
            email: {
              type: 'string',
              format: 'email',
              example: 'john@example.com'
            },
            photo: { type: 'string', example: 'default.jpg' },
            role: {
              type: 'string',
              enum: ['user', 'guide', 'lead-guide', 'admin']
            },
            twoFactorEnabled: { type: 'boolean', default: false },
            authProvider: { type: 'string', enum: ['local', 'google'] }
          }
        },
        Review: {
          type: 'object',
          properties: {
            review: { type: 'string' },
            rating: { type: 'number', minimum: 1, maximum: 5 },
            tour: { type: 'string', description: 'Tour ID' },
            user: { type: 'string', description: 'User ID' }
          }
        },
        Booking: {
          type: 'object',
          properties: {
            tour: { type: 'string' },
            user: { type: 'string' },
            price: { type: 'number' },
            status: {
              type: 'string',
              enum: [
                'confirmed',
                'pending',
                'cancelled',
                'refunded',
                'completed'
              ]
            },
            paid: { type: 'boolean' },
            couponCode: { type: 'string' },
            discountAmount: { type: 'number' }
          }
        },
        Coupon: {
          type: 'object',
          properties: {
            code: { type: 'string', example: 'SUMMER2024' },
            description: { type: 'string' },
            discountType: { type: 'string', enum: ['percentage', 'fixed'] },
            discountValue: { type: 'number' },
            validFrom: { type: 'string', format: 'date-time' },
            validUntil: { type: 'string', format: 'date-time' },
            active: { type: 'boolean' }
          }
        },
        Notification: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            title: { type: 'string' },
            message: { type: 'string' },
            read: { type: 'boolean' }
          }
        },
        Wishlist: {
          type: 'object',
          properties: {
            user: { type: 'string' },
            tour: { type: 'string' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'fail' },
            message: { type: 'string' }
          }
        }
      }
    },
    tags: [
      { name: 'Authentication', description: 'Auth endpoints including OAuth & 2FA' },
      { name: 'Tours', description: 'Tour CRUD and search operations' },
      { name: 'Users', description: 'User management' },
      { name: 'Reviews', description: 'Tour reviews' },
      { name: 'Bookings', description: 'Tour bookings, cancellations & refunds' },
      { name: 'Coupons', description: 'Promo code management' },
      { name: 'Wishlist', description: 'User favorites' },
      { name: 'Notifications', description: 'User notifications' },
      { name: 'Activity Logs', description: 'User activity audit trail' }
    ],
    paths: {
      '/api/v1/users/signup': {
        post: {
          tags: ['Authentication'],
          summary: 'Create a new user account',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'email', 'password', 'passwordConfirm'],
                  properties: {
                    name: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    passwordConfirm: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            201: { description: 'User created successfully' },
            400: { description: 'Validation error' }
          }
        }
      },
      '/api/v1/users/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Log in with email and password',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Login successful (may require 2FA)' },
            401: { description: 'Incorrect credentials' }
          }
        }
      },
      '/api/v1/users/auth/google': {
        get: {
          tags: ['Authentication'],
          summary: 'Initiate Google OAuth 2.0 login',
          responses: {
            302: { description: 'Redirect to Google consent screen' }
          }
        }
      },
      '/api/v1/users/validate-2fa': {
        post: {
          tags: ['Authentication'],
          summary: 'Validate 2FA code during login',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['tempToken', 'token'],
                  properties: {
                    tempToken: { type: 'string' },
                    token: { type: 'string', description: '6-digit TOTP code' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: '2FA verified, JWT issued' },
            401: { description: 'Invalid 2FA code' }
          }
        }
      },
      '/api/v1/users/enable-2fa': {
        post: {
          tags: ['Authentication'],
          summary: 'Enable two-factor authentication',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'QR code and secret returned' }
          }
        }
      },
      '/api/v1/tours': {
        get: {
          tags: ['Tours'],
          summary: 'Get all tours (cached)',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer' } },
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'sort', in: 'query', schema: { type: 'string' } },
            { name: 'fields', in: 'query', schema: { type: 'string' } }
          ],
          responses: {
            200: { description: 'List of tours' }
          }
        }
      },
      '/api/v1/tours/search': {
        get: {
          tags: ['Tours'],
          summary: 'Advanced tour search with filters',
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search query' },
            { name: 'difficulty', in: 'query', schema: { type: 'string' } },
            { name: 'minPrice', in: 'query', schema: { type: 'number' } },
            { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
            { name: 'minRating', in: 'query', schema: { type: 'number' } }
          ],
          responses: {
            200: { description: 'Search results with pagination' }
          }
        }
      },
      '/api/v1/tours/autocomplete': {
        get: {
          tags: ['Tours'],
          summary: 'Tour name autocomplete suggestions',
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string' } }
          ],
          responses: {
            200: { description: 'List of matching tour suggestions' }
          }
        }
      },
      '/api/v1/bookings/{id}/cancel': {
        patch: {
          tags: ['Bookings'],
          summary: 'Cancel a booking',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            200: { description: 'Booking cancelled' },
            403: { description: 'Not authorized' }
          }
        }
      },
      '/api/v1/bookings/{id}/refund': {
        patch: {
          tags: ['Bookings'],
          summary: 'Process refund for cancelled booking (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            200: { description: 'Refund processed' }
          }
        }
      },
      '/api/v1/coupons/validate': {
        post: {
          tags: ['Coupons'],
          summary: 'Validate a coupon code',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['code'],
                  properties: {
                    code: { type: 'string' },
                    tourId: { type: 'string' },
                    bookingAmount: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Coupon valid with discount info' },
            404: { description: 'Invalid coupon' }
          }
        }
      },
      '/api/v1/wishlist': {
        get: {
          tags: ['Wishlist'],
          summary: 'Get my wishlist',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'User wishlist' }
          }
        }
      },
      '/api/v1/wishlist/{tourId}': {
        post: {
          tags: ['Wishlist'],
          summary: 'Add tour to wishlist',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'tourId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            201: { description: 'Added to wishlist' }
          }
        },
        delete: {
          tags: ['Wishlist'],
          summary: 'Remove tour from wishlist',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'tourId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            204: { description: 'Removed from wishlist' }
          }
        }
      },
      '/api/v1/notifications': {
        get: {
          tags: ['Notifications'],
          summary: 'Get my notifications',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'User notifications with unread count' }
          }
        }
      },
      '/api/v1/activity/me': {
        get: {
          tags: ['Activity Logs'],
          summary: 'Get my activity log',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'User activity history' }
          }
        }
      }
    }
  },
  apis: []
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
