import type { Metadata } from "next";
import { Geist, Geist_Mono, Roboto_Slab } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const slab = Roboto_Slab({
  variable: "--font-slab",
  subsets: ["latin"],
});

const themeInitScript = `
  (() => {
    const storageKey = "birdseye-theme";
    const root = document.documentElement;
    const classList = root.classList;
    const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
    const apply = (mode) => {
      const resolved = mode === "system" ? (prefersDark() ? "dark" : "light") : mode;
      classList.remove("light", "dark");
      if (resolved === "dark") {
        classList.add("dark");
      } else {
        classList.add("light");
      }
      root.dataset.theme = resolved;
      root.dataset.mode = resolved;
      root.dataset.themeMode = mode;
      root.style.colorScheme = resolved;
      if (document.body) {
        document.body.classList.remove("light", "dark");
        if (resolved === "dark") {
          document.body.classList.add("dark");
        } else {
          document.body.classList.add("light");
        }
        document.body.dataset.theme = resolved;
        document.body.dataset.mode = resolved;
      }
    };

    try {
      const stored = localStorage.getItem(storageKey);
      const mode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
      if (!stored) {
        localStorage.setItem(storageKey, mode);
      }
      apply(mode);
    } catch (error) {
      apply("system");
    }
  })();
`;

export const metadata: Metadata = {
  title: "Birdseye",
  description: "Explore patterns in your tweet history with automatically clustered topics.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${slab.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
