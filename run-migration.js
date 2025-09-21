#!/usr/bin/env node

const { migrateUserData } = require('./migrations/fixUserData');

console.log('Running user data migration...');
migrateUserData()
  .then(() => {
    console.log('Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
