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

export function SignInSection() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % EXAMPLE_IMAGES.length);
    }, 3000); // Change image every 3 seconds

    return () => clearInterval(interval);
  }, []);

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

  const handleSignIn = async () => {
    await authClient.signIn.social({
      provider: "twitter",
      callbackURL: "/",
    });
  };

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
          <h2 className="font-slab text-xl font-semibold text-zinc-800 text-center transition-colors dark:text-zinc-100">
            Sign in to get your tweet history analysis!
          </h2>
          <button
            onClick={handleSignIn}
            className="cursor-pointer rounded-lg border-2 border-zinc-900 bg-zinc-900 px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-zinc-800 hover:border-zinc-800 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:hover:border-zinc-200"
          >
            Sign In with Twitter/X
          </button>
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
