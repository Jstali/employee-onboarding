const { query } = require("./config/database");

async function testConnection() {
  try {
    console.log("🔍 Testing database connection...");
    
    // Test basic connection
    const result = await query("SELECT current_database(), current_schema();");
    console.log("✅ Database connection successful");
    console.log("📊 Connected to:", result.rows[0]);
    
    // List all tables
    console.log("\n📋 Listing all tables:");
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Check if Users table exists
    console.log("\n🔍 Checking Users table:");
    const usersCheck = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'Users';
    `);
    
    if (usersCheck.rows.length > 0) {
      console.log("✅ Users table found");
      
      // Check Users table structure
      const structure = await query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'Users' 
        ORDER BY ordinal_position;
      `);
      
      console.log("📊 Users table structure:");
      structure.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.log("❌ Users table not found");
    }
    
  } catch (error) {
    console.error("❌ Database test failed:", error);
  }
}

testConnection()
  .then(() => {
    console.log("\n🎉 Database test completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Database test failed:", error);
    process.exit(1);
  });
