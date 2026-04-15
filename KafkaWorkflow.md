# Detailed Kafka Workflow: Course Lifecycle

This document explains the technical flow of events within the Kafka E-Learning platform, from the moment a course is created to when a student receives a notification.

## Architecture Overview
The system follows a **per-course topic pattern**. Each course has its own dedicated Kafka topic, ensuring that students only receive events for courses they are enrolled in.

---

## 1. Course Creation (Topic Provisioning)
When a Professor creates a new course:

1.  **API Call**: `POST /api/courses` is triggered with the title and description.
2.  **Database Persistence**: The new course is assigned a unique ID and saved to `db.json`.
3.  **Kafka Admin Action**: 
    *   The backend calls `createKafkaTopic("course-<ID>")`.
    *   **Topic Configuration**: 
        *   **Name**: `course-<ID>` (e.g., `course-1`).
        *   **Partitions**: 1 (Single partition ensures strict ordering of updates).
        *   **Replication Factor**: 1 (Standard for local single-broker development).
4.  **Result**: A new communication channel is now live in the Kafka cluster for this specific course.

---

## 2. Student Enrollment (Consumer Subscription)
When a Student clicks "Enroll":

1.  **API Call**: `POST /api/courses/enroll`.
2.  **Logical Binding**: The student's ID is added to the enrollment list for that course in `db.json`.
3.  **Consumer Lifecycle**:
    *   **Instantiation**: The backend creates or refreshes a Kafka consumer instance for that specific student.
    *   **Group ID**: `student-<ID>` (e.g., `student-5`). This ensures that if the student has multiple sessions, they act as a single logical consumer.
    *   **Subscription**: The consumer dynamically subscribes to every topic matching the student's enrollments:
        ```javascript
        await consumer.subscribe({ topic: "course-1", fromBeginning: false });
        ```
    *   **Offset Management**: `fromBeginning: false` ensures the student only gets *new* updates from the moment they enroll, not the entire history of the course.

---

## 3. Course or Lesson Update (Event Production)
When a Professor updates a course or pushes a new lesson:

1.  **API Call**: `PUT /api/courses/:id` or `PUT /api/courses/:id/lesson`.
2.  **State Change**: The backend updates the record in `db.json`.
3.  **Producer Dispatch**:
    *   The `kafkaProducer.js` connects to the broker.
    *   **Message Payload**: A JSON object containing the action type and update details:
        ```json
        {
          "action": "LESSON_UPDATED",
          "courseId": 1,
          "title": "Mastering Kafka Producers",
          "lessonTitle": "05 - Idempotent Producers"
        }
        ```
    *   **Topic Targeting**: The message is sent specifically to the `course-1` topic.

---

## 4. Real-time Notification (Event Consumption)
This is where the asynchronous magic happens:

1.  **Polling**: The Student's consumer (running in the background of the backend server) is constantly polling Kafka for new messages.
2.  **Event Arrival**: The moment the message hits the `course-1` partition, Kafka pushes it to all active consumers subscribed to that topic.
3.  **Processing**:
    *   The `eachMessage` handler in `kafkaConsumer.js` intercepts the payload.
    *   It parses the JSON and identifies the `action` (`COURSE_UPDATED` or `LESSON_UPDATED`).
4.  **Reaction**:
    *   The logic formats a user-friendly email body based on the event data.
    *   **Email Dispatch**: The `emailService.js` is called to send the notification to the student's registered email address.

---

## Technical Summary Table

| Step | Component | Interaction | Detail |
| :--- | :--- | :--- | :--- |
| **Create** | Admin UI -> Backend | Topic Creation | `course-<ID>` created with 1 partition. |
| **Enroll** | Student UI -> Consumer | Subscription | Consumer group `student-<ID>` joins the topic. |
| **Update** | Professor UI -> Producer | Message Send | Event payload serialized to JSON and sent to partition. |
| **Notify** | Consumer -> Email Service | Consumption | Message parsed; Email triggered to enrolled students. |
