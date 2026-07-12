export function getKafkaConfig() {
  const enabled = process.env.KAFKA_ENABLED === "true";
  const brokers = (process.env.KAFKA_BROKERS || "127.0.0.1:9092")
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);

  return {
    enabled,
    brokers,
    clientId: process.env.KAFKA_CLIENT_ID || "stockpredict",
    groupId: process.env.KAFKA_GROUP_ID || "stockpredict-worker",
  };
}

export function isKafkaEnabled() {
  return getKafkaConfig().enabled;
}
