# Project Walkthrough

## Summary of Accomplished Work

The complete architecture and code for your custom **Kafka E-Learning Platform** has been created in your `KafkaWeb` workspace. This full-stack application fulfills all your requirements and illustrates an asynchronous event-driven system built with Node.js and Apache Kafka.

### Components Delivered
- **Frontend SPA**: A single-page application ([index.html](file:///c:/Users/aminf/Desktop/KafkaWeb/frontend/index.html), [style.css](file:///c:/Users/aminf/Desktop/KafkaWeb/frontend/style.css), [app.js](file:///c:/Users/aminf/Desktop/KafkaWeb/frontend/app.js)) designed with a modern, beautiful glassmorphism aesthetic. It allows users to log in easily by selecting a "Student" or "Professor" Profile. 
  - Students can browse available courses and 'Enroll' via `fetch` API.
  - Professors can create new courses and update existing components.
- **Backend Node Server**: Built with Express ([server.js](file:///c:/Users/aminf/Desktop/KafkaWeb/backend/server.js)), storing courses and users in-memory to keep the application lightweight without losing the focus on Kafka! Includes all necessary API routes.
- **Email Service Simulator**: Integrates `nodemailer` alongside Ethereal (a fake SMTP testing service). This proves the mechanism can send actual emails without spamming local addresses.
- **Kafka Mechanisms ([kafkaProducer.js](file:///c:/Users/aminf/Desktop/KafkaWeb/backend/kafkaProducer.js) & [kafkaConsumer.js](file:///c:/Users/aminf/Desktop/KafkaWeb/backend/kafkaConsumer.js))**: 
  - The decoupled event architecture creates immense scalability.
  - When the Express REST API receives a "create" or "update" event, the Producer emits a message to the `course-notifications` topic.
  - The standalone Consumer asynchronously listens to `course-notifications`, identifies enrolled students, and fires off mock emails.
- **Detailed [README.md](file:///c:/Users/aminf/Desktop/KafkaWeb/README.md)**: Provides a step-by-step breakdown on the core mechanism of action, as well as literal, explicit terminal commands on how to run Zookeeper, Kafka, the backend, and view the frontend without using Docker. 

## Validation
To manually validate everything and see the project in action:
1. Ensure your local native Kafka server is running (instructions in README).
2. Install dependencies using `cd backend` and `npm install`.
3. Start the node server `node server.js`.
4. Run the frontend [index.html](file:///c:/Users/aminf/Desktop/KafkaWeb/frontend/index.html) file in your browser.
5. Watch the backend terminal log exactly how the Producer notifies the Consumer, and how fake emails pop up via Ethereal when you log in and simulate the events!
