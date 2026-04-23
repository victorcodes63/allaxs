"use client";

import { useState, ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
}

export function Tabs({ tabs, defaultTab }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return (
    <div className="w-full">
      {/* Tab Navigation */}
      <div className="border-b border-black/10 mb-6">
        <nav className="flex gap-4" role="tablist" aria-label="Event editor tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => {
                // Keyboard navigation: Arrow keys to switch tabs
                if (e.key === "ArrowRight") {
                  const currentIndex = tabs.findIndex((t) => t.id === activeTab);
                  const nextIndex = (currentIndex + 1) % tabs.length;
                  setActiveTab(tabs[nextIndex].id);
                  e.preventDefault();
                } else if (e.key === "ArrowLeft") {
                  const currentIndex = tabs.findIndex((t) => t.id === activeTab);
                  const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                  setActiveTab(tabs[prevIndex].id);
                  e.preventDefault();
                }
              }}
              className={`px-4 py-2 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                activeTab === tab.id
                  ? "text-primary border-b-2 border-primary"
                  : "text-black/60 hover:text-black"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTabContent}
      </div>
    </div>
  );
}

