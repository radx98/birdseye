"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export interface AdminPreviewState {
  isAdminToggle: boolean;
  inCaDbToggle: boolean;
  hasPaidToggle: boolean;
}

interface AdminPreviewContextValue {
  previewState: AdminPreviewState;
  setIsAdminToggle: (value: boolean) => void;
  setInCaDbToggle: (value: boolean) => void;
  setHasPaidToggle: (value: boolean) => void;

  // Computed values that respect the toggles
  getEffectiveIsAdmin: (realIsAdmin: boolean) => boolean;
  getEffectiveInCaDb: (realInCaDb: boolean) => boolean;
  getEffectiveHasPaid: (realHasPaid: boolean) => boolean;

  // Check if user should see ADMIN_ID_1 data
  shouldShowAdminId1Data: (realIsAdmin: boolean, realInCaDb: boolean) => boolean;
}

const AdminPreviewContext = createContext<AdminPreviewContextValue | null>(null);

interface AdminPreviewProviderProps {
  children: ReactNode;
}

export function AdminPreviewProvider({ children }: AdminPreviewProviderProps) {
  const [previewState, setPreviewState] = useState<AdminPreviewState>({
    isAdminToggle: true,
    inCaDbToggle: true,
    hasPaidToggle: true,
  });

  const setIsAdminToggle = (value: boolean) => {
    setPreviewState((prev) => ({ ...prev, isAdminToggle: value }));
  };

  const setInCaDbToggle = (value: boolean) => {
    setPreviewState((prev) => ({ ...prev, inCaDbToggle: value }));
  };

  const setHasPaidToggle = (value: boolean) => {
    setPreviewState((prev) => ({ ...prev, hasPaidToggle: value }));
  };

  const getEffectiveIsAdmin = (realIsAdmin: boolean) => {
    if (!realIsAdmin) return false; // Non-admins can't override this
    return previewState.isAdminToggle;
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getEffectiveInCaDb = (_realInCaDb: boolean) => {
    // If toggle is off, always return false (not in DB)
    if (!previewState.inCaDbToggle) return false;
    // If toggle is on, return true (simulating being in DB)
    return true;
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getEffectiveHasPaid = (_realHasPaid: boolean) => {
    // Toggle controls the paid status
    return previewState.hasPaidToggle;
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const shouldShowAdminId1Data = (realIsAdmin: boolean, _realInCaDb: boolean) => {
    // Only admins can use this feature
    if (!realIsAdmin) return false;

    // If admin toggle is on, don't show ADMIN_ID_1 data (show as admin)
    if (previewState.isAdminToggle) return false;

    // If admin toggle is off and CA DB toggle is on, show ADMIN_ID_1 data
    return previewState.inCaDbToggle;
  };

  const contextValue: AdminPreviewContextValue = {
    previewState,
    setIsAdminToggle,
    setInCaDbToggle,
    setHasPaidToggle,
    getEffectiveIsAdmin,
    getEffectiveInCaDb,
    getEffectiveHasPaid,
    shouldShowAdminId1Data,
  };

  return (
    <AdminPreviewContext.Provider value={contextValue}>
      {children}
    </AdminPreviewContext.Provider>
  );
}

export function useAdminPreview() {
  const context = useContext(AdminPreviewContext);
  if (!context) {
    throw new Error("useAdminPreview must be used within an AdminPreviewProvider");
  }
  return context;
}
