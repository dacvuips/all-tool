import { setContext } from "apollo-link-context";

export function SetUserToken(token: string) {
  localStorage.setItem("user-token", token);
}

export function ClearUserToken() {
  localStorage.removeItem("user-token");
}

export function GetUserToken() {
  return localStorage.getItem("user-token") || "";
}

export function SetFarmerToken(token: string) {
  localStorage.setItem("farmer-token", token);
}

export function ClearFarmerToken() {
  localStorage.removeItem("farmer-token");
}

export function GetFarmerToken() {
  return localStorage.getItem("farmer-token") || "";
}
export function SetCustomerToken(token: string, storage = localStorage) {
  storage.setItem("customer-token", token);
}

export function ClearCustomerToken() {
  localStorage.removeItem("customer-token");
}

export function GetCustomerToken() {
  return localStorage.getItem("customer-token") || "";
}
export function GetShopToken() {
  return localStorage.getItem("shop-token") || "";
}
export function SetShopToken(token: string, storage = localStorage) {
  storage.setItem("shop-token", token);
}

export function ClearShopToken() {
  localStorage.removeItem("shop-token");
}
export function GetIP() {
  return localStorage.getItem("user-ip") || "";
}

export function SetIP(ip: string) {
  return localStorage.setItem("user-ip", ip);
}

export const AuthLink = setContext((_, { headers }) => {
  // get the authentication token from local storage if it exists
  return new Promise((resolve) => {
    let token;
    if (
      location.pathname == "/admin" ||
      location.pathname.startsWith("/admin") ||
      location.pathname == "/partner" ||
      location.pathname.startsWith("/partner")
    ) {
      token = GetUserToken();
    } else if (location.pathname == "/shop" || location.pathname.startsWith("/shop")) {
      token = GetShopToken();
    } else {
      token = GetCustomerToken();
    }
    const ip = GetIP();
    const context = {
      headers: {
        ...headers,
        ...(token && token !== undefined
          ? {
              "x-token": token,
            }
          : {}),
        ...(ip && ip !== undefined
          ? {
              "x-forwarded-for": ip,
            }
          : {}),
      },
    };
    // return the headers to the context so httpLink can read them
    resolve(context);
  });
});
