import config from "config";
import Redis, { Cluster } from "ioredis";
import { t } from "./functions/string";

const redisConfig = config.get<any>("redis");

export const createRedisClient = () => {
  let redis: Redis | Cluster;

  switch (redisConfig.backend) {
    case "cluster": {
      const nodes = getRedisNodes();
      console.log("Creating redis cluster client", nodes, redisConfig.password);
      redis = new Cluster(nodes, {
        lazyConnect: true,
        redisOptions: {
          password: redisConfig.password,
        },
      });
      break;
    }

    case "sentinel": {
      const nodes = getRedisNodes();
      console.log("Creating redis sentinel client", nodes);
      const masterName = redisConfig.sentinel.master;
      redis = new Redis({
        sentinels: nodes,
        name: masterName,
        keyPrefix: redisConfig.prefix,
        password: redisConfig.password,
        lazyConnect: true,
        sentinelUsername: redisConfig.sentinel.username,
        sentinelPassword: redisConfig.sentinel.password,
      });
      break;
    }

    case "single":
    default:
      console.log("Creating redis single client");
      redis = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        keyPrefix: redisConfig.prefix,
        lazyConnect: true,
        // config retry strategy
        retryStrategy: (times) => {
          if (times > 10) {
            return undefined;
          }
          return Math.min(times * 50, 2000);
        },
      });
  }

  redis.on("connect", () => {
    console.log("Redis connected");
  });
  redis.on("ready", () => {
    console.log("Redis ready");
  });
  redis.on("error", (err) => {
    console.error("Redis error", err.message);
  });
  redis.on("close", () => {
    console.log("Redis closed");
  });
  redis.on("reconnecting", () => {
    console.log("Redis reconnecting");
  });
  redis.on("end", () => {
    console.log("Redis end");
  });

  if (redisConfig.backend == "sentinel") {
    redis.on("sentinelError", (err) => {
      console.error("Redis sentinel error", err.message);
    });
  }
  return redis;
};

const getRedisNodes = () => {
  const configNodes = config.get<string>("redis.nodes");
  if (configNodes.length == 0) {
    throw new Error(t("Chưa config redis nodes"));
  }
  const nodes = configNodes
    .split(",")
    .map((path) => new URL("redis://" + path))
    .map((url) => ({
      host: url.hostname,
      port: Number(url.port == "" ? "80" : url.port),
    }));
  return nodes;
};

const redis = createRedisClient();

export const PrefixKey = redisConfig.prefix;

export default redis;
