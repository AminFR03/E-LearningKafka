require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { produceMessage } = require('./kafkaProducer');
const { createOrUpdateStudentConsumer } = require('./kafkaConsumer');
const { createKafkaTopic } = require('./kafkaAdmin');
const { sendEmailNotification } = require('./emailService');

const app = express();
app.use(cors());
app.use(bodyParser.json());

global.courses = [
    { id: 1, title: 'Introduction to Node.js', description: 'Learn basics of Node.js' },
    { id: 2, title: 'React for Beginners', description: 'Start building UIs' }
];

global.users = [
    { id: 1, name: 'Alice', role: 'student', email: 'alice@student.com' },
    { id: 2, name: 'Bob', role: 'student', email: 'bob@student.com' },
    { id: 3, name: 'Dr. Smith', role: 'professor', email: 'smith@univ.edu' }
];

global.enrollments = {
    1: [1, 2],
    2: [1]
};

app.get('/api/users', (req, res) => {
    res.json(global.users);
});

app.post('/api/users/register', async (req, res) => {
    const { name, role, email } = req.body;
    if (global.users.find(u => u.email === email)) {
        return res.status(400).json({ message: 'Email already exists' });
    }
    const newUser = { id: global.users.length + 1, name, role, email };
    global.users.push(newUser);
    
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
    const newCourse = {
        id: global.courses.length + 1,
        title,
        description
    };
    global.courses.push(newCourse);
    global.enrollments[newCourse.id] = [];
    
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
    
    // Create base topics for the mock courses on startup so they exist!
    await createKafkaTopic('course-1');
    await createKafkaTopic('course-2');
});
