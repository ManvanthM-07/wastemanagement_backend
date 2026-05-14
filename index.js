require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const path = require('path');

const app = express();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// --- CLOUD CONNECTION GUARD ---
if (!process.env.DATABASE_URL) {
    console.error('************************************************');
    console.error('CRITICAL ERROR: DATABASE_URL is NOT defined!');
    console.error('Please go to Render Dashboard -> Settings -> Environment Variables');
    console.error('Add a variable named DATABASE_URL with your Aiven connection string.');
    console.error('************************************************');
} else {
    console.log('DATABASE_URL detected. Attempting to connect to cloud database...');
}

// Auto-create tables if they don't exist
const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                approved BOOLEAN DEFAULT FALSE,
                selected_wards JSONB DEFAULT '[]'
            );

            -- Ensure users table columns exist if table was already created
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='approved') THEN
                    ALTER TABLE users ADD COLUMN approved BOOLEAN DEFAULT FALSE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='selected_wards') THEN
                    ALTER TABLE users ADD COLUMN selected_wards JSONB DEFAULT '[]';
                END IF;
            END $$;

            CREATE TABLE IF NOT EXISTS complaints (
                id TEXT PRIMARY KEY,
                category TEXT,
                subcategory TEXT,
                description TEXT,
                reporter TEXT,
                ward TEXT,
                image TEXT,
                date TEXT,
                status TEXT DEFAULT 'submitted',
                assigned_to TEXT,
                worker_details JSONB DEFAULT '{}',
                resolved_proof TEXT,
                resolved_date TEXT
            );

            -- Ensure missing columns exist if table was already created
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='complaints' AND column_name='subcategory') THEN
                    ALTER TABLE complaints ADD COLUMN subcategory TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='complaints' AND column_name='resolved_proof') THEN
                    ALTER TABLE complaints ADD COLUMN resolved_proof TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='complaints' AND column_name='resolved_date') THEN
                    ALTER TABLE complaints ADD COLUMN resolved_date TEXT;
                END IF;
            END $$;
        `);
        console.log('Database tables verified/created successfully.');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
};

initDb();


const SECRET_KEY = 'eco_mysuru_premium_secret';

app.use(cors({
    origin: function (origin, callback) {
        // Allow local, Vercel, and any Render deployment
        if (!origin || 
            origin.endsWith('.onrender.com') || 
            origin.includes('localhost') || 
            origin === 'https://ecomysore.vercel.app') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Serve frontend from the sibling directory
app.use(express.static(path.join(__dirname, '../Wastemanagement')));

// --- AUTH ROUTES ---

app.post('/api/register', async (req, res) => {
    const { username, password, role, selectedWards } = req.body;
    
    if (role === 'admin') {
        return res.status(403).json({ message: 'Administrative accounts must be created by system owners.' });
    }

    try {
        const userExists = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userExists.rows.length > 0) return res.status(400).json({ message: 'User already exists' });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const id = String(Date.now());
        const approved = role !== 'worker';
        
        await pool.query(
            'INSERT INTO users (id, username, password, role, approved, selected_wards) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, username, hashedPassword, role, approved, JSON.stringify(selectedWards || [])]
        );
        
        res.json({ message: 'Registration successful' });
    } catch (error) {
        console.error('Registration error:', error);
        const errorMessage = error.message || error.code || JSON.stringify(error);
        res.status(500).json({ 
            message: `Backend Error: ${errorMessage}`,
            detail: error.stack
        });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        
        if (!user) return res.status(400).json({ message: 'User not found' });
        
        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(400).json({ message: 'Invalid password' });

        if (user.role === 'worker' && !user.approved) {
            return res.status(403).json({ message: 'Your account is pending administrative approval.' });
        }
        
        const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, SECRET_KEY);
        res.json({ token, role: user.role, username: user.username });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// --- COMPLAINT ROUTES ---

app.post('/api/complaints', async (req, res) => {
    try {
        const id = `CMP-${Math.floor(1000 + Math.random() * 9000)}`;
        const date = new Date().toISOString().split('T')[0];
        const status = 'submitted';
        const { category, subcategory, desc, reporter, ward, image } = req.body;

        await pool.query(
            'INSERT INTO complaints (id, category, subcategory, description, reporter, ward, image, date, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [id, category, subcategory, desc, reporter, ward, image, date, status]
        );

        res.json({ id, category, subcategory, desc, reporter, ward, image, date, status });
    } catch (error) {
        console.error('Error saving complaint:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/api/complaints', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, category, subcategory, description as desc, reporter, ward, image, date, status, assigned_to as "assignedTo", worker_details as "workerDetails" FROM complaints');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching complaints:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.patch('/api/complaints/:id', async (req, res) => {
    const { status } = req.body;
    const complaintId = req.params.id;

    try {
        const result = await pool.query('SELECT * FROM complaints WHERE id = $1', [complaintId]);
        const complaint = result.rows[0];
        
        if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

        let updates = { ...req.body };
        let assignedTo = complaint.assigned_to;
        let workerDetails = complaint.worker_details;

        if (status === 'progress' && !assignedTo) {
            console.log(`Searching for worker in ward: ${complaint.ward}`);
            const workersResult = await pool.query('SELECT * FROM users WHERE role = $1 AND approved = true', ['worker']);
            const eligibleWorker = workersResult.rows.find(w => {
                const wards = w.selected_wards || [];
                return wards.includes(complaint.ward);
            });

            if (eligibleWorker) {
                assignedTo = eligibleWorker.username;
                workerDetails = {
                    name: eligibleWorker.username,
                    id: eligibleWorker.id,
                    wards: eligibleWorker.selected_wards
                };
            }
        }

        // Prepare dynamic update query
        const queryFields = [];
        const values = [];
        let counter = 1;

        if (status) {
            queryFields.push(`status = $${counter++}`);
            values.push(status);
            
            // If reopening (setting back to submitted), clear assignment and proof
            if (status === 'submitted') {
                queryFields.push(`assigned_to = NULL`);
                queryFields.push(`worker_details = '{}'`);
                queryFields.push(`resolved_proof = NULL`);
                queryFields.push(`resolved_date = NULL`);
            }
        }
        if (assignedTo && status !== 'submitted') {
            queryFields.push(`assigned_to = $${counter++}`);
            values.push(assignedTo);
        }
        if (workerDetails && status !== 'submitted') {
            queryFields.push(`worker_details = $${counter++}`);
            values.push(JSON.stringify(workerDetails));
        }

        if (queryFields.length > 0) {
            values.push(complaintId);
            await pool.query(`UPDATE complaints SET ${queryFields.join(', ')} WHERE id = $${counter}`, values);
        }

        res.json({ success: true, assignedTo });
    } catch (error) {
        console.error('Error updating complaint:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// --- ADMIN MANAGEMENT ROUTES ---

app.get('/api/admin/workers', async (req, res) => {
    try {
        const workersResult = await pool.query('SELECT id, username, selected_wards as "selectedWards" FROM users WHERE role = $1 AND approved = true', ['worker']);
        const complaintsResult = await pool.query('SELECT assigned_to, status FROM complaints WHERE assigned_to IS NOT NULL');
        
        const workers = workersResult.rows.map(worker => {
            const workerTasks = complaintsResult.rows.filter(c => c.assigned_to === worker.username);
            const activeTasks = workerTasks.filter(c => c.status !== 'resolved' && c.status !== 'closed').length;
            const completedTasks = workerTasks.filter(c => c.status === 'resolved' || c.status === 'closed').length;
            
            return {
                ...worker,
                activeTasks,
                completedTasks,
                status: activeTasks > 0 ? 'Active' : 'Idle'
            };
        });
        
        res.json(workers);
    } catch (error) {
        console.error('Error fetching workers:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/api/admin/workers/pending', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, selected_wards as "selectedWards" FROM users WHERE role = $1 AND approved = false', ['worker']);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching pending workers:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/admin/workers/approve/:id', async (req, res) => {
    try {
        await pool.query('UPDATE users SET approved = true WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error approving worker:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// --- WORKER ROUTES ---

app.get('/api/tasks/:workerId', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, category, description as desc, reporter, ward, image, date, status, assigned_to as "assignedTo", worker_details as "workerDetails" FROM complaints WHERE assigned_to = $1',
            [req.params.workerId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Smart static file serving for Local vs Render
const fs = require('fs');
const frontendPath = path.join(__dirname, '../Wastemanagement');

if (fs.existsSync(frontendPath) && fs.existsSync(path.join(frontendPath, 'index.html'))) {
    app.use(express.static(frontendPath));
    // Serve index.html for all other routes (SPA support)
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
} else {
    // Fallback for backend-only deployments
    app.get('/', (req, res) => {
        res.status(200).send('<h1>EcoMysuru API is Live</h1><p>Status: <span style="color: #00ff88;">Operational</span></p><p>Database: Connected</p>');
    });
}

const PORT = process.env.PORT || 3000;
// --- DEBUG ROUTES ---
app.get('/api/debug/db', async (req, res) => {
    try {
        const users = await pool.query('SELECT * FROM users');
        const complaints = await pool.query('SELECT * FROM complaints');
        res.json({
            users: users.rows,
            complaints: complaints.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Premium Backend running on port ${PORT}`);
});
