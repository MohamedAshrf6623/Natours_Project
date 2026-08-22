const Redis = require('ioredis');

let client;
let isConnected = false;

const getClient = () => {
  if (!client) {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: true
    });

    client.on('connect', () => {
      isConnected = true;
      console.log('✅ Redis connected successfully');
    });

    client.on('error', err => {
      isConnected = false;
      console.log('⚠️ Redis connection error (caching disabled):', err.message);
    });

    client.on('close', () => {
      isConnected = false;
    });

    // Attempt connection but don't crash if Redis is unavailable
    client.connect().catch(err => {
      isConnected = false;
      console.log('⚠️ Redis not available, caching disabled:', err.message);
    });
  }
  return client;
};

/**
 * Get cached data by key
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Parsed data or null
 */
const get = async key => {
  try {
    if (!isConnected) return null;
    const data = await getClient().get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.log('Redis get error:', err.message);
    return null;
  }
};

/**
 * Set cached data
 * @param {string} key - Cache key
 * @param {any} value - Data to cache
 * @param {number} ttl - TTL in seconds (default: 1 hour)
 */
const set = async (key, value, ttl = 3600) => {
  try {
    if (!isConnected) return;
    await getClient().set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    console.log('Redis set error:', err.message);
  }
};

/**
 * Delete cached data by key
 * @param {string} key - Cache key
 */
const del = async key => {
  try {
    if (!isConnected) return;
    await getClient().del(key);
  } catch (err) {
    console.log('Redis del error:', err.message);
  }
};

/**
 * Delete all keys matching a pattern
 * @param {string} pattern - Pattern to match (e.g., 'tours:*')
 */
const delByPattern = async pattern => {
  try {
    if (!isConnected) return;
    const keys = await getClient().keys(pattern);
    if (keys.length > 0) {
      await getClient().del(...keys);
    }
  } catch (err) {
    console.log('Redis delByPattern error:', err.message);
  }
};

/**
 * Flush all cached data
 */
const flush = async () => {
  try {
    if (!isConnected) return;
    await getClient().flushdb();
  } catch (err) {
    console.log('Redis flush error:', err.message);
  }
};

/**
 * Express middleware for caching GET requests
 * @param {number} ttl - TTL in seconds
 * @returns {Function} Express middleware
 */
const cacheMiddleware = (ttl = 3600) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') return next();

    const key = `cache:${req.originalUrl}`;

    try {
      const cachedData = await get(key);
      if (cachedData) {
        return res.status(200).json({
          status: 'success',
          source: 'cache',
          ...cachedData
        });
      }
    } catch (err) {
      // Continue without cache on error
    }

    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = body => {
      if (res.statusCode === 200 && body.status === 'success') {
        set(key, body, ttl).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
};

module.exports = {
  getClient,
  get,
  set,
  del,
  delByPattern,
  flush,
  cacheMiddleware
};
