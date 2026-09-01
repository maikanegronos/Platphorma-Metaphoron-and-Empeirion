import { useQuery } from "@tanstack/react-query";

export const accountRoles = ["traveler", "driver", "operator"] as const;
export type AccountRole = (typeof accountRoles)[number];

export type CurrentUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  imageUrl: string;
  role: AccountRole | null;
  availableRoles: readonly AccountRole[];
};

const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");
const meUrl = `${apiBase}/api/me`;
const roleUrl = `${apiBase}/api/me/role`;

async function getCurrentUser(): Promise<CurrentUser> {
  const response = await fetch(meUrl, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Δεν ήταν δυνατή η ανάκτηση του προφίλ.");
  }
  return response.json() as Promise<CurrentUser>;
}

export function useCurrentUser(enabled = true) {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser,
    enabled,
    staleTime: 60_000,
  });
}

export async function updateAccountRole(role: AccountRole): Promise<void> {
  const response = await fetch(roleUrl, {
    method: "PATCH",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) {
    throw new Error("Δεν ήταν δυνατή η αποθήκευση του ρόλου.");
  }
}

export function roleLabel(role: AccountRole | null | undefined) {
  return role === "driver"
    ? "Οδηγός"
    : role === "operator"
      ? "Operator"
      : "Ταξιδιώτης";
}