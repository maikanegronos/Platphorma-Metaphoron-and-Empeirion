import {
  updateAccountRole as updateAccountRoleRequest,
  getGetCurrentUserQueryKey,
  useGetCurrentUser,
} from "@workspace/api-client-react";

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

export function useCurrentUser(enabled = true) {
  return useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      enabled,
      staleTime: 60_000,
    },
  });
}

export async function updateAccountRole(role: AccountRole): Promise<void> {
  await updateAccountRoleRequest(
    { role },
    { credentials: "include" },
  );
}

export function roleLabel(role: AccountRole | null | undefined) {
  return role === "driver"
    ? "Οδηγός"
    : role === "operator"
      ? "Operator"
      : "Ταξιδιώτης";
}