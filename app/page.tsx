import Image from "next/image";
import Link from "next/link";
import ThemeSwitch from "@/components/theme-switch";
import { listUsers } from "@/lib/storage-data";
import { MainContent } from "@/components/MainContent";

export default async function Home() {
  let users: string[] = [];
  try {
    users = await listUsers();
  } catch (error) {
    console.error("Failed to load users from Supabase storage.", error);
  }

  return (
    <main className="min-h-screen bg-zinc-100 py-12 text-zinc-900 transition-colors dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-3 sm:px-16">
        <div className="flex justify-end">
          <ThemeSwitch />
        </div>
        <header className="flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-y-6">
          <Link href="/" className="flex shrink-0 items-center gap-5">
            <Image
              src="/favicon.svg"
              alt="Birdseye logo"
              width={44}
              height={44}
              priority
              className="h-11 w-11"
            />
            <div className="flex flex-col justify-center">
              <h1 className="font-slab text-4xl font-semibold leading-none tracking-tight text-zinc-800 dark:text-zinc-100">
                Birdseye
              </h1>
            </div>
          </Link>
          <div className="flex flex-col gap-4 sm:flex-1 sm:items-end sm:justify-center sm:text-right sm:min-w-0">
            <p className="max-w-xl text-base text-zinc-600 transition-colors dark:text-zinc-400">
              Birdseye helps you explore patterns in your tweet history by
              automatically clustering your tweets into topics. It&apos;s powered
              by the{" "}
              <a
                href="https://www.community-archive.org/"
                className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-400 transition-colors dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-500"
              >
                Community Archive
              </a>
              .
            </p>
          </div>
        </header>

        <section className="relative overflow-hidden rounded-lg bg-white/80 p-4 sm:p-8 ring-1 ring-zinc-200 transition-colors dark:bg-zinc-900/80 dark:ring-zinc-700">
          <div className="pointer-events-none absolute inset-y-0 right-0 z-0 flex items-end">
            <Image
              src="/birds_bg.svg"
              alt=""
              width={2421}
              height={1653}
              loading="eager"
              aria-hidden="true"
              className="h-full w-auto translate-x-[15%] translate-y-[25%] rotate-[15deg] scale-x-[-1.5] scale-y-[1.5] opacity-15 transition dark:invert dark:opacity-12"
            />
          </div>
          <div className="relative z-10">
            <h2 className="font-slab text-lg font-semibold text-zinc-800 transition-colors dark:text-zinc-100">
              Key features
            </h2>
            <ul className="mt-6 grid auto-rows-fr gap-4 text-sm text-zinc-600 transition-colors sm:grid-cols-2 dark:text-zinc-300">
              <li className="flex h-full items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 transition-colors dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-200">
                <span role="img" aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center text-2xl leading-none">
                  📊
                </span>
                <span className="flex-1 min-w-0 leading-relaxed">
                  Topics are sorted by date (newest first)
                </span>
              </li>
              <li className="flex h-full items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 transition-colors dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-200">
                <span role="img" aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center text-2xl leading-none">
                  🔍
                </span>
                <span className="flex-1 min-w-0 leading-relaxed">
                  Each cluster shows stats, summaries, and yearly evolution
                </span>
              </li>
              <li className="flex h-full items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 transition-colors dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-200">
                <span role="img" aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center text-2xl leading-none">
                  📈
                </span>
                <span className="flex-1 min-w-0 leading-relaxed">
                  Timeline charts help track topic engagement over time
                </span>
              </li>
              <li className="flex h-full items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 transition-colors dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-200">
                <span role="img" aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center text-2xl leading-none">
                  🧵
                </span>
                <span className="flex-1 min-w-0 leading-relaxed">
                  View full threads and conversations within each topic
                </span>
              </li>
            </ul>
            <p className="mt-8 rounded-lg border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm text-amber-800 transition-colors dark:border-amber-400/40 dark:bg-amber-500/[0.15] dark:text-amber-200">
              Note: While most clusters are meaningful, some (especially the largest ones) may be too
              broad or noisy. The tool works best for exploration - try sorting by median date or likes
              to find interesting patterns!
            </p>
          </div>
        </section>

        <MainContent users={users} />

        <footer className="mt-12 flex flex-row flex-wrap items-center justify-between gap-6 border-t border-zinc-200 px-4 pt-8 text-sm text-zinc-600 transition-colors sm:px-8 dark:border-zinc-800 dark:text-zinc-400">
          <a
            href="https://www.community-archive.org/"
            className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-400 transition-colors dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-500"
          >
            Community Archive
          </a>
          <a
            href="https://discord.gg/RArTGrUawX"
            className="inline-flex"
            aria-label="Join the Birdseye community on Discord"
          >
            <Image
              src="/discord.svg"
              alt=""
              width={22}
              height={22}
              className="h-[22px] w-auto transition dark:invert"
            />
          </a>
        </footer>
      </div>
    </main>
  );
}
