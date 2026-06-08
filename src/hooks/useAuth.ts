import { trpc } from "@/providers/trpc";
import { useCallback, useMemo } from "react";

export type TrialStatus = {
  status: "guest" | "trial" | "premium" | "expired" | "no_trial";
  daysLeft: number | null;
  expired: boolean;
};

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

  // Determine trial status
  const trial: TrialStatus = useMemo(() => {
    if (!isAuthenticated) {
      return { status: "guest", daysLeft: null, expired: false };
    }
    // Check if email user has trial info
    const emailTrial = emailUser?.trial;
    if (emailTrial) {
      return emailTrial as TrialStatus;
    }
    // OAuth users are treated as premium
    return { status: "premium", daysLeft: null, expired: false };
  }, [isAuthenticated, emailUser, oauthUser]);

  const canUsePremium = trial.status === "trial" || trial.status === "premium";
  const isGuest = trial.status === "guest";
  const isExpired = trial.status === "expired";

  const logout = useCallback(() => {
    localStorage.removeItem("email_auth_token");
    localStorage.removeItem("guest_mode");
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
      trial,
      canUsePremium,
      isGuest,
      isExpired,
      logout,
    }),
    [user, isAuthenticated, isLoading, trial, canUsePremium, isGuest, isExpired, logout]
  );
}
