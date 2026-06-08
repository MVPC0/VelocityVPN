import { trpc } from "@/providers/trpc";
import { useCallback, useMemo } from "react";

export function useAuth() {
  const utils = trpc.useUtils();

  const {
    data: oauthUser,
    isLoading: oauthLoading,
  } = trpc.auth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const {
    data: emailUser,
    isLoading: emailLoading,
  } = trpc.emailAuth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
    },
  });

  const user = oauthUser ?? emailUser ?? null;
  const isLoading = oauthLoading && emailLoading;
  const isAuthenticated = !!user;

  const logout = useCallback(() => {
    // Always clear both auth systems
    localStorage.removeItem("email_auth_token");
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        window.location.reload();
      },
    });
  }, [logoutMutation]);

  return useMemo(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      logout,
    }),
    [user, isAuthenticated, isLoading, logout]
  );
}
