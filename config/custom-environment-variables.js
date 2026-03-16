const number = (name) => ({ __name: name, __format: 'number', });
const boolean = (name) => ({ __name: name, __format: 'boolean', });
const json = (name) => ({ __name: name, __format: 'json', });

module.exports = {
  tz: "TZ",
  secret: "SECRET",
  domain: "DOMAIN",
  port: {
    __name: "PORT",
    __format: "number",
  },
  firebase: {
    credential: {
      __name: "FIREBASE_CREDENTIAL",
      __format: "json",
    },
    webConfig: {
      __name: "FIREBASE_WEB_CONFIG",
      __format: "json",
    },
  },
  redis: {
    host: "REDIS_HOST",
    port: number("REDIS_PORT"),
    password: "REDIS_PASS",
    prefix: "REDIS_PREFIX",
    backend: "REDIS_BACKEND", // single, cluster, sentinel
    nodes: "REDIS_NODES",
    sentinel: {
      master: "REDIS_SENTINEL_MASTER",
      username: "REDIS_SENTINEL_USERNAME",
      password: "REDIS_SENTINEL_PASSWORD",
    },
  },
  next: {
    devMode: {
      __name: "NEXT_DEV_MODE",
      __format: "boolean",
    },
  },
  job: {
    isWorker: {
      __name: "JOB_IS_WORKER",
      __format: "boolean",
    },
    defines: "JOB_DEFINES",
    skips: "JOB_SKIPS",
  },
  mongo: {
    main: "MONGO_MAIN",
  },
  format: {
    date: "FORMAT_DATE",
    datetime: "FORMAT_DATETIME",
  },
  minio: {
    endpoint: "MINIO_ENDPOINT",
    port: {
      __name: "MINIO_PORT",
      __format: "number",
    },
    bucket: "MINIO_BUCKET",
    accessKey: "MINIO_USER",
    secretKey: "MINIO_PASSWORD",
  },
  logger: {
    debug: {
      __name: "LOGGER_DEBUG",
      __format: "boolean",
    },
  },
  store: {
    encryptionKey: "STORE_ENCRYPTION_KEY",
  },
  upload: {
    uploadImageApiLink: "UPLOAD_IMAGE_API_LINK",
  },
  casso: {
    secret: "CASSO_SECRET",
    apiKey: "CASSO_API_KEY",
  },
  paypal: {
    webhookId: "PAYPAL_WEBHOOK_ID",
    publicClientId:"NEXT_PUBLIC_PAYPAL_CLIENT_ID",
    clientSecret:"PAYPAL_CLIENT_SECRET"
  },
  helmet: {
    enable: {
      __name: "HELMET_ENABLE",
      __format: "boolean",
    },
  },
  sendgrid: {
    apiKey: "SENDGRID_API_KEY",
  },
  email: {
    from: "EMAIL_FROM",
  },
  partnerFee: {
    __name: "PARTNER_FEE",
    __format: "json",
  },
  exchangeFee: {
    __name: "EXCHANGE_FEE",
    __format: "json",
  },
  security: {
    auth: {
      useSession: {
        __name: "SECURITY_AUTH_USE_SESSION",
        __format: "boolean",
      },
    },
  },
  sepay: {
    secret: "SEPAY_SECRET",
  },
  // Biến môi trường cho SePay Payment Gateway (cổng thanh toán)
  sepayPG: {
    merchantId: "SEPAY_PG_MERCHANT_ID",
    secretKey: "SEPAY_PG_SECRET_KEY",
    sandboxMode: {
      __name: "SEPAY_PG_SANDBOX_MODE",
      __format: "boolean",
    },
  },
 
 
};
