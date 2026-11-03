const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'super_secure_video_agency_jwt_secret_key_2026_!@#',
  cookieSecret: process.env.COOKIE_SECRET || 'agency_cookie_secret_key_998877',
  db: {
    type: process.env.DB_TYPE || 'mysql',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'video_agency'
  },
  pythonServiceUrl: process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8001'
};

