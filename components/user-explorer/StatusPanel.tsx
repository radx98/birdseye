"use client";

import { useEffect, useRef, useState } from "react";
import { useUserExplorer } from "./context";

export const StatusPanel = () => {
  const { selectedUser, selectedCluster } = useUserExplorer();
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Find the "Select a User" section
    const findSection = () => {
      const headings = document.querySelectorAll("h2");
      for (const heading of headings) {
        if (heading.textContent?.includes("Select a User")) {
          return heading.closest("section");
        }
      }
      return null;
    };

    sectionRef.current = findSection();

    if (!sectionRef.current) return;

    const handleScroll = () => {
      if (!sectionRef.current) return;

      const rect = sectionRef.current.getBoundingClientRect();
      const bottomEdge = rect.bottom;

      // Show panel when viewport top goes below the bottom edge of "Select a User" section
      setIsVisible(bottomEdge < 0);
    };

    // Initial check
    handleScroll();

    // Add scroll listener
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionName: string) => {
    const headings = document.querySelectorAll("h2");
    for (const heading of headings) {
      if (heading.textContent?.includes(sectionName)) {
        const section = heading.closest("section");
        if (section) {
          const rect = section.getBoundingClientRect();
          const offset = window.scrollY + rect.top - 24; // 24px margin from top
          window.scrollTo({ top: offset, behavior: "smooth" });
          break;
        }
      }
    }
  };

  const handleUsernameClick = () => {
    scrollToSection("Select a User");
  };

  const handleClusterClick = () => {
    scrollToSection("Clusters");
  };

  if (!selectedUser || !selectedCluster) return null;

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex transition-all duration-200"
      style={{
        opacity: isVisible ? 0.85 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(-100%)",
      }}
    >
      <div className="mx-auto w-full max-w-6xl px-3 sm:px-16">
        <div className="pointer-events-auto mt-4 w-fit rounded-lg border border-zinc-200 bg-white px-4 py-2 shadow-md transition-colors dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={handleUsernameClick}
              className="font-semibold text-zinc-800 transition-colors hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300"
            >
              @{selectedUser}
            </button>
            <span className="text-zinc-400 dark:text-zinc-600">/</span>
            <button
              onClick={handleClusterClick}
              className="text-zinc-700 transition-colors hover:text-zinc-500 dark:text-zinc-300 dark:hover:text-zinc-400"
            >
              {selectedCluster.name}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};