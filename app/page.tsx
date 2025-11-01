import Image from "next/image";
import Link from "next/link";
import {
  ClustersSection,
  SelectUserPanel,
  UserExplorerProvider,
  YearlySummariesSection,
  TweetsOverTimeSection,
} from "@/components/user-explorer";
import ThemeSwitch from "@/components/theme-switch";
import { listVolumeUsers } from "@/lib/modal-data";

export default async function Home() {
  let users: string[] = [];
  try {
    users = await listVolumeUsers();
  } catch (error) {
    console.error("Failed to load users from Modal volume.", error);
  }

  return (
    <main className="min-h-screen bg-zinc-100 py-12 text-zinc-900 transition-colors dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-14 px-6 sm:px-10 lg:px-16">
        <div className="flex justify-end">
          <ThemeSwitch />
        </div>
        <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-5">
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
          <div className="flex flex-col gap-4 sm:items-end sm:justify-center sm:text-right">
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

        <section className="rounded-4xl bg-white p-8 ring-1 ring-zinc-200 transition-colors dark:bg-zinc-900 dark:ring-zinc-700">
          <h2 className="font-slab text-lg font-semibold text-zinc-800 transition-colors dark:text-zinc-100">
            Key features
          </h2>
          <ul className="mt-6 grid gap-5 text-base text-zinc-600 transition-colors sm:grid-cols-2 dark:text-zinc-300">
            <li className="flex items-stretch gap-4 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 transition-colors dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200">
              <span className="flex aspect-square h-full shrink-0 items-center justify-center text-3xl">
                <span role="img" aria-hidden="true">
                  📊
                </span>
              </span>
              <span>Topics are sorted by date (newest first)</span>
            </li>
            <li className="flex items-stretch gap-4 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 transition-colors dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200">
              <span className="flex aspect-square h-full shrink-0 items-center justify-center text-3xl">
                <span role="img" aria-hidden="true">
                  🔍
                </span>
              </span>
              <span>Each cluster shows stats, summaries, and yearly evolution</span>
            </li>
            <li className="flex items-stretch gap-4 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 transition-colors dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200">
              <span className="flex aspect-square h-full shrink-0 items-center justify-center text-3xl">
                <span role="img" aria-hidden="true">
                  📈
                </span>
              </span>
              <span>Timeline charts help track topic engagement over time</span>
            </li>
            <li className="flex items-stretch gap-4 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 transition-colors dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200">
              <span className="flex aspect-square h-full shrink-0 items-center justify-center text-3xl">
                <span role="img" aria-hidden="true">
                  🧵
                </span>
              </span>
              <span>View full threads and conversations within each topic</span>
            </li>
          </ul>
          <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 transition-colors dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
            Note: While most clusters are meaningful, some (especially the largest ones) may be too
            broad or noisy. The tool works best for exploration - try sorting by median date or likes
            to find interesting patterns!
          </p>
        </section>

        <UserExplorerProvider users={users}>
          <>
            <section className="flex flex-col gap-6 rounded-4xl bg-white p-8 ring-1 ring-zinc-200 transition-colors dark:bg-zinc-900 dark:ring-zinc-700">
              <div>
                <h2 className="font-slab text-lg font-semibold text-zinc-800 transition-colors dark:text-zinc-100">
                  Select a User
                </h2>
                <p className="mt-2 text-sm text-zinc-600 transition-colors dark:text-zinc-400">
                  Choose a user to explore. Once you click Explore, Birdseye loads clusters, timelines, and
                  threads tailored to that account.
                </p>
              </div>
              <SelectUserPanel />
            </section>

            <ClustersSection />
            <YearlySummariesSection />
            <TweetsOverTimeSection />
          </>
        </UserExplorerProvider>
      </div>
    </main>
  );
}
