import { json, urlencoded } from "body-parser";
import compression from "compression";
import config from "config";
import cors from "cors";
import express, { Request } from "express";
import morgan from "morgan";
import next from "next";
import requestIp from "request-ip";

import cookieParser from "cookie-parser";
import helmet from "helmet";
import { ensureCartSession } from "./helpers/cart-session.middleware";
import logger from "./helpers/logger";
import { BaseError } from "./libs/core";
import router from "./routers";

export default function startExpressApp() {
  const app = express();

  // Config helmet
  useHelmet(app);

  // Config CORS
  app.use(cors());

  // Compress Response (tắt với SSE video generation — compression buffer gây 504)
  app.use(
    compression({
      filter: (req, res) => {
        if (
          /generation-(element-)?(video|image)|copy-video-generate-image/.test(req.path)
        ) {
          return false;
        }
        return compression.filter(req, res);
      },
    })
  );
  // Body Parser
  app.use(json({ limit: "50mb" }));
  app.use(urlencoded({ extended: true, limit: "50mb" }));
  // Config use cookie
  app.use(cookieParser(config.get<string>("secret")));
  // Auto-generate cart session ID if not exists to cookie
  app.use(ensureCartSession);
  // Request Log
  app.set("trust proxy", true);
  morgan.token("trueIp", (req) => requestIp.getClientIp(req));
  app.use(
    morgan(":trueIp :method :url :status - :response-time ms", {
      skip: (req: Request) => /(_ah\/health)|graphql|(_next)/.test(req.originalUrl),
      stream: { write: (msg: string) => logger.info(msg.trim()) },
    })
  );
  // Setup View Template
  app.set("view engine", "hbs");
  app.set("views", "public/views");
  // Setup Static file
  app.use("/public", express.static("public/static"));
  // Config RESAPI
  app.use("/", router);

  // Front End NextJS
  if (config.get("next.enable")) {
    logger.info("Starting Frontend By NextJs...");
    const nextApp = next({ dev: config.get("next.devMode"), dir: "./next" });
    const handle = nextApp.getRequestHandler();
    nextApp
      .prepare()
      .then(() => {
        logger.info("Next App Initialized!");
        app.all(["*", /^\/_next\/webpack-hmr(\/.*)?/], (req, res) => {
          handle(req, res);
        });
        // app.get("*", (req, res) => {
        //   handle(req, res);
        // });
      })
      .catch((err) => {
        logger.error("Start Frontend Error", err);
      });
  }

  // handle error
  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof BaseError) {
      res.status(err.httpCode).json({ message: err.message });
    } else {
      res.status(500).json({ message: err.message });
    }
  });

  return app;
}

function useHelmet(app: express.Application) {
  const authDomainFirebase = config.get("firebase.webConfig.authDomain") as string;

  if (config.get<boolean>("helmet.enable")) {
    logger.info("Helmet Enabled!");

    app.use(
      helmet({
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            mediaSrc: ["'self'", "blob:", "data:", "https://flow-content.google"],
            imgSrc: ["'self'", "https:", "data:", "blob:", "i.imgur.com", "http"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:"],
            connectSrc: [
              "'self'",
              "https://api.imgur.com/3/image",
              "wss:",
              "https://socialplugin.facebook.net",
              "https://www.facebook.com",
              "https://i.imgur.com",
              "https://identitytoolkit.googleapis.com",
              "https://securetoken.googleapis.com",
              "https://api.vietqr.io/v2/lookup",
              "https://upload-image-cyan.vercel.app/api/file/upload-image",
              "https://generativelanguage.googleapis.com",
              "https://flow-content.google",
            ],
            frameSrc: [
              "'self'",
              "https://www.facebook.com",
              "https://www.youtube.com",
              "https://www.google.com",
              "https://www.sandbox.paypal.com",
              "https://upload-image-cyan.vercel.app/api/file/upload-image",
              authDomainFirebase,
            ],
            formAction: ["'self'", "https://pay-sandbox.sepay.vn", "https://pay.sepay.vn"],
          },
        },
        noSniff: false,
        xssFilter: false,
        hidePoweredBy: true,
      })
    );
  }
}
