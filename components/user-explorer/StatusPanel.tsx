"use client";

import { useEffect, useRef, useState } from "react";
import { useUserExplorer } from "./context";

const smoothScrollTo = (targetY: number, duration: number = 300) => {
  const startY = window.scrollY;
  const distance = targetY - startY;
  const startTime = performance.now();

  const easeInOutQuad = (t: number): number => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  };

  const scroll = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easing = easeInOutQuad(progress);

    window.scrollTo(0, startY + distance * easing);

    if (progress < 1) {
      requestAnimationFrame(scroll);
    }
  };

  requestAnimationFrame(scroll);
};

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
          smoothScrollTo(offset, 300); // 300ms for 2x faster than default smooth
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
        <div className="pointer-events-auto mx-3 mt-4 w-fit max-w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 shadow-md transition-colors dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.5),0_2px_4px_-2px_rgba(0,0,0,0.5)]">
          <div className="flex flex-wrap items-start gap-x-2 text-sm">
            <div className="flex items-center gap-2">
              <button
                onClick={handleUsernameClick}
                className="font-semibold text-zinc-800 transition-colors hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300"
              >
                @{selectedUser}
              </button>
              <span className="text-zinc-400 dark:text-zinc-600">/</span>
            </div>
            <button
              onClick={handleClusterClick}
              className="text-left text-zinc-700 transition-colors hover:text-zinc-500 dark:text-zinc-300 dark:hover:text-zinc-400"
            >
              {selectedCluster.name}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};