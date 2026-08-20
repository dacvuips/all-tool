import config from "config";
import mongoose from "mongoose";
import logger from "./logger";

const mongoUri = config.get<string>("mongo.main");

const mongoOptions: mongoose.ConnectOptions = {
  socketTimeoutMS: 360000,
  connectTimeoutMS: 20000,
  serverSelectionTimeoutMS: 30000,
  heartbeatFrequencyMS: 10000,
  autoCreate: true,
  autoIndex: true,
  readPreference: "primaryPreferred",
};

const connect = mongoose.createConnection(mongoUri, mongoOptions);

function isTransientMongoError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message || err || "");
  const code = String((err as { code?: string })?.code || "");
  return /ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|ENETUNREACH|EAI_AGAIN|MongoNetworkError|MongoServerSelectionError|timed out/i.test(
    `${code} ${msg}`
  );
}

connect.on("error", (err) => {
  if (isTransientMongoError(err)) {
    logger.warn(`Mongo connection error (will retry): ${err.message}`);
    return;
  }
  logger.error("Mongo Database Connection Error " + err.message);
});

connect.on("disconnected", () => {
  logger.warn("Main database disconnected");
});

connect.on("reconnected", () => {
  logger.info("Main database reconnected");
});

connect.on("connected", () => {
  logger.info("Main database connected!");
});

export const MainConnection = connect;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let readyWaiter: Promise<void> | null = null;

async function connectWithRetry(): Promise<void> {
  let attempt = 0;
  while (MainConnection.readyState !== 1) {
    try {
      if (MainConnection.readyState === 0) {
        await MainConnection.openUri(mongoUri, mongoOptions);
      } else {
        await MainConnection.asPromise();
      }
      return;
    } catch (err: any) {
      attempt++;
      const delayMs = Math.min(1000 * 2 ** Math.min(attempt, 4), 15000);
      logger.warn(
        `Mongo chưa sẵn sàng (lần ${attempt}) — thử lại sau ${delayMs}ms: ${err?.message || err}`
      );
      await sleep(delayMs);
    }
  }
}

export async function waitForMainConnection(): Promise<void> {
  if (MainConnection.readyState === 1) return;
  if (!readyWaiter) {
    readyWaiter = connectWithRetry().finally(() => {
      readyWaiter = null;
    });
  }
  await readyWaiter;
}

export function startSession() {
  return MainConnection.startSession({ defaultTransactionOptions: { readPreference: "primary" } });
}

// mongoose.set("debug", (collectionName, method, query, doc) => {
//   console.log(`${collectionName}.${method}`, JSON.stringify(query), doc);
// });
