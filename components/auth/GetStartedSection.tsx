"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";
import styles from "./RainbowAnimation.module.css";

const EXAMPLE_IMAGES = [
  "/example1.png",
  "/example2.png",
  "/example3.png",
  "/example4.png",
];

interface GetStartedSectionProps {
  onGetAnalysis: () => void;
  twitterUsername?: string | null;
  accountId?: string | null;
  existsInCA?: boolean | null;
  hasPaid?: boolean | null;
}

export function GetStartedSection({ onGetAnalysis, twitterUsername, accountId, existsInCA: existsInCAProp, hasPaid: hasPaidProp }: GetStartedSectionProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [existsInCA, setExistsInCA] = useState<boolean | null>(existsInCAProp ?? null);
  const [checkingCA, setCheckingCA] = useState(existsInCAProp === null || existsInCAProp === undefined);
  const [hasPaid, setHasPaid] = useState<boolean | null>(hasPaidProp ?? null);
  const [checkingPayment, setCheckingPayment] = useState(hasPaidProp === null || hasPaidProp === undefined);
  const [redirectingToCheckout, setRedirectingToCheckout] = useState(false);

  const handleLogout = async () => {
    await authClient.signOut();
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % EXAMPLE_IMAGES.length);
    }, 3000); // Change image every 3 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // If props are provided (from admin preview), use them and skip fetching
    if (existsInCAProp !== null && existsInCAProp !== undefined) {
      setExistsInCA(existsInCAProp);
      setCheckingCA(false);
      return;
    }

    // Check if user exists in Community Archive
    const checkCommunityArchive = async () => {
      if (!accountId) {
        setCheckingCA(false);
        setExistsInCA(false);
        return;
      }

      try {
        const response = await fetch("/api/auth/check-community-archive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId }),
        });

        if (response.ok) {
          const data = await response.json();
          setExistsInCA(data.exists);
        } else {
          setExistsInCA(false);
        }
      } catch (error) {
        console.error("Failed to check Community Archive:", error);
        setExistsInCA(false);
      } finally {
        setCheckingCA(false);
      }
    };

    void checkCommunityArchive();
  }, [accountId, existsInCAProp]);

  useEffect(() => {
    // If props are provided (from admin preview), use them and skip fetching
    if (hasPaidProp !== null && hasPaidProp !== undefined) {
      setHasPaid(hasPaidProp);
      setCheckingPayment(false);
      return;
    }

    // Check if user has paid
    const checkPayment = async () => {
      try {
        const response = await fetch("/api/auth/check-payment");
        if (response.ok) {
          const data = await response.json();
          setHasPaid(data.hasPaid);
        } else {
          setHasPaid(false);
        }
      } catch (error) {
        console.error("Failed to check payment:", error);
        setHasPaid(false);
      } finally {
        setCheckingPayment(false);
      }
    };

    void checkPayment();
  }, [hasPaidProp]);

  const handleGetAnalysis = async () => {
    // If user has paid, proceed with loading data
    if (hasPaid) {
      onGetAnalysis();
      return;
    }

    // Otherwise, redirect to Stripe checkout
    setRedirectingToCheckout(true);
    try {
      const response = await fetch("/api/checkout_sessions", {
        method: "POST",
      });

      console.log("Checkout response status:", response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log("Checkout data:", data);
        if (data.url) {
          window.location.href = data.url;
        } else {
          console.error("No URL in response:", data);
          setRedirectingToCheckout(false);
        }
      } else {
        // Try to get the error details
        const responseText = await response.text();
        console.error("Failed to create checkout session:", {
          status: response.status,
          statusText: response.statusText,
          responseText: responseText,
          headers: Object.fromEntries(response.headers.entries())
        });

        // Try to parse as JSON
        try {
          const errorData = JSON.parse(responseText);
          console.error("Error data:", errorData);
        } catch (e) {
          console.error("Could not parse error response as JSON");
        }

        setRedirectingToCheckout(false);
      }
    } catch (error) {
      console.error("Checkout error:", error);
      setRedirectingToCheckout(false);
    }
  };

  useEffect(() => {
    // Detect dark mode
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };

    checkDarkMode();

    // Watch for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative flex flex-col gap-5 rounded-lg bg-white p-4 sm:p-8 ring-1 ring-zinc-200 transition-colors dark:bg-zinc-900 dark:ring-zinc-700 overflow-hidden">
      {/* Rainbow animation background */}
      <div className={`${styles.animationContainer} ${isDarkMode ? styles.dark : styles.light}`}>
        {Array.from({ length: 25 }).map((_, i) => (
          <div key={i} className={styles.rainbow} />
        ))}
        <div className={styles.fadeBottom} />
        <div className={styles.fadeLeft} />
      </div>

      <div className="relative z-10 grid md:grid-cols-3 gap-8 items-center">
        {/* Left side: Caption and Button */}
        <div className="flex flex-col justify-center items-center space-y-10 md:col-span-2">
          {checkingCA || checkingPayment ? (
            // Loading state
            <div className="flex flex-col items-center space-y-4">
              {twitterUsername && (
                <h1 className="font-slab text-2xl font-bold text-zinc-800 text-center transition-colors dark:text-zinc-100">
                  Hi, @{twitterUsername}!
                </h1>
              )}
              <p className="text-base text-zinc-600 text-center transition-colors dark:text-zinc-400">
                Checking your data...
              </p>
            </div>
          ) : existsInCA ? (
            // User exists in Community Archive
            <>
              <div className="flex flex-col items-center space-y-4">
                {twitterUsername && (
                  <h1 className="font-slab text-2xl font-bold text-zinc-800 text-center transition-colors dark:text-zinc-100">
                    Hi, @{twitterUsername}!
                  </h1>
                )}
                <p className="text-base text-zinc-700 text-center transition-colors dark:text-zinc-300">
                  Community Archive has your data. If you want to update it with the latest version{" "}
                  <a
                    href="https://x.com/settings/download_your_data"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-400 transition-colors dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-500"
                  >
                    export your data from Twitter/X
                  </a>{" "}
                  and upload it to{" "}
                  <a
                    href="https://www.community-archive.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-400 transition-colors dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-500"
                  >
                    Community Archive
                  </a>
                  . Or proceed with the current version:
                </p>
              </div>
              <div className="flex flex-col items-center space-y-3">
                <button
                  onClick={handleGetAnalysis}
                  disabled={redirectingToCheckout}
                  className="cursor-pointer rounded-lg border-2 border-zinc-900 bg-zinc-900 px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-zinc-800 hover:border-zinc-800 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:hover:border-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {redirectingToCheckout ? "Redirecting to checkout..." : "Get the Analysis"}
                </button>
                <button
                  onClick={handleLogout}
                  className="cursor-pointer text-sm text-zinc-600 hover:text-zinc-800 transition-colors dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Log out
                </button>
              </div>
            </>
          ) : (
            // User does not exist in Community Archive
            <>
              <div className="flex flex-col items-center space-y-4">
                {twitterUsername && (
                  <h1 className="font-slab text-2xl font-bold text-zinc-800 text-center transition-colors dark:text-zinc-100">
                    Hi, @{twitterUsername}!
                  </h1>
                )}
                <p className="text-base text-zinc-700 text-center transition-colors dark:text-zinc-300">
                  It seems like we don&apos;t have your data. To get your tweet history analysis{" "}
                  <a
                    href="https://x.com/settings/download_your_data"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-400 transition-colors dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-500"
                  >
                    export your data from Twitter/X
                  </a>{" "}
                  and upload it to{" "}
                  <a
                    href="https://www.community-archive.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-400 transition-colors dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-500"
                  >
                    Community Archive
                  </a>
                  .
                </p>
              </div>
              <div className="flex flex-col items-center space-y-3">
                <button
                  onClick={handleLogout}
                  className="cursor-pointer text-sm text-zinc-600 hover:text-zinc-800 transition-colors dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Log out
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right side: Slideshow */}
        <div className="relative w-full aspect-square bg-zinc-100 rounded-lg overflow-hidden border border-zinc-200 transition-colors dark:bg-zinc-800 dark:border-zinc-700">
          {EXAMPLE_IMAGES.map((src, index) => (
            <div
              key={src}
              className={`absolute inset-0 transition-opacity duration-500 ${
                index === currentImageIndex ? "opacity-100" : "opacity-0"
              }`}
            >
              <Image
                src={src}
                alt={`Example ${index + 1}`}
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-contain"
                priority={index === 0}
              />
            </div>
          ))}

          {/* Slideshow indicators */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
            {EXAMPLE_IMAGES.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentImageIndex ? "bg-blue-500 dark:bg-blue-400" : "bg-zinc-300 dark:bg-zinc-600"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
