const app = require('./src/app');
const config = require('./src/config');
const db = require('./src/db');
const { seedDatabase } = require('./src/db/seed');

async function startServer() {
  try {
    console.log('----------------------------------------------------');
    console.log('   VIDEO EDITING AGENCY MANAGEMENT SYSTEM (v2.0)   ');
    console.log('----------------------------------------------------');
    
    // 1. Initialize Database (MySQL or embedded Relational SQLite fallback)
    await db.initDatabase();

    // 2. Initialize administrator & clean state
    await seedDatabase(false, false);

    // 3. Start Express server
    const server = app.listen(config.port, () => {
      console.log(`[Server] Core API & Web Portal running at: http://localhost:${config.port}`);
      console.log(`[Server] Active Database Mode: ${db.getDbType().toUpperCase()}`);
      console.log('----------------------------------------------------');
      console.log('Administrator Provisioned:');
      console.log('  - Name: admin dibyansh');
      console.log('  - Email/Username: admin@videoagency.com (or "admin")');
      console.log('----------------------------------------------------');
    });

    return server;
  } catch (err) {
    console.error('[Server] Fatal startup failure:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };

