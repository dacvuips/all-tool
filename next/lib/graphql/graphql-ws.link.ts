import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { GetCustomerToken, GetShopToken, GetUserToken } from "./auth.link";

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
    retryAttempts: 15,
    retryWait: async function waitForServerHealthyBeforeRetry() {
      await new Promise((resolve) => setTimeout(resolve, 3000 + Math.random() * 5000));
    },
    shouldRetry: (errOrCloseEvent) => {
      if (errOrCloseEvent && typeof errOrCloseEvent === "object" && "code" in errOrCloseEvent) {
        const code = (errOrCloseEvent as CloseEvent).code;
        // Normal close / going away — do not retry
        if (code === 1000 || code === 1001) return false;
      }
      return true;
    },
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
  const pathname = location.pathname;

  if (
    pathname == "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname == "/partner" ||
    pathname.startsWith("/partner/")
  ) {
    return GetUserToken();
  }
  if (pathname == "/shop" || pathname.startsWith("/shop/")) {
    return GetShopToken();
  }
  return GetCustomerToken();
}

export const WSLink: GraphQLWsLink = wsLink;
export const WSClient = wsClient;
