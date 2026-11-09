import { useState } from "react";
import { create } from "zustand";
import { useAuthStore } from "../auth/authStore";
import { ConfirmDialog } from "./ConfirmDialog";

// Every "Sign out" button calls askSignOut(); this one dialog (mounted in App) asks Yes / No
// first, so a stray click doesn't end the session.
const useAsk = create<{ open: boolean; set: (open: boolean) => void }>((set) => ({
  open: false,
  set: (open) => set({ open }),
}));

export const askSignOut = () => useAsk.getState().set(true);

export function SignOutConfirm() {
  const open = useAsk((s) => s.open);
  const setOpen = useAsk((s) => s.set);
  const logout = useAuthStore((s) => s.logout);
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <ConfirmDialog
      visible={open}
      icon="log-out-outline"
      title="Sign out?"
      message="You'll need your email and password to sign in again. Anything you haven't saved will be lost."
      confirmLabel="Yes, sign out"
      cancelLabel="No"
      busy={busy}
      onCancel={() => setOpen(false)}
      onConfirm={signOut}
    />
  );
}
