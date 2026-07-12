import { Kafka, logLevel } from "kafkajs";
import { getKafkaConfig, isKafkaEnabled } from "./config.js";

let kafka = null;
let producer = null;
let producerConnected = false;

export function getKafka() {
  if (!isKafkaEnabled()) return null;
  if (!kafka) {
    const cfg = getKafkaConfig();
    kafka = new Kafka({
      clientId: cfg.clientId,
      brokers: cfg.brokers,
      logLevel: logLevel.WARN,
      retry: { initialRetryTime: 300, retries: 5 },
    });
  }
  return kafka;
}

export async function connectProducer() {
  if (!isKafkaEnabled()) return false;
  try {
    const k = getKafka();
    if (!k) return false;
    producer = k.producer();
    await producer.connect();
    producerConnected = true;
    console.log("[kafka] Producer connected");
    return true;
  } catch (err) {
    producerConnected = false;
    console.warn("[kafka] Producer unavailable:", err.message);
    return false;
  }
}

export function isProducerReady() {
  return producerConnected && producer != null;
}

export async function publishMessage(topic, message) {
  if (!isProducerReady()) return false;
  const payload = {
    ...message,
    emittedAt: message.emittedAt || new Date().toISOString(),
  };
  await producer.send({
    topic,
    messages: [
      {
        key: message.key || null,
        value: JSON.stringify(payload),
      },
    ],
  });
  return true;
}

export async function disconnectProducer() {
  if (producer) {
    await producer.disconnect().catch(() => {});
    producer = null;
    producerConnected = false;
  }
}

export async function createConsumer(groupId) {
  const k = getKafka();
  if (!k) return null;
  const consumer = k.consumer({ groupId });
  await consumer.connect();
  return consumer;
}
