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

interface MainContentProps {
  users: string[];
}

export function MainContent({ users }: MainContentProps) {
  const { data: session, isPending } = useSession();
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userTwitterId, setUserTwitterId] = useState<string | null>(null);
  const [twitterUsername, setTwitterUsername] = useState<string | null>(null);

  const handleLogout = async () => {
    await authClient.signOut();
  };

  useEffect(() => {
    if (session?.user) {
      // Check if user is admin
      const checkAdmin = async () => {
        try {
          const response = await fetch("/api/auth/is-admin");
          if (!response.ok) {
            console.error("Admin check failed with status:", response.status);
            return;
          }
          const data = await response.json();
          console.log("Admin check response:", data);
          setIsAdmin(data.isAdmin);
          setUserTwitterId(data.twitterId);

          if (!data.twitterId) {
            console.warn("No Twitter ID found in session - user may not have linked Twitter account");
          } else {
            // Fetch the Twitter username from the Twitter ID
            const usernameResponse = await fetch("/api/auth/find-username", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ twitterId: data.twitterId }),
            });

            if (usernameResponse.ok) {
              const usernameData = await usernameResponse.json();
              setTwitterUsername(usernameData.username);
            }
          }
        } catch (error) {
          console.error("Failed to check admin status:", error);
        }
      };
      void checkAdmin();
    } else {
      // Reset state when logged out
      setIsAdmin(false);
      setUserTwitterId(null);
      setTwitterUsername(null);
      setShowAnalysis(false);
    }
  }, [session]);

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

  // Authenticated and is admin - show full admin interface
  if (isAdmin) {
    return (
      <UserExplorerProvider users={users}>
        <>
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
    return <GetStartedSection onGetAnalysis={() => setShowAnalysis(true)} twitterUsername={twitterUsername} accountId={userTwitterId} />;
  }

  // User has clicked "Get the Analysis" - show their data
  // We need to find their username based on their Twitter ID
  console.log("Loading user data with Twitter ID:", userTwitterId);

  return (
    <UserExplorerProvider users={users} singleUserMode={true} userTwitterId={userTwitterId}>
      <>
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
