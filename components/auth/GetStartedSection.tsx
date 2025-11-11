"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

const EXAMPLE_IMAGES = [
  "/example1.png",
  "/example2.png",
  "/example3.png",
  "/example4.png",
];

interface GetStartedSectionProps {
  onGetAnalysis: () => void;
}

export function GetStartedSection({ onGetAnalysis }: GetStartedSectionProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % EXAMPLE_IMAGES.length);
    }, 3000); // Change image every 3 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="mb-16">
      <h2 className="text-3xl font-bold mb-8">Get Started</h2>
      <div className="grid md:grid-cols-2 gap-8 items-center">
        {/* Left side: Caption and Button */}
        <div className="flex flex-col justify-center space-y-6">
          <p className="text-xl text-gray-700">
            Get your Twitter history analysis!
          </p>
          <button
            onClick={onGetAnalysis}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors text-lg w-fit"
          >
            Get the Analysis
          </button>
        </div>

        {/* Right side: Slideshow */}
        <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden">
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
                  index === currentImageIndex ? "bg-blue-500" : "bg-gray-300"
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
