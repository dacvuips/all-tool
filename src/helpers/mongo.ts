import config from "config";
import mongoose from "mongoose";
import logger from "./logger";

const connect = mongoose.createConnection(config.get("mongo.main"), {
  // useNewUrlParser: true,
  socketTimeoutMS: 360000,
  connectTimeoutMS: 360000,
  keepAlive: true,
  // useFindAndModify: false,
  autoCreate: true,
  autoIndex: true,
  // useUnifiedTopology: true,
  readPreference: "primaryPreferred",
});

connect.on("connect", () => {
  logger.info("Database connected");
});

connect.on("error", (err) => {
  logger.error("Mongo Database Connection Error " + err.message);
  process.exit(0);
});

export const MainConnection = connect;

export function startSession() {
  return MainConnection.startSession({ defaultTransactionOptions: { readPreference: "primary" } });
}

// handle database connection error
MainConnection.on("error", (err) => {
  logger.error(`Main database connection error:`, err);
  process.exit(1);
});

// handle database connection success
MainConnection.on("connected", () => {
  logger.info("Main database connected!");
});

// mongoose.set("debug", (collectionName, method, query, doc) => {
//   console.log(`${collectionName}.${method}`, JSON.stringify(query), doc);
// });
