import grapqhQLServer from "./graphql";
import logger from "./helpers/logger";
import config from "config";
import moment from "moment-timezone";
import { walkSyncFiles } from "./helpers/common";
import path from "path";
import startExpressApp from "./express";
import { MigrationLoader } from "./migrations";
import { startQueues } from "./queues/start-queues";
import { waitForMainConnection } from "./helpers/mongo";

async function executeSeedings() {
  const seedingFiles = walkSyncFiles(path.join(__dirname)).filter((f) =>
    /(.*).seeding.js$/.test(f)
  );
  for (const f of seedingFiles) {
    try {
      const { default: seeding } = require(f);
      await seeding();
    } catch (err) {
      logger.error(`seeding error ${f}`, err);
    }
  }
}

(async function () {
  moment.tz.setDefault(config.get("tz"));
  const port = config.get<number>("port");

  // Chờ Mongo trước khi nhận HTTP — tránh GraphQL "buffering timed out after 10000ms"
  await waitForMainConnection();

  const app = startExpressApp();
  const server = app.listen(port, "0.0.0.0", () => {
    logger.info(
      `Server is running at http://localhost:${port} in ${config.util.getEnv("NODE_ENV")} mode`
    );
  });
  grapqhQLServer(app, server);

  await executeSeedings();
  startQueues();

  const migrationLoader = new MigrationLoader();
  migrationLoader.start().catch((err) => {
    logger.error("migration error", err);
  });
})().catch((err) => {
  logger.error("server startup error", err);
});
