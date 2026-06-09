import { useCallback, useMemo } from "react";

export type TrialStatus = {
  status: "guest" | "trial" | "premium" | "expired" | "no_trial";
  daysLeft: number | null;
  expired: boolean;
};

// Standalone auth hook - no backend required
export function useAuth() {
  const trial: TrialStatus = { status: "guest", daysLeft: null, expired: false };

  const logout = useCallback(() => {
    localStorage.removeItem("email_auth_token");
    localStorage.removeItem("guest_mode");
    window.location.reload();
  }, []);

  return useMemo(
    () => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      trial,
      canUsePremium: false,
      isGuest: true,
      isExpired: false,
      logout,
    }),
    [trial, logout]
  );
}
