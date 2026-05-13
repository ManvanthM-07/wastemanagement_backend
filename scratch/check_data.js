const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkData() {
    try {
        const usersCount = await pool.query('SELECT COUNT(*) FROM users');
        const complaintsCount = await pool.query('SELECT COUNT(*) FROM complaints');
        console.log(`Users count: ${usersCount.rows[0].count}`);
        console.log(`Complaints count: ${complaintsCount.rows[0].count}`);
        await pool.end();
    } catch (err) {
        console.error('Error checking data:', err);
    }
}

checkData();
