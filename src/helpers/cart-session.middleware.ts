import { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

const CART_SESSION_KEY = "cartSessionId";
const CART_COOKIE_EXPIRES = 30; // 30 days

/**
 * Middleware to ensure cartSessionId exists in cookies
 * Auto-generates and sets cookie if not present
 */
export function ensureCartSession(req: Request, res: Response, next: NextFunction) {
  let sessionId = req.cookies?.[CART_SESSION_KEY];

  if (!sessionId) {
    // Generate new session ID
    sessionId = uuidv4();

    // Set cookie with proper options
    res.cookie(CART_SESSION_KEY, sessionId, {
      maxAge: CART_COOKIE_EXPIRES * 24 * 60 * 60 * 1000, // 30 days in milliseconds
      httpOnly: false, // Allow frontend JavaScript to read it
      sameSite: "lax",
      secure: true, // HTTPS only in production
      path: "/",
    });
  }

  next();
}
