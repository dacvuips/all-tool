import config from "config";
import { createClient } from "redis";
import { t } from "./functions/string";
import logger from "./logger";

export function isRedisUnavailableError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message || err || "");
  return /ready check failed|connection lost|command aborted|ECONNRESET|ECONNREFUSED|Stream isn't writeable|Connection is closed|Redis ready timeout|NR_CLOSED|UNCERTAIN_STATE/i.test(
    msg
  );
}

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
      // Giữ reconnect — đừng dừng sau 10 lần (bee-queue BRPOPLPUSH sẽ AbortError).
      retry_strategy: (options: any) => {
        if (options.error && options.error.code === "ECONNREFUSED") {
          this.logger.error(`Redis Error`, options.error);
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error(t("Thử lại kết nối quá lâu"));
        }
        return Math.min(options.attempt * 200, 5000);
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
    this._client.on("error", (error: any) => {
      const code = String(error?.code || "");
      const msg = String(error?.message || error || "");
      // Mất socket khi đang BRPOPLPUSH — không crash process, chỉ log.
      if (
        code === "UNCERTAIN_STATE" ||
        /connection lost|ready check failed|command aborted/i.test(msg)
      ) {
        this.logger.warn(`Redis command aborted (will reconnect): ${msg}`);
        return;
      }
      this.logger.error(`On Error`, error);
    });
    this._client.on("end", () => {
      this.logger.warn("Shared Redis client connection ended");
    });
    this._client.on("reconnecting", () => {
      this.logger.info("Shared Redis client reconnecting");
    });
    this._client.on("ready", () => {
      this.logger.info("Shared Redis client ready");
    });
  }

  public isReady(): boolean {
    return Boolean((this._client as { ready?: boolean }).ready);
  }

  public async waitUntilReady(timeoutMs = 20000): Promise<void> {
    const client = this._client as {
      ready?: boolean;
      once: (event: string, cb: () => void) => void;
      removeListener: (event: string, cb: () => void) => void;
    };
    if (client.ready) return;

    await new Promise<void>((resolve, reject) => {
      if (client.ready) {
        resolve();
        return;
      }
      const onReady = () => {
        cleanup();
        resolve();
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Redis ready timeout"));
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        client.removeListener("ready", onReady);
      };
      client.once("ready", onReady);
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
