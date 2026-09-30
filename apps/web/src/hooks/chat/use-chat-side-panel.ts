"use client";

import { useCallback, useState } from "react";

export interface ChatSidePanelFileTab {
  id: string;
  path: string;
  name: string;
}

/**
 * Side-panel state for the chat page: open/close plus the open-file tab strip.
 * The org workspace is read-only, so tabs are the only mutable state here.
 */
export function useChatSidePanel() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [tabs, setTabs] = useState<ChatSidePanelFileTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const openPanel = useCallback(() => {
    setPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setTabs([]);
    setActiveTabId(null);
  }, []);

  const togglePanel = useCallback(() => {
    if (panelOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }, [closePanel, openPanel, panelOpen]);

  /** Open a workspace file, reusing its tab when already open. */
  const openFileTab = useCallback(
    (path: string, name: string) => {
      setPanelOpen(true);
      const existing = tabs.find((tab) => tab.path === path);
      if (existing) {
        setActiveTabId(existing.id);
        return;
      }
      const id = crypto.randomUUID();
      setTabs((current) => [...current, { id, name, path }]);
      setActiveTabId(id);
    },
    [tabs]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      const closedIndex = tabs.findIndex((tab) => tab.id === tabId);
      const next = tabs.filter((tab) => tab.id !== tabId);
      setTabs(next);
      if (activeTabId === tabId) {
        const fallback = next[closedIndex] ?? next[closedIndex - 1];
        setActiveTabId(fallback?.id ?? null);
      }
    },
    [activeTabId, tabs]
  );

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;

  return {
    panelOpen,
    tabs,
    activeTab,
    activeTabId,
    openPanel,
    closePanel,
    togglePanel,
    openFileTab,
    closeTab,
    setActiveTabId,
  };
}
