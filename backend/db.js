const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

const DEFAULT_DATA = {
    users: [
        { id: 1, name: 'Alice', role: 'student', email: 'alice@student.com' },
        { id: 2, name: 'Bob', role: 'student', email: 'bob@student.com' },
        { id: 3, name: 'Dr. Smith', role: 'professor', email: 'smith@univ.edu' }
    ],
    courses: [
        { id: 1, title: 'Introduction to Node.js', description: 'Learn basics of Node.js' },
        { id: 2, title: 'React for Beginners', description: 'Start building UIs' }
    ],
    enrollments: {
        "1": [1, 2],
        "2": [1]
    }
};

function load() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const raw = fs.readFileSync(DB_PATH, 'utf-8');
            const data = JSON.parse(raw);
            console.log('✅ Database loaded from db.json');
            return data;
        }
    } catch (err) {
        console.error('⚠️  Error reading db.json, starting with defaults:', err.message);
    }
    // First run or corrupted file — initialize with defaults
    const data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    save(data);
    console.log('✅ Database initialized with default data');
    return data;
}

function save(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
        console.error('❌ Error saving db.json:', err.message);
    }
}

// Load once at module init
const db = load();

module.exports = { db, save };
