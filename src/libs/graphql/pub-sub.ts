// import { PubSub } from "apollo-server-express";
import { RedisPubSub } from "graphql-redis-subscriptions";
import redis from "../../helpers/redis";

export const pubsub = new RedisPubSub({
  publisher: redis,
  subscriber: redis.duplicate(),
});

// export const pubsub = new PubSub();
