# 📖 Project Explanation & Deep-Dive Mechanism Guide
# Kafka-Enabled E-Learning Platform

This document provides an exhaustive technical explanation of every mechanism used in this project — from HTTP REST flows and JSON persistence, to the full inner workings of Apache Kafka (topics, producers, consumers, brokers, offsets, consumer groups, and KRaft mode).

---

## 📐 Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Technology Stack](#2-technology-stack)
3. [Data Persistence — JSON File Database](#3-data-persistence--json-file-database)
4. [REST API — HTTP Communication](#4-rest-api--http-communication)
5. [Email Notifications — Nodemailer & SMTP](#5-email-notifications--nodemailer--smtp)
6. [⚡ KAFKA — Core Theory (in general)](#6--kafka--core-theory-in-general)
   - 6.1 What is Kafka?
   - 6.2 Topics, Partitions & Offsets
   - 6.3 Producers
   - 6.4 Consumers & Consumer Groups
   - 6.5 Brokers & KRaft Mode
   - 6.6 The Commit Log
7. [⚡ KAFKA — In This Project](#7--kafka--in-this-project)
   - 7.1 The Mapping: Learning Entities → Kafka Primitives
   - 7.2 kafkaAdmin.js — Topic Management
   - 7.3 kafkaProducer.js — Event Publishing
   - 7.4 kafkaConsumer.js — Personalized Student Listeners
   - 7.5 Full Event Flow Diagram
8. [Complete Lifecycle Walkthrough](#8-complete-lifecycle-walkthrough)
9. [File-by-File Breakdown](#9-file-by-file-breakdown)

---

## 1. High-Level Architecture

The system has three independent layers that collaborate through well-defined interfaces:

```
┌─────────────────────────────────────────────────────────────────┐
│                    WEB BROWSER (Frontend)                        │
│   index.html + style.css + app.js  (Vanilla HTML/CSS/JS SPA)   │
│                                                                  │
│   ┌──────────────┐        ┌──────────────────────────────────┐  │
│   │ Auth Screen  │        │ Dashboard (Student / Professor)  │  │
│   │  Login/Reg   │        │  Course cards, Kafka event forms │  │
│   └──────────────┘        └──────────────────────────────────┘  │
│                   HTTP fetch() calls only                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │  HTTP REST (JSON over TCP)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   NODE.JS BACKEND (Express)                      │
│   server.js  ←→  db.js  ←→  db.json                             │
│       │                                                          │
│       ├──── kafkaAdmin.js    (creates topics on Kafka cluster)   │
│       ├──── kafkaProducer.js (publishes events to topics)        │
│       ├──── kafkaConsumer.js (runs listeners per student)        │
│       └──── emailService.js  (sends real emails via SMTP)        │
└──────────────────────────┬──────────────────────────────────────┘
                           │  Kafka binary protocol (TCP :9092)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              APACHE KAFKA  (KRaft Mode — no Zookeeper)           │
│                                                                  │
│   ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│   │  course-1  │  │  course-2  │  │  course-N  │  ← Topics      │
│   │ [Partition]│  │ [Partition]│  │ [Partition]│                │
│   └────────────┘  └────────────┘  └────────────┘                │
│   Broker running on localhost:9092 (single-node cluster)         │
└─────────────────────────────────────────────────────────────────┘
```

> **Key principle:** The Frontend never talks to Kafka. Only the Node.js backend holds Kafka connections. This is fundamental to the whole architecture.

---

## 2. Technology Stack

| Layer | Technology | Role |
|---|---|---|
| Frontend | HTML5 + Vanilla CSS + JS | UI, DOM manipulation, fetch API |
| Backend | Node.js + Express.js | REST API server, Kafka orchestrator |
| Kafka Client | KafkaJS (npm) | JS library for Kafka protocol |
| Kafka Server | Apache Kafka 3.x (KRaft) | Event broker, topic storage |
| Email | Nodemailer + Gmail SMTP | Sends real email notifications |
| Persistence | JSON flat file (`db.json`) | In-process database replacement |
| Environment | dotenv (`.env`) | Secure credential injection |

---

## 3. Data Persistence — JSON File Database

> **File:** `backend/db.js` + `backend/db.json`

Instead of a full SQL/NoSQL database, this project persists data to a `db.json` file on disk. The `db.js` module acts as a minimal ORM-like abstraction.

### How it works:

```
Server starts
     │
     ▼
db.js: load()
     │
     ├─── Does db.json exist?
     │        │
     │       YES ──→ Read file → JSON.parse() → return data object
     │        │
     │        NO ──→ Use DEFAULT_DATA (seed users + courses)
     │               → save() → write to disk → return data
     │
     ▼
db object is exported
     │
     ▼
server.js binds to global.*:
  global.users       = db.users
  global.courses     = db.courses
  global.enrollments = db.enrollments
     │
     ▼
On any mutation (register, enroll, createCourse, updateCourse):
  → Modify global.* array in memory
  → Call save(db) immediately
  → fs.writeFileSync() → db.json updated atomically
```

**Default seed data** (what you get on first run):

```json
{
  "users": [
    { "id": 1, "name": "Alice",    "role": "student",   "email": "alice@student.com" },
    { "id": 2, "name": "Bob",      "role": "student",   "email": "bob@student.com" },
    { "id": 3, "name": "Dr. Smith","role": "professor", "email": "smith@univ.edu" }
  ],
  "courses": [
    { "id": 1, "title": "Introduction to Node.js", "description": "Learn basics" },
    { "id": 2, "title": "React for Beginners",     "description": "Start building UIs" }
  ],
  "enrollments": { "1": [1, 2], "2": [1] }
}
```

**IDs are generated safely:**
```js
const maxId = global.users.reduce((max, u) => Math.max(max, u.id), 0);
const newUser = { id: maxId + 1, ... };
```
This prevents collisions even after restarts with pre-seeded data.

---

## 4. REST API — HTTP Communication

> **File:** `backend/server.js`

The Express server exposes these endpoints:

```
GET    /api/users                    → Return all users
POST   /api/users/register           → Create user → if student, spin up Kafka consumer
POST   /api/users/login              → Authenticate → if student, refresh Kafka consumer
GET    /api/courses                  → Return all courses
POST   /api/courses                  → Create course → createKafkaTopic('course-N')
PUT    /api/courses/:id              → Update course → produceMessage('course-N', {...})
POST   /api/courses/enroll           → Enroll student → direct email + re-subscribe consumer
GET    /api/enrollments/:userId      → Return enrolled courses for a student
```

**Frontend ↔ Backend flow (example: student enrolls):**

```
Browser (app.js)
    │
    │  POST /api/courses/enroll
    │  Body: { userId: 5, courseId: 2 }
    ▼
server.js handler:
    1. Check if already enrolled → if yes, return early
    2. Push userId into global.enrollments[courseId]
    3. save(db) → persist to db.json
    4. sendEmailNotification() → direct confirmation email
    5. createOrUpdateStudentConsumer(student) → refresh Kafka listener
    │
    ▼
res.json({ message: 'Enrolled successfully' })
    │
    ▼
Browser receives 200 OK → showToast() → re-render course cards
```

CORS is enabled for all origins so the static `index.html` file (opened directly as `file://`) can call `localhost:3000` without browser security rejections.

---

## 5. Email Notifications — Nodemailer & SMTP

> **File:** `backend/emailService.js`

```
sendEmailNotification(to, subject, text)
         │
         ├─── Check process.env.EMAIL_USER and EMAIL_PASS
         │         If missing → log warning, return early
         │
         ▼
    nodemailer.createTransport({
        service: 'gmail',
        auth: { user: EMAIL_USER, pass: EMAIL_PASS }
    })
         │
         ▼
    transporter.sendMail({
        from: "Kafka E-Learning <EMAIL_USER>",
        to:   student's real email,
        subject: ...,
        text: ...
    })
         │
         ▼
    Gmail SMTP servers → deliver to student's inbox
```

**`.env` credentials:**
```
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx   ← Google App Password (not your real password)
```

This is invoked in **two different contexts:**
1. **Directly** from `server.js` → upon enrollment (immediate confirmation email, bypasses Kafka).
2. **From inside** `kafkaConsumer.js` → when a Kafka event is received (reacts to course updates).

---

---

## 6. ⚡ KAFKA — Core Theory (in general)

### 6.1 What is Kafka?

Apache Kafka is a **distributed event streaming platform**. It is designed to reliably move large volumes of data between systems in real-time through a **persistent, ordered, immutable log**.

Think of it as a **post office with permanent mailboxes**:
- Messages dropped in are never destroyed immediately
- Multiple people can read the same message independently
- New readers can read from the very beginning or from "now"

```
Traditional Request/Response (REST):
  Service A  ──────────────────→  Service B
             (waits for response)
             ←────────────────── 
  (tightly coupled, synchronous)

Kafka Event-Driven:
  Service A  ──→  [Kafka Topic]  ──→  Service B
  (fire and forget, async)       ──→  Service C
  (loosely coupled)              ──→  Service D
```

---

### 6.2 Topics, Partitions & Offsets

A **Topic** is the primary organizational unit in Kafka — a named, append-only log of events.

A topic is divided into one or more **Partitions** for scalability. Each message within a partition gets an **Offset** — an integer that uniquely and permanently identifies its position.

```
Topic: "course-1"
┌──────────────────────────────────────────────────────────────────┐
│                        Partition 0                               │
│  ┌────────┬────────┬────────┬────────┬────────┬──────────────── │
│  │ off: 0 │ off: 1 │ off: 2 │ off: 3 │ off: 4 │  ← new msgs    │
│  │ {msg1} │ {msg2} │ {msg3} │ {msg4} │ {msg5} │  appended here  │
│  └────────┴────────┴────────┴────────┴────────┴──────────────── │
│                                                WRITE END ──────→ │
└──────────────────────────────────────────────────────────────────┘

Key properties:
  • Messages are IMMUTABLE once written
  • Each offset is UNIQUE per partition
  • Ordering is GUARANTEED within a single partition
  • Old messages are retained for a configurable time (default: 7 days)
```

In this project, each course gets **1 partition** (`numPartitions: 1`), so all events are perfectly ordered.

---

### 6.3 Producers

A **Producer** is any client that writes (publishes) messages to a Kafka topic. It connects to the broker, specifies the topic name, and sends a payload.

```
Producer Flow:
┌──────────────┐
│   Producer   │
│  (our app)   │
│              │
│ .connect()   │──────────────────────────────────────────┐
│ .send({      │                                          │
│   topic,     │        TCP :9092                         ▼
│   messages   │   ──────────────→   ┌──────────────────────────┐
│ })           │                     │     KAFKA BROKER          │
│ .disconnect()│   ←──────────────   │  Appends msg to topic log │
└──────────────┘   (ack returned)    └──────────────────────────┘
```

The producer in this project connects, sends, then **disconnects** immediately (fire-and-forget pattern, not a persistent connection). This is intentional since messages are rare (only on course updates).

---

### 6.4 Consumers & Consumer Groups

A **Consumer** is any client that reads (subscribes to) messages from a Kafka topic. It continuously polls the broker asking "any new messages since my last offset?"

```
Consumer Flow:

  ┌──────────────────────────────────┐
  │         KAFKA BROKER             │
  │                                  │
  │  Topic "course-1" Partition 0:   │
  │  [msg0][msg1][msg2][msg3][msg4]  │
  └───────────────┬──────────────────┘
                  │ poll (every ~100ms)
                  ▼
  ┌──────────────────────────────────┐
  │         Consumer                 │
  │   groupId: "student-5"           │
  │   lastOffset: 2                  │──→  receives [msg3], [msg4]
  │   (internal state via groupId)   │     then sends email for each
  └──────────────────────────────────┘
```

**Consumer Group** is a crucial Kafka concept:
- Every consumer belongs to a group identified by `groupId`
- Kafka tracks how far each group has read (the **committed offset**)
- If a consumer disconnects and reconnects, it resumes from where it left off

```
Without Consumer Groups:
  Consumer A reads msg at offset 5, disconnects.
  Consumer A reconnects → starts from offset 0 again! (re-reads everything)

With Consumer Groups (groupId = "student-5"):
  Consumer A reads msg at offset 5 → Kafka records: group "student-5" is at offset 5
  Consumer A disconnects.
  Consumer A reconnects → Kafka says: "you were at offset 5, here's offset 6" ✅
```

In this project, **each student has their own unique `groupId`**:
```js
const consumer = kafka.consumer({ groupId: `student-${student.id}` });
// e.g., groupId: "student-1", "student-2", "student-5"
```
This ensures:
- Student 1's read progress is tracked independently from Student 2
- If multiple course updates happen while a student is offline, they catch up on reconnect
- No two students "consume" the same message "for each other"

---

### 6.5 Brokers & KRaft Mode

A **Broker** is the Kafka server — the actual process that stores messages and serves producers/consumers.

**KRaft Mode** (Kafka Raft) is the modern way to run Kafka **without ZooKeeper**. Instead, metadata (topic configs, partition assignments, offsets) is stored in a Raft-based internal log managed by Kafka itself.

```
Old architecture (pre-3.x):
  ┌───────────┐     ┌──────────────┐     ┌───────────┐
  │ ZooKeeper │────▶│ Kafka Broker │◀────│  Clients  │
  │  cluster  │     │              │     │ (prod/cons)│
  └───────────┘     └──────────────┘     └───────────┘
  (separate process needed for coordination)

KRaft Mode (this project):
  ┌──────────────────────────────────┐     ┌───────────┐
  │     Kafka Broker (KRaft)         │◀────│  Clients  │
  │  metadata stored internally via  │     │ (kafkajs) │
  │  Raft consensus protocol          │     └───────────┘
  └──────────────────────────────────┘
  (single process, simpler, faster)
```

This project runs a **single-node** KRaft broker on `localhost:9092`. In production, you'd have multiple brokers for replication and fault-tolerance.

---

### 6.6 The Commit Log

Kafka's internals are built around an **append-only commit log**. Every message is written to disk and never modified. This is what makes Kafka:
- **Durable** — data survives crashes
- **Replayable** — consumers can re-read from any offset
- **Fast** — sequential disk writes are extremely efficient

```
            WRITE (Producer)
                  ▼
┌────────────────────────────────────────────────┐
│ Course-1 Partition 0 — Commit Log on Disk      │
├────────────────────────────────────────────────┤
│  [0] { action: "COURSE_UPDATED", title: "..." }│
│  [1] { action: "COURSE_UPDATED", title: "..." }│
│  [2] { action: "COURSE_UPDATED", title: "..." }│  ← Next write goes here
└────────────────────────────────────────────────┘
              ▲               ▲
        Consumer A      Consumer B
        (student-1)     (student-2)
        offset: 2       offset: 1
        (fully caught   (1 message
         up)             behind)
```

---

---

## 7. ⚡ KAFKA — In This Project

### 7.1 The Mapping: Learning Entities → Kafka Primitives

This is the conceptual core of the project — learning domain concepts map 1-to-1 onto Kafka primitives:

```
E-LEARNING CONCEPT          KAFKA PRIMITIVE
─────────────────           ───────────────────────────────────────
A Course        ──────────→ A Topic (named "course-{id}")
A Professor     ──────────→ A Producer (writes update events to topics)
A Student       ──────────→ A Consumer (reads events from enrolled topics)
Enrollment      ──────────→ Topic Subscription (consumer.subscribe({topic}))
Course Update   ──────────→ An Event/Message in a topic
Admin (system)  ──────────→ Kafka Admin Client (creates/manages topics)
```

Visual:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Professor (Dr. Smith)              Kafka Broker                        │
│  ┌─────────────┐                  ┌─────────────────────────────────┐  │
│  │ Updates     │                  │ Topic: course-1                 │  │
│  │ "Node.js"   │── produceMsg ──→ │ [COURSE_UPDATED event] ← append │  │
│  │ course      │                  │                                 │  │
│  └─────────────┘                  │ Topic: course-2                 │  │
│                                   │ [COURSE_UPDATED event] ← append │  │
│                                   └────────────┬────────────────────┘  │
│                                                │ poll                   │
│                             ┌──────────────────┤                        │
│                             ▼                  ▼                        │
│                    Student Alice           Student Bob                  │
│                    groupId: student-1      groupId: student-2           │
│                    subscribed:             subscribed:                   │
│                    - course-1             - course-1                    │
│                    - course-2             (only course 1)               │
│                         │                      │                        │
│                         ▼                      ▼                        │
│                  Gets BOTH emails       Gets email for course-1 only    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 7.2 kafkaAdmin.js — Topic Management

> **File:** `backend/kafkaAdmin.js`

The Admin client has elevated privileges to manage cluster metadata — specifically, creating topics.

```
kafkaAdmin.js — createKafkaTopic(topicName)

┌─────────────────────────────────────────────────────────────┐
│  const kafka = new Kafka({                                   │
│      clientId: 'elearning-admin',                            │
│      brokers: ['localhost:9092']                             │
│  });                                                         │
│  const admin = kafka.admin();                                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                   admin.connect()
                           │
                           ▼
              admin.createTopics({
                  topics: [{
                      topic: "course-3",
                      numPartitions: 1      ← single partition
                  }]
              })
                           │
                           ▼
              Kafka broker creates the log file
              for "course-3" on disk
                           │
                           ▼
                  admin.disconnect()
```

**When is this called?**
1. On every `POST /api/courses` → immediately creates `course-{id}` topic
2. On server startup → loops through ALL existing courses and ensures their topics exist

```js
// server.js startup
app.listen(PORT, async () => {
    for (const course of global.courses) {
        await createKafkaTopic(`course-${course.id}`);  // Idempotent — safe to re-call
    }
});
```

This ensures **topics always exist before any producer or consumer touches them**.

---

### 7.3 kafkaProducer.js — Event Publishing

> **File:** `backend/kafkaProducer.js`

The producer is triggered only when a Professor updates a course.

```
kafkaProducer.js — produceMessage(topic, message)

Professor clicks "Update Course" in UI
          │
          ▼
  PUT /api/courses/:id  (HTTP)
          │
          ▼
  server.js updates db.json
          │
          ▼
  produceMessage('course-3', {
      action: 'COURSE_UPDATED',
      courseId: 3,
      title: 'Advanced Node.js',
      description: 'Updated desc...'
  })
          │
          ▼
  ┌──────────────────────────────────────────┐
  │  producer.connect()                      │
  │  producer.send({                         │
  │      topic: 'course-3',                  │
  │      messages: [                         │
  │          { value: JSON.stringify({...}) } │
  │      ]                                   │
  │  })                                      │
  │  producer.disconnect()                   │
  └─────────────────┬────────────────────────┘
                    │  TCP payload → broker
                    ▼
  Kafka appends message to course-3 Partition 0
  at the next available offset
```

**The message payload** serialized as a JSON string:
```json
{
  "action": "COURSE_UPDATED",
  "courseId": 3,
  "title": "Advanced Node.js",
  "description": "Deep dive into async/await and streams"
}
```

**Important:** The producer does **not know** who will receive this. It simply drops it into the topic. The decoupling is total. This is the publish/subscribe pattern.

---

### 7.4 kafkaConsumer.js — Personalized Student Listeners

> **File:** `backend/kafkaConsumer.js`

This is the most complex and important mechanism. Each student gets their own consumer instance running as a **background async loop** inside the Node.js process.

```
In-memory map:
activeConsumers = {
    1: <Consumer for Alice>,
    2: <Consumer for Bob>,
    5: <Consumer for Donia>
}
```

**createOrUpdateStudentConsumer(student):**

```
Called with student object: { id: 5, name: 'Donia', email: 'donia@enis.tn' }
          │
          ▼
   Is there an existing consumer for student.id?
          │
         YES ──→ consumer.disconnect()  ← stop old listener cleanly
          │
         NO  (or after disconnect)
          │
          ▼
   Create new consumer:
   kafka.consumer({ groupId: `student-${student.id}` })
   // groupId = "student-5"
          │
          ▼
   consumer.connect()
          │
          ▼
   Look up student's enrollments in global.enrollments:
   e.g., { "1": [1,5], "2": [1,5] } → student 5 is in course 1 and 2
          │
          ▼
   enrolledCourseIds = ["1", "2"]
          │
   Is the list empty?
          ├── YES → Log "not enrolled in anything", return early
          └── NO  ↓
          │
          ▼
   Loop: for each courseId in enrolledCourseIds:
       consumer.subscribe({
           topic: `course-1`,
           fromBeginning: false    ← only NEW messages from now on
       })
       consumer.subscribe({
           topic: `course-2`,
           fromBeginning: false
       })
          │
          ▼
   consumer.run({
       eachMessage: async ({ topic, partition, message }) => {
           const event = JSON.parse(message.value.toString());
           // e.g., { action: "COURSE_UPDATED", title: "Node.js", ... }

           const subject = event.action === 'COURSE_UPDATED'
               ? `Course Updated: ${event.title}`
               : `New Course Added: ${event.title}`;

           const text = `Hello Donia,\n The course "${event.title}" was updated...`;

           sendEmailNotification(student.email, subject, text);
       }
   })
   // This run() call is non-blocking — it starts an async polling loop
   // and returns immediately. The callback fires on every message received.
```

**Subscription lifecycle diagram:**

```
SCENARIO: Student Donia logs in → enrolls in Course 2 → Professor updates Course 2

Timeline:
  t=0    Donia logs in → createOrUpdateStudentConsumer(donia)
         Consumer "student-5" created, but NO enrollments yet
         → Early return (not subscribed to anything)

  t=1    Donia enrolls in Course 1 → createOrUpdateStudentConsumer(donia)
         Old consumer disconnected
         New consumer created (groupId: student-5)
         Subscribes to: [course-1]
         consumer.run() starts polling loop ← ACTIVE

  t=2    Donia enrolls in Course 2 → createOrUpdateStudentConsumer(donia)
         Old consumer (course-1) DISCONNECTED
         New consumer created (groupId: student-5)
         Subscribes to: [course-1, course-2]  ← BOTH now
         consumer.run() starts new polling loop ← ACTIVE

  t=3    Professor updates Course 2
         producer.send to topic "course-2"
         Kafka appends message at offset N

  t=4    Donia's consumer.run() polls broker
         Broker sees: group "student-5" requests course-2 offsets > (N-1)
         Broker returns: new message at offset N

  t=5    eachMessage() callback fires
         sendEmailNotification() called
         Donia receives real Gmail notification ✅
```

---

### 7.5 Full Event Flow Diagram

```
                     COMPLETE KAFKA EVENT FLOW
═══════════════════════════════════════════════════════════════════════

[1] Professor Action:
    Browser ──POST /api/courses/{id}──→ server.js

[2] Topic Created (at course creation time, before any update):
    kafkaAdmin.createKafkaTopic("course-2")
    Broker now has: topic "course-2" with 1 partition, 0 messages

[3] Student Subscribes (on enrollment):
    kafkaConsumer.createOrUpdateStudentConsumer(donia)
    Consumer "student-5" subscribes to topic "course-2"
    ┌─────────────────────────────────────────┐
    │  course-2 Partition 0: [ empty ]        │
    │                          ▲              │
    │              Consumer student-5 polls   │
    │              (waiting for messages...)  │
    └─────────────────────────────────────────┘

[4] Professor Updates Course:
    PUT /api/courses/2 → server.js → produceMessage("course-2", event)
    ┌─────────────────────────────────────────┐
    │  course-2 Partition 0: [ msg@offset=0 ] │ ← NEW
    │                          ▲              │
    │              Consumer student-5 polls   │
    └─────────────────────────────────────────┘

[5] Consumer Receives Message:
    eachMessage({ topic: "course-2", message: {value: "...json..."} })
    → JSON.parse(message.value)
    → { action: "COURSE_UPDATED", title: "React for Beginners", ... }

[6] Email Dispatched:
    sendEmailNotification(
        "donia@enis.tn",
        "Course Updated: React for Beginners",
        "Hello Donia, the course has been updated..."
    )
    → Nodemailer → Gmail SMTP → inbox ✅

═══════════════════════════════════════════════════════════════════════
```

---

## 8. Complete Lifecycle Walkthrough

Here is a full trace from startup to email delivery:

```
STEP 1 — Server starts
  node server.js
    │
    ├── db.js: load() reads db.json → seeds global.courses, global.users
    ├── kafkaAdmin: createKafkaTopic("course-1") → ensures topic exists
    └── kafkaAdmin: createKafkaTopic("course-2") → ensures topic exists

STEP 2 — Professor Logs In
  POST /api/users/login { email: "smith@univ.edu" }
    │
    └── Returns user obj { id:3, role:"professor" }
        No Kafka action (professors don't get consumers)

STEP 3 — Professor Creates New Course
  POST /api/courses { title: "Docker & DevOps", description: "..." }
    │
    ├── Creates course { id:3 } in memory + db.json
    └── kafkaAdmin.createKafkaTopic("course-3")
        Kafka cluster now has: course-1, course-2, course-3

STEP 4 — Student Registers
  POST /api/users/register { name:"Donia", email:"donia@enis.tn", role:"student" }
    │
    ├── Creates user { id:5 } in db.json
    └── createOrUpdateStudentConsumer({ id:5, name:"Donia", email:"donia@enis.tn" })
        └── No enrollments yet → logs "not enrolled, passing" → no subscriptions

STEP 5 — Student Enrolls in Course 3
  POST /api/courses/enroll { userId:5, courseId:3 }
    │
    ├── Adds 5 to enrollments["3"] in db.json
    ├── sendEmailNotification(donia.email, "Enrollment Confirmed: Docker...")
    │   └── Direct email (no Kafka) → Donia gets immediate confirmation
    └── createOrUpdateStudentConsumer(donia)
        ├── Disconnects previous consumer (empty one from Step 4)
        ├── New consumer with groupId: "student-5"
        ├── consumer.subscribe({ topic: "course-3", fromBeginning: false })
        └── consumer.run() → background polling loop ACTIVE ✅

STEP 6 — Professor Updates Course 3
  PUT /api/courses/3 { title: "Docker & DevOps v2", description: "updated..." }
    │
    ├── Updates db.json
    └── produceMessage("course-3", {
            action: "COURSE_UPDATED",
            courseId: 3,
            title: "Docker & DevOps v2",
            description: "updated..."
        })
        └── Kafka appends to course-3 Partition 0 at offset 0

STEP 7 — Consumer Fires
  student-5 consumer polls broker
    └── Receives message at offset 0
        └── eachMessage({...})
            ├── Parse JSON event
            ├── Build subject: "Course Updated: Docker & DevOps v2"
            ├── Build text: "Hello Donia, the course has been updated..."
            └── sendEmailNotification("donia@enis.tn", subject, text)
                └── Gmail SMTP → Donia's inbox  ✅  NOTIFICATION DELIVERED
```

---

## 9. File-by-File Breakdown

| File | Purpose | Kafka Role |
|---|---|---|
| `frontend/index.html` | UI skeleton — forms, dashboards | None |
| `frontend/style.css` | Glassmorphism design system | None |
| `frontend/app.js` | SPA logic — fetch calls, DOM rendering | None (HTTP only) |
| `backend/server.js` | Express API, orchestrates all layers | Coordinator — calls admin/producer/consumer |
| `backend/db.js` | JSON persistence layer — load/save | None |
| `backend/db.json` | Flat-file database on disk | None |
| `backend/kafkaAdmin.js` | Creates Kafka topics on cluster | **Admin Client** |
| `backend/kafkaProducer.js` | Publishes events (course updates) to topics | **Producer** |
| `backend/kafkaConsumer.js` | Runs background per-student listener loops | **Consumer** |
| `backend/emailService.js` | Sends real Gmail emails via SMTP | None (triggered by consumer) |
| `backend/.env` | Secure Gmail credentials | None |
| `kafka/` | Kafka binary installation (KRaft mode) | **The Broker itself** |

---

> **Summary:** The magic of this project is the **complete bijection** between the learning domain and Kafka primitives. Courses live as Topics. Professors produce events. Students consume them. The Node.js backend is the glue that bridges the HTTP world of the browser with the TCP world of Kafka — and Nodemailer is the final-mile delivery into a real human inbox.
