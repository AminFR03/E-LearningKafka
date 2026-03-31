require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { produceMessage } = require('./kafkaProducer');
const { createOrUpdateStudentConsumer } = require('./kafkaConsumer');
const { createKafkaTopic } = require('./kafkaAdmin');
const { sendEmailNotification } = require('./emailService');
const { db, save } = require('./db');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Data is now loaded from db.json (persisted across restarts)
global.courses = db.courses;
global.users = db.users;
global.enrollments = db.enrollments;

app.get('/api/users', (req, res) => {
    res.json(global.users);
});

app.post('/api/users/register', async (req, res) => {
    const { name, role, email } = req.body;
    if (global.users.find(u => u.email === email)) {
        return res.status(400).json({ message: 'Email already exists' });
    }
    // Generate ID safely: max existing ID + 1
    const maxId = global.users.reduce((max, u) => Math.max(max, u.id), 0);
    const newUser = { id: maxId + 1, name, role, email };
    global.users.push(newUser);
    save(db); // persist to disk
    
    if (role === 'student') {
        await createOrUpdateStudentConsumer(newUser);
    }
    
    res.json(newUser);
});

app.post('/api/users/login', async (req, res) => {
    const { email } = req.body;
    const user = global.users.find(u => u.email === email);
    if (user) {
        if (user.role === 'student') {
            await createOrUpdateStudentConsumer(user);
        }
        res.json(user);
    } else {
        res.status(404).json({ message: 'User not found' });
    }
});

app.get('/api/courses', (req, res) => {
    res.json(global.courses);
});

app.post('/api/courses/enroll', async (req, res) => {
    const { userId, courseId } = req.body;
    if (!global.enrollments[courseId]) {
        global.enrollments[courseId] = [];
    }
    if (global.enrollments[courseId].includes(userId)) {
        return res.json({ message: 'Already enrolled' });
    }
    global.enrollments[courseId].push(userId);
    save(db); // persist to disk
    
    // Send a single direct welcome email to the student
    const student = global.users.find(u => u.id === userId);
    const course = global.courses.find(c => c.id === courseId);
    if (student && course) {
        sendEmailNotification(
            student.email,
            `✅ Enrollment Confirmed: ${course.title}`,
            `Hello ${student.name},\n\nYou have been successfully enrolled in "${course.title}".\nDescription: ${course.description}\n\nYou will now receive email notifications whenever the professor updates this course.\n\nHappy Learning!`
        );
    }
    
    // Refresh the student's personal Kafka consumer so it subscribes to this new topic
    if (student) {
        await createOrUpdateStudentConsumer(student);
    }
    
    res.json({ message: 'Enrolled successfully' });
});

app.get('/api/enrollments/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const enrolledCourseIds = Object.keys(global.enrollments).filter(cId =>
        global.enrollments[cId].includes(userId)
    );
    const enrolledCourses = enrolledCourseIds.map(cId => {
        return global.courses.find(c => c.id === parseInt(cId));
    }).filter(Boolean);
    res.json(enrolledCourses);
});

app.post('/api/courses', async (req, res) => {
    const { title, description } = req.body;
    // Generate ID safely: max existing ID + 1
    const maxId = global.courses.reduce((max, c) => Math.max(max, c.id), 0);
    const newCourse = {
        id: maxId + 1,
        title,
        description
    };
    global.courses.push(newCourse);
    global.enrollments[newCourse.id] = [];
    save(db); // persist to disk
    
    const topicName = `course-${newCourse.id}`;
    await createKafkaTopic(topicName);

    res.json({ message: 'Course created', course: newCourse });
});

app.put('/api/courses/:id', async (req, res) => {
    const courseId = parseInt(req.params.id);
    const { title, description } = req.body;
    
    const courseIndex = global.courses.findIndex(c => c.id === courseId);
    if (courseIndex > -1) {
        global.courses[courseIndex].title = title || global.courses[courseIndex].title;
        global.courses[courseIndex].description = description || global.courses[courseIndex].description;
        save(db); // persist to disk
        
        const topicName = `course-${courseId}`;
        
        // Produce Kafka event to exact topic
        await produceMessage(topicName, {
            action: 'COURSE_UPDATED',
            courseId,
            title: global.courses[courseIndex].title,
            description: global.courses[courseIndex].description
        });

        res.json({ message: 'Course updated', course: global.courses[courseIndex] });
    } else {
        res.status(404).json({ message: 'Course not found' });
    }
});

const PORT = 3000;

app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    
    // Create Kafka topics for all existing courses on startup
    for (const course of global.courses) {
        await createKafkaTopic(`course-${course.id}`);
    }
});
