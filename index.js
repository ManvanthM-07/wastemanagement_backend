const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

const app = express();
const adapter = new FileSync('db.json');
const db = low(adapter);

const SECRET_KEY = 'eco_mysuru_premium_secret';

// Initialize DB
db.defaults({ users: [], complaints: [], tasks: [] }).write();

app.use(cors());
// Increased limit for base64 images
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Serve frontend from the sibling directory
app.use(express.static(path.join(__dirname, '../Wastemanagement')));

// --- AUTH ROUTES ---

app.post('/api/register', async (req, res) => {
    const { username, password, role } = req.body;
    const userExists = db.get('users').find({ username }).value();
    
    if (userExists) return res.status(400).json({ message: 'User already exists' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { id: Date.now(), username, password: hashedPassword, role };
    
    db.get('users').push(newUser).write();
    res.json({ message: 'Registration successful' });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = db.get('users').find({ username }).value();
    
    if (!user) return res.status(400).json({ message: 'User not found' });
    
    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(400).json({ message: 'Invalid password' });
    
    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, SECRET_KEY);
    res.json({ token, role: user.role, username: user.username });
});

// --- COMPLAINT ROUTES ---

app.post('/api/complaints', (req, res) => {
    try {
        const complaint = { 
            ...req.body, 
            id: `CMP-${Math.floor(1000 + Math.random() * 9000)}`, 
            date: new Date().toISOString().split('T')[0], 
            status: 'submitted' 
        };
        db.get('complaints').push(complaint).write();
        res.json(complaint);
    } catch (error) {
        console.error('Error saving complaint:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/api/complaints', (req, res) => {
    res.json(db.get('complaints').value());
});

app.patch('/api/complaints/:id', (req, res) => {
    db.get('complaints').find({ id: req.params.id }).assign(req.body).write();
    res.json({ success: true });
});

// --- WORKER ROUTES ---

app.get('/api/tasks/:workerId', (req, res) => {
    const tasks = db.get('complaints').filter({ assignedTo: req.params.workerId }).value();
    res.json(tasks);
});

// Serve index.html for all other routes to support SPA if needed
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../Wastemanagement/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Premium Backend running at http://localhost:${PORT}`);
});
