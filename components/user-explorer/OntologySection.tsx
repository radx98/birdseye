"use client";

import { Fragment, type ReactNode } from "react";
import { useUserExplorer } from "./context";
import { formatHandle } from "./formatters";

export const OntologySection = () => {
  const { summary, clustersLoading, selectedCluster, hasAvailableClusters } = useUserExplorer();

  if (!summary) {
    return null;
  }

  const showLoading = clustersLoading && !hasAvailableClusters;
  const ontology = selectedCluster?.ontology;

  const renderCard = <T extends { id: string; tweetReferences: string[] }>(
    title: string,
    items: T[],
    getTitle: (item: T) => string,
    getDescription: (item: T) => string,
    emptyText: string,
  ) => {
    const hasItems = items.length > 0;

    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
          {title}
        </h3>
        {hasItems ? (
          <ul className="mt-3 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
            {items.map((item, index) => {
              const primary = getTitle(item).trim();
              const secondary = getDescription(item).trim();
              const references = Array.isArray(item.tweetReferences) ? item.tweetReferences.length : 0;
              const key = item.id || `${title}-${index}`;

              return (
                <li key={key} className="flex flex-col gap-2">
                  <p className="leading-relaxed">
                    {primary ? (
                      <span className="font-semibold text-zinc-800 dark:text-zinc-100">{primary}</span>
                    ) : null}
                    {primary && secondary ? <Fragment>&nbsp;—&nbsp;</Fragment> : null}
                    {secondary ? <span>{secondary}</span> : null}
                    {!primary && !secondary ? <span>No description available.</span> : null}
                  </p>
                  <button
                    type="button"
                    disabled={references === 0}
                    aria-disabled={references === 0}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 transition hover:text-blue-500 disabled:cursor-not-allowed disabled:text-zinc-400 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <span aria-hidden="true">🔗</span>
                    <span>{`${references} ${references === 1 ? "reference" : "references"}`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{emptyText}</p>
        )}
      </div>
    );
  };

  let body: ReactNode;

  if (showLoading) {
    body = (
      <div className="flex items-center justify-center rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 animate-ping rounded-full bg-zinc-400 dark:bg-zinc-500" aria-hidden="true" />
          Loading ontology details…
        </span>
      </div>
    );
  } else if (!hasAvailableClusters || !selectedCluster) {
    body = (
      <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
        Select a cluster to explore its ontology.
      </div>
    );
  } else if (!ontology) {
    body = (
      <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
        Ontology data is not available for this cluster.
      </div>
    );
  } else {
    const hasAnyOntology =
      ontology.entities.length > 0 ||
      ontology.beliefsAndValues.length > 0 ||
      ontology.goals.length > 0 ||
      ontology.socialRelationships.length > 0 ||
      ontology.moodsAndEmotionalTones.length > 0 ||
      ontology.keyConcepts.length > 0;

    body = (
      <div className="flex flex-col gap-5">
        {!hasAnyOntology && (
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
            Ontology data was not provided for this cluster. Once it is available, key themes will appear below.
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {renderCard(
            "Entities",
            ontology.entities,
            (item) => item.name || (item.id ? `Entity ${item.id}` : "Entity"),
            (item) => item.description,
            "No entities identified for this cluster.",
          )}
          {renderCard(
            "Beliefs & Values",
            ontology.beliefsAndValues,
            (item) => item.belief || (item.id ? `Belief ${item.id}` : "Belief"),
            (item) => item.description,
            "No beliefs or values identified for this cluster.",
          )}
          {renderCard(
            "Goals",
            ontology.goals,
            (item) => item.goal || (item.id ? `Goal ${item.id}` : "Goal"),
            (item) => item.description,
            "No goals identified for this cluster.",
          )}
          {renderCard(
            "Social Relationships",
            ontology.socialRelationships,
            (item) => formatHandle(item.username) || (item.id ? `Relationship ${item.id}` : "Relationship"),
            (item) => item.interactionType,
            "No social relationships identified for this cluster.",
          )}
          {renderCard(
            "Moods & Emotional Tones",
            ontology.moodsAndEmotionalTones,
            (item) => item.mood || (item.id ? `Mood ${item.id}` : "Mood"),
            (item) => item.description,
            "No moods or emotional tones identified for this cluster.",
          )}
          {renderCard(
            "Key Concepts",
            ontology.keyConcepts,
            (item) => item.concept || (item.id ? `Concept ${item.id}` : "Concept"),
            (item) => item.description,
            "No key concepts identified for this cluster.",
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-5 rounded-lg bg-white p-8 ring-1 ring-zinc-200 transition-colors dark:bg-zinc-900 dark:ring-zinc-700">
      <div>
        <h2 className="font-slab text-lg font-semibold text-zinc-800 transition-colors dark:text-zinc-100">
          Ontology
        </h2>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 transition-colors dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
        <span role="img" aria-hidden="true" className="mr-2">
          ↔️
        </span>
        We gathered some key features to help understand the topic all at once. You can click{" "}
        <span aria-hidden="true">🔗</span> references to see the tweets that inform them.
      </div>
      {body}
    </section>
  );
};
