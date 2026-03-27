# Kafka E-Learning Platform

Welcome to the Kafka E-Learning Platform! This project demonstrates an event-driven web application where Professors can create and update courses, and Students can enroll in them. When a course is updated or created, a background Kafka process reads these events and dispatches an email notification to the enrolled students.

## Architecture & Mechanisms Used

### 1. Frontend (HTML, CSS, JavaScript)
The frontend is a lightweight Single Page Application (SPA) utilizing Vanilla JavaScript and modern CSS (Glassmorphism design).
- **Student Profile**: Can browse available courses and click "Enroll". 
- **Professor Profile**: Can add new courses or update existing ones seamlessly. 
- *Mechanism*: The frontend communicates with the backend purely via REST API calls (`fetch`), avoiding heavy page reloads.

### 2. Backend (Node.js & Express)
A lightweight Express server handles HTTP requests.
- **In-Memory Database**: For simplicity, Users and Courses are stored in arrays instead of a Postgres/MongoDB database. 
- **Roles**: 
  - When a **Student** enrolls in a course, their User ID is tied to the Course ID in the `global.enrollments` map.
  - When a **Professor** adds or updates a course, the changes are stored, and importantly, an event is sent to the Kafka server!

### 3. Kafka Server (The Backbone)
Apache Kafka acts as a distributed event streaming platform. 
In this project, it decouples the *action* (updating a course) from the *reaction* (sending an email).
- **Producer (`backend/kafkaProducer.js`)**: When the Professor triggers a course creation or update, the Express API tells the Publisher to send a message payload to the `course-notifications` topic.
- **Consumer (`backend/kafkaConsumer.js`)**: A separate standalone asynchronous loop that constantly listens to the `course-notifications` topic. The moment an event arrives, the consumer parses the message, identifies which students are enrolled in that specific course, and triggers the `emailService.js`.

### 4. Email Service (`backend/emailService.js`)
Uses `nodemailer` with an `ethereal.email` mock transport. This realistically simulates sending emails over SMPT without accidentally spamming real inboxes during development.

---

## 🚀 How To Make It Work (Step-by-Step)

### Prerequisites
1. **Node.js** installed on your Windows machine.
2. **Apache Kafka** binaries downloaded (e.g., `kafka_2.13-3.x.x.tgz`) and extracted on your machine (e.g., to `C:\kafka`).

### Step 1: Start Kafka Server Locally (KRaft Mode)
Recent versions of Kafka use KRaft to manage the cluster without needing Zookeeper. Open a **command prompt window** and navigate to your extracted Kafka folder within this project (e.g., `cd path\to\KafkaWeb\kafka`).

**Generate a Cluster ID & Format Storage:**
```bash
.\bin\windows\kafka-storage.bat random-uuid
```
Copy the generated UUID from the output and use it in the next command to format your storage directory:
```bash
.\bin\windows\kafka-storage.bat format -t <YOUR_UUID_HERE> -c .\config\kraft\server.properties
```

**Start Kafka Server:**
Now run the server using the KRaft configuration:
```bash
.\bin\windows\kafka-server-start.bat .\config\kraft\server.properties
```
*Leave this terminal running in the background.*

### Step 2: Set Up and Run the Backend
Open a **third terminal window**, navigate to the `backend` folder of this project, and run:
```bash
cd path\to\KafkaWeb\backend
npm install
node server.js
```
*You should see a message saying:*
`Server is running on port 3000`
*(The Kafka consumer connects automatically immediately after).*

### Step 3: Launch the Frontend
1. Open the file `KafkaWeb/frontend/index.html` directly in any modern Web Browser (Chrome, Firefox, Edge).
2. The vibrant interface will load!

### Step 4: Testing the Flow
1. **Register as a Professor**: Click "Don't have an account? Register". Create an account with your email and select the "Professor" role.
2. **Add a Course**: Fill out the title (e.g., "Advanced Kafka") and description. Click "Create Course". 
   - *Look at your Backend Terminal*: You'll see a log saying `Produced event to topic course-notifications`!
3. **Log out** (using the top right button) and **Register a new account as a Student** with a different email.
4. **Enroll in the Topic/Course**: You will see the new course appear. Click **Enroll**.
5. **Log out** and **Log back in using your Professor email**.
6. **Update Course**: Select the course from the dropdown, add a new title/description, and click "Update Course".
7. **Check the Magic in the Terminal**: Look at your backend terminal. It will log that the Kafka Consumer received the event, found your Student account's email, and sent a mock Email via Ethereal to the exact email address you registered with! It outputs a URL like `Preview URL: https://ethereal.email/message/...`. Click that link to visually see the exact email sent!

You've now successfully utilized an asynchronous event-driven architecture using Apache Kafka!
