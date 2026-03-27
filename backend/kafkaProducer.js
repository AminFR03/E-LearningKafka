const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'elearning-producer',
  // Assumes a native local Kafka install listening on standard port
  brokers: ['localhost:9092']
});

const producer = kafka.producer();

const produceMessage = async (topic, message) => {
  try {
    await producer.connect();
    await producer.send({
      topic: topic,
      messages: [
        { value: JSON.stringify(message) },
      ],
    });
    console.log(`Produced event to topic ${topic}:`, message);
    await producer.disconnect();
  } catch (err) {
    console.error(`Error producing message:`, err);
  }
};

module.exports = { produceMessage };
