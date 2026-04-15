const { Kafka } = require('kafkajs');
const { sendEmailNotification } = require('./emailService');

const kafka = new Kafka({
  clientId: 'elearning-consumer',
  brokers: ['localhost:9092']
});

// Map of studentId -> Consumer instance
const activeConsumers = {};

const createOrUpdateStudentConsumer = async (student) => {
    try {
        if (activeConsumers[student.id]) {
            await activeConsumers[student.id].disconnect();
        }

        const consumer = kafka.consumer({ groupId: `student-${student.id}` });
        activeConsumers[student.id] = consumer;
        await consumer.connect();

        const enrolledCourseIds = Object.keys(global.enrollments).filter(cId => 
            global.enrollments[cId].includes(student.id)
        );

        if (enrolledCourseIds.length === 0) {
            console.log(`[Kafka Consumer] Student ${student.name} is not enrolled in any courses. Passing.`);
            return;
        }

        console.log(`[Kafka Consumer] Student ${student.name} subscribing to:`, enrolledCourseIds.map(id => `course-${id}`));

        // Subscribe to all enrolled topics
        for (const cId of enrolledCourseIds) {
            await consumer.subscribe({ 
                topic: `course-${cId}`, 
                fromBeginning: false 
            });
        }

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const event = JSON.parse(message.value.toString());
                console.log(`[Kafka Consumer - ${student.name} | Topic: ${topic}] Received event:`, event);

                let subject, text;

                if (event.action === 'LESSON_UPDATED') {
                    subject = `🔔 New Lesson: ${event.lessonTitle}`;
                    text = `Hello ${student.name},\n\nThe course "${event.title}" has a new lesson: "${event.lessonTitle}".\n\nLog in to see the new content!\n\nHappy Learning!`;
                } else {
                    subject = event.action === 'COURSE_UPDATED' 
                        ? `📚 Course Updated: ${event.title}` 
                        : `✨ New Course Available: ${event.title}`;
                        
                    text = `Hello ${student.name},\n\nThe course "${event.title}" has been ${event.action === 'COURSE_UPDATED' ? 'updated' : 'added to the catalog'}.\nDescription: ${event.description}\n\nHappy Learning!`;
                }
                
                sendEmailNotification(student.email, subject, text);
            },
        });
    } catch (err) {
        console.error(`Error in StudentConsumer for ${student.name}:`, err);
    }
};

module.exports = { createOrUpdateStudentConsumer };
