# E-Learning Platform with Kafka Integration

## Goal Description
The objective is to create a simple e-learning web application with two main roles: Student and Professor. The platform incorporates a Kafka server as the backbone for an asynchronous notification system. When a Professor adds a new topic/course or updates it, a Kafka event is produced. A background Kafka consumer listens to these events and triggers email notifications to the enrolled students. 

## Proposed Changes

### Configuration
- Relies on a local installation of Kafka (requires downloading Kafka binaries and running Zookeeper and Kafka servers manually in exactly two separate terminal windows).

### Backend Structure (Node.js/Express)
#### [NEW] [backend/package.json](file:///c:/Users/aminf/Desktop/KafkaWeb/backend/package.json)
- Dependencies: `express`, `kafkajs`, `nodemailer`, `cors`, `body-parser`.
#### [NEW] [backend/server.js](file:///c:/Users/aminf/Desktop/KafkaWeb/backend/server.js)
- Simple Express REST API carrying mocked in-memory data arrays for users, courses, and enrollments.
- Endpoints for user login, fetching courses, enrolling in a course, adding a new course, and updating a course.
#### [NEW] [backend/kafkaProducer.js](file:///c:/Users/aminf/Desktop/KafkaWeb/backend/kafkaProducer.js)
- Initializes the Kafka producer.
- Exposes functions to send messages to topics like `course-notifications`.
#### [NEW] [backend/kafkaConsumer.js](file:///c:/Users/aminf/Desktop/KafkaWeb/backend/kafkaConsumer.js)
- Initializes the Kafka consumer.
- Listens to `course-notifications` and processes messages by finding enrolled students and triggering `emailService`.
#### [NEW] [backend/emailService.js](file:///c:/Users/aminf/Desktop/KafkaWeb/backend/emailService.js)
- Uses `nodemailer` with a mock transport (like Ethereal Email) or logs to the console to simulate sending actual emails to students.

### Frontend Structure (HTML/CSS/JS)
#### [NEW] [frontend/index.html](file:///c:/Users/aminf/Desktop/KafkaWeb/frontend/index.html)
- A single-page application UI containing:
  - Login Section (Mocking Student vs Professor roles).
  - Professor Dashboard (Form to add and update courses).
  - Student Dashboard (List of available courses to enroll in).
#### [NEW] [frontend/style.css](file:///c:/Users/aminf/Desktop/KafkaWeb/frontend/style.css)
- Custom Vanilla CSS keeping a modern, vibrant learning platform aesthetic.
#### [NEW] [frontend/app.js](file:///c:/Users/aminf/Desktop/KafkaWeb/frontend/app.js)
- Handles UI state toggling.
- Performs `fetch` requests to the Express backend for logging in, fetching data, creating courses, and enrolling.

### Documentation
#### [NEW] [README.md](file:///c:/Users/aminf/Desktop/KafkaWeb/README.md)
- An extensive guide detailing the architecture, how Kafka mechanisms work in this context, and step-by-step instructions to install, build, and run the project locally.

## Verification Plan

### Automated Tests
- This simple architecture will rely on automated service logs rather than unit tests at this phase. Focus is on integration.

### Manual Verification
1. Download Apache Kafka and extract it locally.
2. Run Zookeeper (`bin/windows/zookeeper-server-start.bat config/zookeeper.properties`).
3. Run Kafka Server (`bin/windows/kafka-server-start.bat config/server.properties`).
4. In the `backend` folder, run `npm install` and `npm start` to run the Express API and Kafka Consumer/Producer.
5. Open `frontend/index.html` in a web browser.
6. Login as "Professor" and add a new course "Kafka Basics".
7. Login as "Student", see "Kafka Basics", and click "Enroll".
8. Login as "Professor" and trigger an "update" on "Kafka Basics".
9. Observe the backend console for a log indicating the Consumer received the event and 'Fake Email sent' to the Student.
