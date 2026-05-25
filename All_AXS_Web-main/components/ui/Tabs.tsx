"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  /** Accessible name for the tablist (e.g. "Event editor tabs"). */
  ariaLabel?: string;
}

export function Tabs({ tabs, defaultTab, ariaLabel = "Tabs" }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  const selectId = useId();

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

  useEffect(() => {
    if (defaultTab && tabs.some((t) => t.id === defaultTab)) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, tabs]);

  const onTabKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    if (e.key === "ArrowRight") {
      const currentIndex = tabs.findIndex((t) => t.id === tabId);
      const nextIndex = (currentIndex + 1) % tabs.length;
      setActiveTab(tabs[nextIndex].id);
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      const currentIndex = tabs.findIndex((t) => t.id === tabId);
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      setActiveTab(tabs[prevIndex].id);
      e.preventDefault();
    }
  };

  const tabButtonClass = (selected: boolean) =>
    [
      "shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-4",
      selected
        ? "border-b-2 border-primary text-primary"
        : "text-muted hover:text-foreground",
    ].join(" ");

  return (
    <div className="w-full min-w-0">
      <label htmlFor={selectId} className="sr-only">
        {ariaLabel}
      </label>
      <select
        id={selectId}
        value={activeTab}
        onChange={(e) => setActiveTab(e.target.value)}
        className="mb-4 w-full rounded-[var(--radius-button)] border border-border bg-surface px-3 py-2.5 text-sm font-medium text-foreground md:hidden"
        aria-label={ariaLabel}
      >
        {tabs.map((tab) => (
          <option key={tab.id} value={tab.id}>
            {tab.label}
          </option>
        ))}
      </select>

      <div className="mb-6 hidden border-b border-border md:block">
        <nav
          className="-mx-1 flex gap-1 overflow-x-auto overscroll-x-contain px-1 pb-px [scrollbar-width:thin] snap-x snap-mandatory"
          role="tablist"
          aria-label={ariaLabel}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => onTabKeyDown(e, tab.id)}
              className={`${tabButtonClass(activeTab === tab.id)} snap-start`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="min-w-0"
      >
        {activeTabContent}
      </div>
    </div>
  );
}
