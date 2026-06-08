import { useState, useEffect, useCallback, useMemo } from "react";

const GUEST_KEY = "guest_mode";
const TRIAL_SHOWN_KEY = "trial_banner_shown";

export type TrialState = {
  status: "guest" | "trial" | "premium" | "expired" | "no_trial";
  daysLeft: number | null;
  expired: boolean;
};

export function useTrial(isAuthenticated: boolean) {
  const [isGuest, setIsGuest] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  // Check if guest mode is active on mount
  useEffect(() => {
    const guestMode = localStorage.getItem(GUEST_KEY);
    if (guestMode === "true" && !isAuthenticated) {
      setIsGuest(true);
    }
    // If user logs in, clear guest mode
    if (isAuthenticated) {
      setIsGuest(false);
      localStorage.removeItem(GUEST_KEY);
    }
  }, [isAuthenticated]);

  const enableGuestMode = useCallback(() => {
    localStorage.setItem(GUEST_KEY, "true");
    setIsGuest(true);
  }, []);

  const disableGuestMode = useCallback(() => {
    localStorage.removeItem(GUEST_KEY);
    setIsGuest(false);
  }, []);

  const state: TrialState = useMemo(() => {
    if (isGuest) {
      return { status: "guest", daysLeft: null, expired: false };
    }
    if (!isAuthenticated) {
      return { status: "guest", daysLeft: null, expired: false };
    }
    // Authenticated users without trial data will get it from useAuth
    return { status: "no_trial", daysLeft: 3, expired: false };
  }, [isGuest, isAuthenticated]);

  const showUpgradePrompt = isGuest || state.status === "guest";

  return useMemo(
    () => ({
      isGuest,
      state,
      enableGuestMode,
      disableGuestMode,
      showUpgradePrompt,
    }),
    [isGuest, state, enableGuestMode, disableGuestMode, showUpgradePrompt]
  );
}
