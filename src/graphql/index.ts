// import { makeExecutableSchema } from "@graphql-tools/schema";
import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageGraphQLPlayground,
} from "apollo-server-core";
import { ApolloServer, gql, makeExecutableSchema } from "apollo-server-express";
import { Express, Request } from "express";
import GraphQLDateTime from "graphql-type-datetime";
import { useServer } from "graphql-ws/lib/use/ws";
import { Server } from "http";
import _ from "lodash";
import morgan from "morgan";
import { Socket } from "net";
import path from "path";
import { Server as WebSocketServer } from "ws";
import { walkSyncFiles } from "../helpers/common";
import logger from "../helpers/logger";
import { onContext } from "../libs/graphql/context";
import { DOMAIN, IS_DEBUG } from "../libs/shared";

export default async (app: Express, httpServer: Server) => {
  const typeDefs = [
    gql`
      directive @deprecated(
        reason: String = "không còn sử dụng"
      ) on FIELD_DEFINITION | ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION | ENUM_VALUE
      scalar Mixed
      scalar DateTime

      type Query {
        _empty: String
      }
      type Mutation {
        _empty: String
      }
      type Subscription {
        _empty: String
      }
      input QueryGetListInput {
        limit: Int
        offset: Int
        page: Int
        order: Mixed
        filter: Mixed
        search: String
      }

      type Pagination {
        limit: Int
        offset: Int
        page: Int
        total: Int
      }
    `,
  ];

  let resolvers = {
    DateTime: GraphQLDateTime,
  };

  const ModuleFiles = walkSyncFiles(path.join(__dirname, "modules"));
  ModuleFiles.filter((f: any) => /(.*).schema.js$/.test(f)).map((f: any) => {
    const { default: schema } = require(f);
    typeDefs.push(schema);
  });
  ModuleFiles.filter((f: any) => /(.*).resolver.js$/.test(f)).map((f: any) => {
    const { default: resolver } = require(f);
    resolvers = _.merge(resolvers, resolver);
  });
  ModuleFiles.filter((f: any) => /(.*).graphql.js$/.test(f)).map((f: any) => {
    const {
      default: { resolver, schema },
    } = require(f);
    if (schema) typeDefs.push(schema);
    if (resolver) resolvers = _.merge(resolvers, resolver);
  });
  // ModuleFiles.filter((f: any) => /(.*).seeding.js$/.test(f)).map((f: any) => {
  //   const { default: seedingFn } = require(f);
  //   seedingFn();
  // });

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const server = new ApolloServer({
    schema: schema,
    introspection: IS_DEBUG,
    debug: IS_DEBUG,
    context: onContext,
    formatError(err: any) {
      logger.error("GRPHQL ERROR: " + err.message);
      try {
        const message = err.message.replace(/Context creation failed\:/g, "").trim();
        err.message = message;
        if (err.extensions && !err.extensions.exception.info) {
          // ErrorHelper.logUnknowError(err);
          // SentryHelper.captureException(err);
        }
        return err;
      } catch (error) {
        return err;
      }
    },
    plugins: [
      // Proper shutdown for the HTTP server.
      ApolloServerPluginDrainHttpServer({ httpServer }),
      ...(IS_DEBUG
        ? [ApolloServerPluginLandingPageGraphQLPlayground({ endpoint: "/graphql" })]
        : []),
      // Proper shutdown for the WebSocket server.
      {
        async serverWillStart() {
          return {
            async drainServer() {
              console.log("drainServer");
              await serverCleanup.dispose();
            },
          } as any;
        },
      },
    ],
  });

  // const defaultFragmentFields = Object.keys(defaultFragment);
  morgan.token("gql-query", (req: Request) => _.get(req, "gql", ""));
  app.use(
    "/graphql",
    (req, res, next) => {
      if (req.body && req.body.query) {
        const query = gql(req.body.query);
        const operation = _.get(query, "definitions.0.operation", "");
        const selection = _.get(query, "definitions.0.selectionSet.selections.0.name.value", "");
        _.set(req, "gql", `${operation} ${selection}`);
      }
      next();
    },
    morgan(
      ":trueIp GRAPHQL :gql-query - :status - :response-time ms",
      // ":remote-addr :remote-user :method :url :gql-query HTTP/:http-version :status :res[content-length] - :response-time ms",
      {
        skip: (req: Request) => (_.get(req, "body.query") || "").includes("IntrospectionQuery"),
        stream: { write: (msg: string) => logger.info(msg.trim()) },
      }
    )
  );

  await server.start();
  server.applyMiddleware({
    app,
    cors: {
      credentials: true,
      origin: (origin: any, callback: any) => {
        callback(null, true);
      },
    },
  });
  // server.installSubscriptionHandlers(httpServer);

  // Creating the WebSocket server
  const wsServer = new WebSocketServer({
    noServer: true,
  });

  httpServer.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    if (pathname === "/graphql") {
      wsServer.handleUpgrade(req, socket as Socket, head, (ws) => {
        wsServer.emit("connection", ws, req);
      });
    }
  });
  // Hand in the schema we just created and have the
  // WebSocketServer start listening.
  const serverCleanup = useServer(
    {
      schema,
      context: async (ctx, msg, args) => {
        return await onContext({
          req: ctx.extra.request,
          connection: { context: ctx.connectionParams },
        });
      },
    },
    wsServer
  );

  logger.info(`Running Apollo Server on Path: ${DOMAIN}${server.graphqlPath}`);
};
