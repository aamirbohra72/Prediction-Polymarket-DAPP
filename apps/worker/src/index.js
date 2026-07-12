import {
  TOPICS,
  isKafkaEnabled,
  getKafkaConfig,
  createConsumer,
} from "@repo/kafka";
import { connectRedis } from "@repo/platform/redis";
import { handleEvent } from "./handlers.js";

async function main() {
  if (!isKafkaEnabled()) {
    console.log("[worker] KAFKA_ENABLED is not true — worker idle (enable Kafka to start consuming)");
    process.exit(0);
  }

  await connectRedis();

  const cfg = getKafkaConfig();
  const consumer = await createConsumer(cfg.groupId);

  const topics = [TOPICS.TRADES, TOPICS.MARKETS];
  await consumer.subscribe({ topics, fromBeginning: false });

  console.log("[worker] Listening on", topics.join(", "));

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const event = JSON.parse(message.value.toString());
        await handleEvent(event);
      } catch (err) {
        console.error("[worker] Handler error:", err.message);
      }
    },
  });
}

main().catch((err) => {
  console.error("[worker] Fatal:", err);
  process.exit(1);
});
