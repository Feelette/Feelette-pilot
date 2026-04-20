const fs = require('fs');
const path = require('path');
const db = require('./index');

async function init() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await db.query(schema);
    console.log('✅ Database initialized successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    process.exit(1);
  }
}

init();
