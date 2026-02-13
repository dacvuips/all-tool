import _ from "lodash";
import { MainConnection } from "../helpers/mongo";
import { loadMigration } from "../helpers/autoloader";
import logger from "../helpers/logger";

class MigrationLoader {
  async start() {
    /** Load migration */
    const migrations = await loadMigration();
    const collection = MainConnection.collection("migrations");
    await collection.findOne({});
    const finshedMigrations = await collection
      .find({})
      .toArray()
      .then((res: any) => _.keyBy(res, "name"));

    for (const migration of migrations) {
      const existed = finshedMigrations[migration.name];
      if (existed) {
        /** Skip migration if it runned */
        continue;
      }
      try {
        logger.info(`Start migration ${migration.name}`);
        await migration.handler();
        if (migration.mode != "test") {
          await collection.insertOne({ name: migration.name, createdAt: new Date() });
        }
      } catch (err) {
        logger.error(`Migration Error ${migration.name}::::`, err);
      } finally {
        logger.info(`End migration ${migration.name}`);
      }
    }
  }
}

export { MigrationLoader };
