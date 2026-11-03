const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');

// Safe loader for native sqlite3 (which can fail on different GLIBC linux versions)
let sqlite3 = null;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (e) {
  console.warn(`[DB] Native sqlite3 addon unavailable (${e.message}). Will use pure WebAssembly sql.js fallback.`);
}

let initSqlJs = null;
try {
  initSqlJs = require('sql.js');
} catch (e) {
  // sql.js not installed
}

let activeDbType = 'mysql';
let mysqlPool = null;
let sqliteDb = null;

// Native SQLite3 Wrapper
class NativeSQLiteAdapter {
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

// Pure WebAssembly SQLite Wrapper (Immune to Linux GLIBC issues)
class WasmSQLiteAdapter {
  constructor(dbPath, SQL) {
    this.dbPath = dbPath;
    if (fs.existsSync(dbPath)) {
      try {
        const fileBuffer = fs.readFileSync(dbPath);
        this.db = new SQL.Database(fileBuffer);
      } catch {
        this.db = new SQL.Database();
      }
    } else {
      this.db = new SQL.Database();
    }
  }

  save() {
    try {
      const data = this.db.export();
      fs.writeFileSync(this.dbPath, Buffer.from(data));
    } catch (e) {
      console.warn('[DB] Disk persistence warning:', e.message);
    }
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        this.db.run(sql, params);
        this.save();
        const changes = this.db.getRowsModified();
        resolve({ affectedRows: changes, insertId: 0 });
      } catch (err) {
        reject(err);
      }
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    });
  }

  exec(sql) {
    return new Promise((resolve, reject) => {
      try {
        this.db.exec(sql);
        this.save();
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }
}

async function initDatabase() {
  // 1. Try MySQL connection first if configured
  if (config.db.type === 'mysql') {
    try {
      console.log(`[DB] Attempting connection to MySQL at ${config.db.host}:${config.db.port}...`);
      
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
              // Ignore duplicate errors during startup
            }
          }
        }
        return;
      }
    } catch (mysqlErr) {
      console.warn(`[DB] MySQL 8.0 server not reachable (${mysqlErr.message}). Switching gracefully to embedded Relational SQLite store.`);
    }
  }

  // 2. Embedded Relational SQLite
  activeDbType = 'sqlite';
  const dbDir = path.resolve(__dirname, '../../data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbFilePath = path.join(dbDir, 'agency.sqlite');

  // Attempt native sqlite3 if binary loaded without GLIBC error
  if (sqlite3) {
    try {
      sqliteDb = new NativeSQLiteAdapter(dbFilePath);
      console.log(`[DB] Embedded Relational SQLite (native driver) active at: ${dbFilePath}`);
    } catch (err) {
      console.warn(`[DB] Native SQLite adapter init failed (${err.message}). Falling back to WebAssembly SQLite.`);
      sqliteDb = null;
    }
  }

  // If native sqlite3 failed or is absent, use WebAssembly sql.js
  if (!sqliteDb && initSqlJs) {
    const SQL = await initSqlJs();
    sqliteDb = new WasmSQLiteAdapter(dbFilePath, SQL);
    console.log(`[DB] Embedded Relational SQLite (WebAssembly engine) active at: ${dbFilePath}`);
  }

  if (!sqliteDb) {
    throw new Error('No database driver could be initialized.');
  }

  // Enable foreign keys
  await sqliteDb.run('PRAGMA foreign_keys = ON;');
  
  // Apply schema
  const schemaPath = path.resolve(__dirname, '../../schema_sqlite.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await sqliteDb.exec(schemaSql);
  }
}

/**
 * Universal Query Method
 */
async function query(sql, params = []) {
  if (activeDbType === 'mysql' && mysqlPool) {
    return await mysqlPool.query(sql, params);
  }

  const trimmed = sql.trim().toUpperCase();
  if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA')) {
    const rows = await sqliteDb.all(sql, params);
    return [rows, []];
  } else {
    const result = await sqliteDb.run(sql, params);
    return [result, []];
  }
}

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
