import _ from "lodash";
import moment from "moment-timezone";
import winston from "winston";
import beautify from "json-beautify";
import config from "config";

const logger = winston.createLogger({
  transports: [
    ...(config.get<boolean>("logger.debug")
      ? [new winston.transports.Console({ level: "debug" })]
      : [new winston.transports.Console({ level: "info" })]),
    new winston.transports.File({ level: "error", filename: "logs/error.log" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.json(),
    winston.format.metadata({
      fillExcept: ["message", "level", "timestamp", "label", "stack", "_reqId"],
    }),
    winston.format.printf(({ timestamp, stack, level, message, metadata, _reqId, ...info }) => {
      let msg = `[${moment(timestamp).format("YYYY-MM-DD HH:mm:ss")}][${level}]${
        _reqId ? `[${_reqId}]` : ""
      } ${message}`;
      if (!_.isEmpty(metadata)) {
        msg += `\n${beautify(metadata, null, 2, 120)}`;
      }
      if (stack) {
        msg += `\n${_.take(stack.split("\n"), 4).join("\n")}`;
      }
      return msg;
    })
  ),
});

export default logger;
