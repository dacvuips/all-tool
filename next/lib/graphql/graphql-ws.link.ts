import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { GetUserToken } from "./auth.link";

let wsLink;
let wsClient: ReturnType<typeof createClient>;
if (typeof window !== "undefined") {
  let protocol = "ws";
  let host = "localhost:5555";

  if (typeof location != "undefined") {
    protocol = location.protocol == "http:" ? "ws" : "wss";
    host = location.host;
  }

  const client = createClient({
    url: `${protocol}://${host}/graphql`,
    lazy: true,

    connectionParams: () => {
      // console.log("ws get connectionParams");
      const token = getWebSocketToken();
      return {
        "x-token": token || null,
      };
    },
    keepAlive: 30_000,
    retryAttempts: Infinity,
    retryWait: async function waitForServerHealthyBeforeRetry() {
      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 3000));
    },
    shouldRetry: () => true,
    on: {
      connecting: () => {
        // console.log("ws connecting");
      },
      connected: () => {
        console.log("%cSocket connected", "color:green; font-size: 20px");
      },
      opened: () => {
        // console.log("ws opened");
      },
      error: (err) => {
        console.log("ws error", err);
      },
      closed: () => {
        console.log("%cSocket closed", "color:red; font-size: 20px");
      },
      // message: (data) => {
      //   console.log("ws message", data);
      // },
      // ping: () => {
      //   console.log("ws ping");
      // },
      // pong: () => {
      //   console.log("ws pong");
      // },
    },
  });
  // @ts-ignore
  // client.maxConnectTimeGenerator.setMin(10000);
  wsLink = new GraphQLWsLink(client);

  wsClient = client;
}

export function getWebSocketToken() {
  let token;
  const pathname = location.pathname;

  if (pathname == "/admin" || pathname.startsWith("/admin/")) {
    token = GetUserToken();
  }
  return token;
}

export const WSLink: GraphQLWsLink = wsLink;
export const WSClient = wsClient;
