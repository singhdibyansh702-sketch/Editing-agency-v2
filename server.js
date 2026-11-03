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

    // 2. Seed realistic demo data
    await seedDatabase(false);

    // 3. Start Express server
    const server = app.listen(config.port, () => {
      console.log(`[Server] Core API & Web Portal running at: http://localhost:${config.port}`);
      console.log(`[Server] Active Database Mode: ${db.getDbType().toUpperCase()}`);
      console.log('----------------------------------------------------');
      console.log('Demo Credentials:');
      console.log('  - Admin:  admin@videoagency.com / AdminPassword123!');
      console.log('  - Editor: editor1@videoagency.com / EditorPass123!');
      console.log('  - Client: client1@techflow.io / ClientPass123!');
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

