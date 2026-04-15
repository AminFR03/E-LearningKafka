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

## 🚀 How To Run The Project (Step-by-Step)

To see the event-driven notifications in action, you need three main components running simultaneously: **Kafka**, the **Node.js Backend**, and the **Web Frontend**.

### Prerequisites
1. **Node.js**: Installed on your machine.
2. **Apache Kafka**: Downloaded and extracted (e.g., to `C:\kafka`).

---

### Step 1: Start Apache Kafka (KRaft Mode)
Open a **Terminal window** and navigate to your Kafka installation directory (e.g., `cd path\to\KafkaWeb\kafka`).

1. **Generate a Cluster ID**:
   Run this command and **copy the unique ID** it outputs (e.g., `kYQe2SU...`):
   ```powershell
   .\bin\windows\kafka-storage.bat random-uuid
   ```

2. **Format the Storage Directory**:
   Run this command, replacing `<YOUR_CLUSTER_ID>` with the ID you just copied:
   ```powershell
   .\bin\windows\kafka-storage.bat format -t <YOUR_CLUSTER_ID> -c .\config\kraft\server.properties
   ```
2. **Start Server**:
   ```powershell
   .\bin\windows\kafka-server-start.bat .\config\kraft\server.properties
   ```
   *Keep this window open.*

---

### Step 2: Start the Backend Server
Open a **Second Terminal window**, navigate to the `backend` folder, and run:
```powershell
cd backend
npm install
node server.js
```
*Note: The server will automatically connect to Kafka and bootstrap consumers for existing students.*

---

### Step 3: Open the Web Frontend
1. Locate `frontend/index.html`.
2. Right-click and **Open with Browser** (Chrome or Edge recommended).

---

### 🧪 Testing the Notification Flow

1. **Log in as Professor**:
   - Use: `amin.frikha03@gmail.com`
   - You will see the **Professor Dashboard**.
2. **Setup a Student**:
   - Log out and register/login as a student (e.g., `donia.bahloul@enis.tn`).
   - Find a course in **Browse Courses** and click **Enroll**.
3. **Trigger a Notification**:
   - Log back in as **Amin**.
   - Go to **Authoring Studio**.
   - **Scenario A (Course Update)**: Use "Issue Course Update" to change the description.
   - **Scenario B (Lesson Update)**: Use the new "Push Lesson Update" form to add a lesson title (e.g. "Kafka Streams 101").
4. **Verifying Result**:
   - Watch the **Backend Terminal**. You will see:
     - `[Update] Dispatching ... event`
     - `[Email] ✅ Success! To: donia.bahloul@enis.tn ...`
   - If Donia is logged in, you will also see the Kafka Consumer log the received event in real-time.

---

### Troubleshooting
- **Kafka Connection Error**: Ensure Step 1 is completed and the terminal shows no errors. The backend assumes Kafka is at `localhost:9092`.
- **Email Not Received**: Check the `.env` file in the `backend` folder. It should contain valid `EMAIL_USER` and `EMAIL_PASS` (e.g., a Gmail App Password).
