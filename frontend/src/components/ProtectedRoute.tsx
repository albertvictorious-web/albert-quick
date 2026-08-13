import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { UserPublic } from "@/lib/types";

export function useMe() {
  return useQuery<UserPublic>({
    queryKey: ["me"],
    queryFn: () => apiGet<UserPublic>("/auth/me"),
    retry: false,
  });
}

export default function ProtectedRoute({
  children,
  adminOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
}) {
  const { data: user, isLoading, isError } = useMe();

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#F8FAFC]">
        <div
          data-testid="auth-loading-spinner"
          className="h-6 w-6 animate-spin rounded-full border-2 border-[#0F766E] border-t-transparent"
        />
      </div>
    );
  }

  if (isError || !user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
