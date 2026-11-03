const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const config = require('../config');

let activeDbType = 'mysql';
let mysqlPool = null;
let sqliteDb = null;

// Promisified SQLite wrapper to match mysql2/promise interface
class SQLiteAdapter {
  constructor(dbPath) {
    this.db = new sqlite3.Database(dbPath);
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ affectedRows: this.changes, insertId: this.lastID });
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  exec(sql) {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
}

async function initDatabase() {
  // 1. Try MySQL connection first if configured
  if (config.db.type === 'mysql') {
    try {
      console.log(`[DB] Attempting connection to MySQL at ${config.db.host}:${config.db.port}...`);
      
      // Attempt to create database if not exists using a root connection
      try {
        const rootConn = await mysql.createConnection({
          host: config.db.host,
          port: config.db.port,
          user: config.db.user,
          password: config.db.password,
          connectTimeout: 2000
        });
        await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await rootConn.end();
      } catch (dbErr) {
        // Continue to pool connection attempt
      }

      mysqlPool = mysql.createPool({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 2500
      });

      // Test ping
      const [test] = await mysqlPool.query('SELECT 1 AS val');
      if (test && test[0] && test[0].val === 1) {
        activeDbType = 'mysql';
        console.log(`[DB] Successfully connected to MySQL 8.0+ database: ${config.db.database}`);
        
        // Execute MySQL DDL migration
        const schemaPath = path.resolve(__dirname, '../../schema.sql');
        if (fs.existsSync(schemaPath)) {
          const schemaSql = fs.readFileSync(schemaPath, 'utf8');
          const statements = schemaSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--') && !s.toLowerCase().startsWith('create database') && !s.toLowerCase().startsWith('use '));
          
          for (const statement of statements) {
            try {
              await mysqlPool.query(statement);
            } catch (stmtErr) {
              // Ignore table already exists or duplicate key errors during startup
            }
          }
        }
        return;
      }
    } catch (mysqlErr) {
      console.warn(`[DB] MySQL 8.0 server not reachable (${mysqlErr.message}). Switching gracefully to embedded Relational SQLite store.`);
    }
  }

  // 2. Embedded SQLite Fallback with identical tables & relational integrity
  activeDbType = 'sqlite';
  const dbDir = path.resolve(__dirname, '../../data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbFilePath = path.join(dbDir, 'agency.sqlite');
  sqliteDb = new SQLiteAdapter(dbFilePath);
  
  // Enable foreign keys
  await sqliteDb.run('PRAGMA foreign_keys = ON;');
  
  // Apply schema
  const schemaPath = path.resolve(__dirname, '../../schema_sqlite.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await sqliteDb.exec(schemaSql);
  }
  console.log(`[DB] Embedded Relational SQLite database active at: ${dbFilePath}`);
}

/**
 * Universal Query Method
 * Matches mysql2/promise: returns [rows, fields]
 */
async function query(sql, params = []) {
  if (activeDbType === 'mysql' && mysqlPool) {
    return await mysqlPool.query(sql, params);
  }

  // SQLite execution
  const trimmed = sql.trim().toUpperCase();
  if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA')) {
    const rows = await sqliteDb.all(sql, params);
    return [rows, []];
  } else {
    const result = await sqliteDb.run(sql, params);
    return [result, []];
  }
}

/**
 * Universal Execute Method
 */
async function execute(sql, params = []) {
  return await query(sql, params);
}

function getDbType() {
  return activeDbType;
}

module.exports = {
  initDatabase,
  query,
  execute,
  getDbType
};

