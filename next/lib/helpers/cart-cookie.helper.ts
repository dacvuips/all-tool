import { v4 as uuidv4 } from "uuid";

const CART_SESSION_KEY = "cartSessionId";
const CART_COOKIE_EXPIRES = 30; // 30 days

export class CartCookieHelper {
  static getCookie(name: string): string | undefined {
    if (typeof document === "undefined") return undefined;

    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const cookieValue = parts.pop()?.split(";").shift();
      return cookieValue ? decodeURIComponent(cookieValue) : undefined;
    }
    return undefined;
  }

  private static setCookie(name: string, value: string, days: number): void {
    if (typeof document === "undefined") return;

    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(
      value
    )};expires=${expires.toUTCString()};path=/`;
  }

  private static deleteCookie(name: string): void {
    if (typeof document === "undefined") return;

    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
  }

  /**
   * Get or create a cart session ID
   */
  static getOrCreateSessionId(): string {
    let sessionId = this.getCookie(CART_SESSION_KEY);

    if (!sessionId) {
      sessionId = uuidv4();
      this.setCookie(CART_SESSION_KEY, sessionId, CART_COOKIE_EXPIRES);
    }

    return sessionId;
  }

  /**
   * Get the current cart session ID (without creating)
   */
  static getSessionId(): string | undefined {
    return this.getCookie(CART_SESSION_KEY);
  }

  /**
   * Clear the cart session ID
   */
  static clearSessionId(): void {
    this.deleteCookie(CART_SESSION_KEY);
  }

  /**
   * Refresh session expiry
   */
  static refreshSession(): void {
    const sessionId = this.getSessionId();
    if (sessionId) {
      this.setCookie(CART_SESSION_KEY, sessionId, CART_COOKIE_EXPIRES);
    }
  }
}
