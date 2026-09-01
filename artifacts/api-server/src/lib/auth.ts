import type { RequestHandler } from "express";
import { clerkClient, getAuth } from "@clerk/express";

export const accountRoles = ["traveler", "driver", "operator"] as const;
export type AccountRole = (typeof accountRoles)[number];

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      accountRole?: AccountRole;
    }
  }
}

function isAccountRole(value: unknown): value is AccountRole {
  return typeof value === "string" && accountRoles.includes(value as AccountRole);
}

export async function getAccountRole(userId: string): Promise<AccountRole | null> {
  const user = await clerkClient.users.getUser(userId);
  const role = user.publicMetadata?.role;
  return isAccountRole(role) ? role : null;
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Απαιτείται σύνδεση." });
    return;
  }
  req.userId = userId;
  next();
};

export function requireRole(...roles: AccountRole[]): RequestHandler {
  return async (req, res, next) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) {
        res.status(401).json({ error: "Απαιτείται σύνδεση." });
        return;
      }

      const role = await getAccountRole(userId);
      if (!role || !roles.includes(role)) {
        res.status(403).json({ error: "Δεν έχεις δικαίωμα πρόσβασης σε αυτή την ενότητα." });
        return;
      }

      req.userId = userId;
      req.accountRole = role;
      next();
    } catch (error) {
      next(error);
    }
  };
}