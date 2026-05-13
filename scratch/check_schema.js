const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkSchema() {
    try {
        console.log('Checking users table schema...');
        const usersRes = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        console.log('Users columns:', usersRes.rows);

        console.log('\nChecking complaints table schema...');
        const complaintsRes = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'complaints'
        `);
        console.log('Complaints columns:', complaintsRes.rows);
        
        await pool.end();
    } catch (err) {
        console.error('Error checking schema:', err);
    }
}

checkSchema();
