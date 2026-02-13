import config from "config";
import { createClient } from "redis";
import { t } from "./functions/string";
import logger from "./logger";

export class SharedRedisClient {
  private readonly logger = logger.child({ _reqId: SharedRedisClient.name });
  private static _instance: SharedRedisClient;
  private _client;

  private constructor() {
    const redisConfig = config.get<any>("redis");
    this._client = createClient({
      host: redisConfig.host,
      port: redisConfig.port,
      auth_pass: redisConfig.password ? redisConfig.password : undefined,
      password: redisConfig.password ? redisConfig.password : undefined,
      prefix: redisConfig.prefix,
      // config auto reconnect
      retry_strategy: (options: any) => {
        if (options.error && options.error.code === "ECONNREFUSED") {
          // End reconnecting on a specific error and flush all commands with a individual error
          this.logger.error(`Redis Error`, options.error);
          // return new Error("The server refused the connection");
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          // End reconnecting after a specific timeout and flush all commands with a individual error
          return new Error(t("Thử lại kết nối quá lâu"));
        }
        if (options.attempt > 10) {
          // End reconnecting with built in error
          return undefined;
        }
        // reconnect after
        return Math.min(options.attempt * 100, 3000);
      },
    });
    // const redisUrl = `redis://${redisConfig.host}:${redisConfig.port}`;
    // this.logger.info(`Shared Redis Client connecting to ${redisUrl}...`);
    // this._client = createClient({
    //   url: redisUrl,
    //   password: redisConfig.password ? redisConfig.password : undefined,
    // });

    this.handleRedisEvents();
  }

  private handleRedisEvents() {
    this._client.on("error", (error) => {
      this.logger.error(`On Error`, error);
    });
  }

  public static get instance() {
    if (!SharedRedisClient._instance) {
      SharedRedisClient._instance = new SharedRedisClient();
    }

    return SharedRedisClient._instance;
  }

  public get client() {
    return this._client;
  }
}
