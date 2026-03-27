const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'elearning-admin',
  brokers: ['localhost:9092']
});

const admin = kafka.admin();

const createKafkaTopic = async (topicName) => {
    try {
        await admin.connect();
        await admin.createTopics({
            topics: [{
                topic: topicName,
                numPartitions: 1
            }],
        });
        console.log(`[Kafka Admin] Created topic successfully: ${topicName}`);
        await admin.disconnect();
    } catch (err) {
        console.error(`[Kafka Admin] Error creating topic ${topicName}:`, err);
    }
};

module.exports = { createKafkaTopic };
