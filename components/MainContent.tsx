"use client";

import { useState, useEffect } from "react";
import { useSession, authClient } from "@/lib/auth-client";
import { SignInSection } from "@/components/auth/SignInSection";
import { GetStartedSection } from "@/components/auth/GetStartedSection";
import {
  ClustersSection,
  ClusterScatterSection,
  SelectUserPanel,
  UserExplorerProvider,
  YearlySummariesSection,
  TweetsOverTimeSection,
  OntologySection,
  ThreadsSection,
  StatusPanel,
} from "@/components/user-explorer";
import { AdminPreviewProvider, useAdminPreview } from "./AdminPreviewContext";
import { AdminPreviewPanel } from "./AdminPreviewPanel";

interface MainContentProps {
  users: string[];
}

function MainContentInner({ users }: MainContentProps) {
  const { data: session, isPending } = useSession();
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [realIsAdmin, setRealIsAdmin] = useState(false);
  const [userTwitterId, setUserTwitterId] = useState<string | null>(null);
  const [twitterUsername, setTwitterUsername] = useState<string | null>(null);
  const [realExistsInCA, setRealExistsInCA] = useState<boolean | null>(null);
  const [realHasPaid, setRealHasPaid] = useState<boolean | null>(null);

  const adminPreview = useAdminPreview();

  // Computed effective values based on preview toggles
  const isAdmin = adminPreview.getEffectiveIsAdmin(realIsAdmin);
  const effectiveExistsInCA = adminPreview.getEffectiveInCaDb(realExistsInCA ?? false);
  const effectiveHasPaid = adminPreview.getEffectiveHasPaid(realHasPaid ?? false);
  const shouldShowAdminId1Data = adminPreview.shouldShowAdminId1Data(realIsAdmin, realExistsInCA ?? false);

  // If admin is viewing as ADMIN_ID_1, we need to get that Twitter ID
  const [adminId1TwitterId, setAdminId1TwitterId] = useState<string | null>(null);
  const effectiveTwitterId = shouldShowAdminId1Data ? adminId1TwitterId : userTwitterId;

  const handleLogout = async () => {
    await authClient.signOut();
  };

  useEffect(() => {
    // Check for payment success in URL
    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccess = urlParams.get("payment_success");

    if (paymentSuccess === "true") {
      // Remove query params from URL
      window.history.replaceState({}, "", window.location.pathname);

      // Auto-load analysis after successful payment
      setShowAnalysis(true);
    }
  }, []);

  useEffect(() => {
    if (session?.user) {
      // Check if user is admin and get username from Community Archive
      const checkAdmin = async () => {
        try {
          const response = await fetch("/api/auth/is-admin");
          if (!response.ok) {
            console.error("Admin check failed with status:", response.status);
            return;
          }
          const data = await response.json();
          console.log("Admin check response:", data);
          setRealIsAdmin(data.isAdmin);
          setUserTwitterId(data.twitterId);
          setTwitterUsername(data.username);

          if (!data.twitterId) {
            console.warn("No Twitter ID found in session - user may not have linked Twitter account");
          }

          // Check if user exists in CA DB
          if (data.twitterId) {
            const caResponse = await fetch("/api/auth/check-community-archive", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ accountId: data.twitterId }),
            });
            if (caResponse.ok) {
              const caData = await caResponse.json();
              setRealExistsInCA(caData.exists);
            }
          }

          // If user is not admin, check if they have paid
          if (!data.isAdmin) {
            const paymentResponse = await fetch("/api/auth/check-payment");
            if (paymentResponse.ok) {
              const paymentData = await paymentResponse.json();
              setRealHasPaid(paymentData.hasPaid);
              // If user has paid, automatically show analysis
              if (paymentData.hasPaid) {
                setShowAnalysis(true);
              }
            }
          } else {
            // For admins, fetch ADMIN_ID_1 from environment to use for preview
            // We'll need to get this from the server
            const adminIdResponse = await fetch("/api/auth/get-admin-id-1");
            if (adminIdResponse.ok) {
              const adminIdData = await adminIdResponse.json();
              setAdminId1TwitterId(adminIdData.adminId1);
            }
          }
        } catch (error) {
          console.error("Failed to check admin status:", error);
        }
      };
      void checkAdmin();
    } else {
      // Reset state when logged out
      setRealIsAdmin(false);
      setUserTwitterId(null);
      setTwitterUsername(null);
      setRealExistsInCA(null);
      setRealHasPaid(null);
      setShowAnalysis(false);
    }
  }, [session]);

  // Update showAnalysis when admin preview toggles change
  useEffect(() => {
    // Only apply this logic when user is an admin using preview mode
    if (!realIsAdmin) return;

    // If showing as admin (isAdmin toggle on), don't auto-show analysis
    if (isAdmin) return;

    // If not showing as admin and effectiveExistsInCA is true and effectiveHasPaid is true
    // then automatically show the analysis
    if (effectiveExistsInCA && effectiveHasPaid) {
      setShowAnalysis(true);
    } else {
      // If they toggle paid off or CA DB off, hide the analysis
      setShowAnalysis(false);
    }
  }, [realIsAdmin, isAdmin, effectiveExistsInCA, effectiveHasPaid]);

  // Loading state
  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  // Not authenticated - show sign in section
  if (!session) {
    return <SignInSection />;
  }

  // Authenticated and is admin - show full admin interface or preview mode
  if (isAdmin) {
    return (
      <UserExplorerProvider users={users}>
        <>
          {realIsAdmin && <AdminPreviewPanel />}
          <StatusPanel />
          <section className="flex flex-col gap-6 rounded-lg bg-white p-4 sm:p-8 ring-1 ring-zinc-200 transition-colors dark:bg-zinc-900 dark:ring-zinc-700">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="font-slab text-lg font-semibold text-zinc-800 transition-colors dark:text-zinc-100">
                  Select a User
                </h2>
                <button
                  onClick={handleLogout}
                  className="cursor-pointer text-sm text-zinc-600 hover:text-zinc-800 transition-colors dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Log out
                </button>
              </div>
              <p className="mt-2 text-sm text-zinc-600 transition-colors dark:text-zinc-400">
                Choose a user to explore. As soon as you pick someone, Birdseye loads clusters, timelines, and
                threads tailored to that account.
              </p>
            </div>
            <SelectUserPanel />
          </section>

          <ClustersSection />
          <ClusterScatterSection />
          <YearlySummariesSection />
          <OntologySection />
          <TweetsOverTimeSection />
          <ThreadsSection />
        </>
      </UserExplorerProvider>
    );
  }

  // Authenticated but not admin - show get started or user-specific data
  if (!showAnalysis) {
    // Pass effective values to GetStartedSection for proper preview
    return (
      <>
        {realIsAdmin && <AdminPreviewPanel />}
        <GetStartedSection
          onGetAnalysis={() => setShowAnalysis(true)}
          twitterUsername={twitterUsername}
          accountId={effectiveTwitterId}
          existsInCA={effectiveExistsInCA}
          hasPaid={effectiveHasPaid}
        />
      </>
    );
  }

  // User has clicked "Get the Analysis" - show their data
  // We need to find their username based on their Twitter ID
  console.log("Loading user data with Twitter ID:", effectiveTwitterId);

  return (
    <UserExplorerProvider users={users} singleUserMode={true} userTwitterId={effectiveTwitterId}>
      <>
        {realIsAdmin && <AdminPreviewPanel />}
        <StatusPanel />

        {/* User info section - no dropdown, just show current user */}
        <section className="flex flex-col gap-6 rounded-lg bg-white p-4 sm:p-8 ring-1 ring-zinc-200 transition-colors dark:bg-zinc-900 dark:ring-zinc-700">
          <div className="flex items-center justify-between">
            <h2 className="font-slab text-lg font-semibold text-zinc-800 transition-colors dark:text-zinc-100">
              User
            </h2>
            <button
              onClick={handleLogout}
              className="cursor-pointer text-sm text-zinc-600 hover:text-zinc-800 transition-colors dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Log out
            </button>
          </div>
          <SelectUserPanel />
        </section>

        <ClustersSection />
        <ClusterScatterSection />
        <YearlySummariesSection />
        <OntologySection />
        <TweetsOverTimeSection />
        <ThreadsSection />
      </>
    </UserExplorerProvider>
  );
}

export function MainContent({ users }: MainContentProps) {
  return (
    <AdminPreviewProvider>
      <MainContentInner users={users} />
    </AdminPreviewProvider>
  );
}
