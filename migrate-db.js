const sequelize = require("./app/utils/pool");

async function migrateDatabase() {
  try {
    console.log("Starting database migration...");

    // Add gitlabToken column if it doesn't exist
    await sequelize.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'gitlabToken'
        ) THEN
          ALTER TABLE users ADD COLUMN "gitlabToken" VARCHAR(255);
        END IF;
      END $$;
    `);

    console.log("✅ gitlabToken column added successfully");

    // Verify the column exists
    const result = await sequelize.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'gitlabToken'
    `);

    if (result[0].length > 0) {
      console.log("✅ gitlabToken column verified in database");
    } else {
      console.log("❌ gitlabToken column not found");
    }

    console.log("Database migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrateDatabase();
