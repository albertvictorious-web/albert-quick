// Session helpers over the httpOnly-cookie auth flow. Never store tokens client-side;
// the cookie rides same-origin fetches automatically. This module owns cache invalidation
// so a logout never leaks the previous account's react-query cache into the next login.
import { apiPost } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

export async function beginSession() {
  await queryClient.invalidateQueries({ queryKey: ["me"] });
}

export async function endSession() {
  await apiPost("/auth/logout");
  queryClient.clear();
}
