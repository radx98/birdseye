"use client";

import { useAdminPreview } from "./AdminPreviewContext";

export function AdminPreviewPanel() {
  const {
    previewState,
    setIsAdminToggle,
    setInCaDbToggle,
    setHasPaidToggle,
  } = useAdminPreview();

  return (
    <div className="fixed top-4 right-4 z-50 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 p-4 min-w-[200px]">
      <h3 className="font-slab text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-3">
        Page look:
      </h3>

      <div className="flex flex-col gap-3">
        {/* I'm admin toggle */}
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            I&apos;m admin
          </span>
          <input
            type="checkbox"
            checked={previewState.isAdminToggle}
            onChange={(e) => setIsAdminToggle(e.target.checked)}
            className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
          />
        </label>

        {/* I'm in the CA DB toggle */}
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            I&apos;m in the CA DB
          </span>
          <input
            type="checkbox"
            checked={previewState.inCaDbToggle}
            onChange={(e) => setInCaDbToggle(e.target.checked)}
            className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
          />
        </label>

        {/* I've paid toggle */}
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            I&apos;ve paid
          </span>
          <input
            type="checkbox"
            checked={previewState.hasPaidToggle}
            onChange={(e) => setHasPaidToggle(e.target.checked)}
            className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
}
