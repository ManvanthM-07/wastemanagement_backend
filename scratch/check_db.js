const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkDatabase() {
    try {
        console.log('Checking database tables...');
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('Tables found:', res.rows.map(r => r.table_name));
        
        if (res.rows.length === 0) {
            console.log('No tables found. Migration might be needed.');
        }
        
        await pool.end();
    } catch (err) {
        console.error('Database connection error:', err);
        process.exit(1);
    }
}

checkDatabase();
