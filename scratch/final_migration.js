const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function migrateData() {
    try {
        const dbPath = path.join(__dirname, '../db.json');
        if (!fs.existsSync(dbPath)) {
            console.error('db.json not found!');
            return;
        }

        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        console.log(`Read ${data.users.length} users and ${data.complaints.length} complaints from db.json`);

        // Migrate Users
        console.log('Migrating users...');
        for (const user of data.users) {
            await pool.query(`
                INSERT INTO users (id, username, password, role, approved, selected_wards)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (username) DO UPDATE SET
                    id = EXCLUDED.id,
                    password = EXCLUDED.password,
                    role = EXCLUDED.role,
                    approved = EXCLUDED.approved,
                    selected_wards = EXCLUDED.selected_wards
            `, [
                user.id, 
                user.username, 
                user.password, 
                user.role, 
                user.approved, 
                JSON.stringify(user.selectedWards || [])
            ]);
        }

        // Migrate Complaints
        console.log('Migrating complaints...');
        for (const comp of data.complaints) {
            await pool.query(`
                INSERT INTO complaints (id, category, description, reporter, ward, image, date, status, assigned_to, worker_details)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (id) DO UPDATE SET
                    category = EXCLUDED.category,
                    description = EXCLUDED.description,
                    status = EXCLUDED.status,
                    assigned_to = EXCLUDED.assigned_to,
                    worker_details = EXCLUDED.worker_details
            `, [
                comp.id,
                comp.category,
                comp.desc || comp.description,
                comp.reporter,
                comp.ward,
                comp.image,
                comp.date,
                comp.status,
                comp.assignedTo || comp.assigned_to,
                JSON.stringify(comp.workerDetails || comp.worker_details || {})
            ]);
        }

        console.log('Migration completed successfully!');
        await pool.end();
    } catch (err) {
        console.error('Migration error:', err);
    }
}

migrateData();
