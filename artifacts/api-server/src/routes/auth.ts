import { Router, type IRouter } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { accountRoles, getAccountRole, requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const user = await clerkClient.users.getUser(userId);
  const role = await getAccountRole(userId);
  const primaryEmail = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  )?.emailAddress;

  res.json({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: primaryEmail ?? null,
    imageUrl: user.imageUrl,
    role,
    availableRoles: accountRoles,
  });
});

router.patch("/me/role", requireAuth, async (req, res): Promise<void> => {
  const role = req.body?.role;
  if (typeof role !== "string" || !accountRoles.includes(role as (typeof accountRoles)[number])) {
    res.status(400).json({ error: "Μη έγκυρος ρόλος λογαριασμού." });
    return;
  }

  await clerkClient.users.updateUserMetadata(req.userId!, {
    publicMetadata: { role },
  });

  res.json({ role });
});

export default router;