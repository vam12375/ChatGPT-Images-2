import {
  MessageSquarePlus,
  PanelLeft,
  Search,
  WandSparkles,
  X
} from "lucide-react";
import type { RefObject } from "react";

import type { GenerationSession } from "./types";

type HistoryRailProps = {
  activeSession: GenerationSession | null;
  isGenerating: boolean;
  isRailCollapsed: boolean;
  isSearchOpen: boolean;
  recentPlaceholders: readonly string[];
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  sessions: GenerationSession[];
  visiblePlaceholders: readonly string[];
  visibleSessions: GenerationSession[];
  onClearSearch: () => void;
  onNewChat: () => void;
  onPlaceholderSelect: (index: number) => void;
  onSearchQueryChange: (value: string) => void;
  onSelectSession: (session: GenerationSession) => void;
  onToggleRail: () => void;
  onToggleSearch: () => void;
};

export function HistoryRail({
  activeSession,
  isGenerating,
  isRailCollapsed,
  isSearchOpen,
  recentPlaceholders,
  searchInputRef,
  searchQuery,
  sessions,
  visiblePlaceholders,
  visibleSessions,
  onClearSearch,
  onNewChat,
  onPlaceholderSelect,
  onSearchQueryChange,
  onSelectSession,
  onToggleRail,
  onToggleSearch
}: HistoryRailProps) {
  return (
    <aside
      className={`history-rail${isRailCollapsed ? " is-collapsed" : ""}`}
      aria-label="最近聊天"
    >
      <div className="rail-topbar">
        <span className="rail-logo" aria-hidden="true">
          <WandSparkles size={18} />
        </span>
        <button
          className="icon-button rail-collapse-button"
          type="button"
          aria-label={isRailCollapsed ? "展开侧栏" : "折叠侧栏"}
          aria-pressed={isRailCollapsed}
          onClick={onToggleRail}
        >
          <PanelLeft size={18} />
        </button>
      </div>

      <nav className="rail-actions" aria-label="快捷入口">
        <button
          type="button"
          aria-label="新聊天"
          disabled={isGenerating}
          title="新聊天"
          onClick={onNewChat}
        >
          <MessageSquarePlus size={18} />
          <span>新聊天</span>
        </button>
        <button
          className={isSearchOpen ? "is-active" : ""}
          type="button"
          aria-label={isSearchOpen ? "关闭搜索聊天" : "搜索聊天"}
          aria-expanded={isSearchOpen}
          title="搜索聊天"
          onClick={onToggleSearch}
        >
          <Search size={18} />
          <span>搜索聊天</span>
        </button>
      </nav>

      {isSearchOpen ? (
        <div className="rail-search" role="search">
          <Search size={15} aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="搜索标题或提示词"
            aria-label="搜索聊天记录"
          />
          {searchQuery ? (
            <button
              className="search-clear"
              type="button"
              aria-label="清空搜索"
              onClick={onClearSearch}
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="recent-section">
        <p>{isSearchOpen ? "搜索结果" : "最近"}</p>
        <div className="recent-list" aria-live="polite">
          {sessions.length > 0 ? (
            visibleSessions.length > 0 ? (
              visibleSessions.map((session) => (
                <button
                  className={session.id === activeSession?.id ? "is-active" : ""}
                  key={session.id}
                  type="button"
                  onClick={() => onSelectSession(session)}
                >
                  <span>{session.title}</span>
                  <small>{session.createdAt}</small>
                </button>
              ))
            ) : (
              <div className="recent-empty">没有找到匹配的聊天记录。</div>
            )
          ) : visiblePlaceholders.length > 0 ? (
            visiblePlaceholders.map((item, index) => (
              <button
                className={
                  !isSearchOpen && item === recentPlaceholders[0] ? "is-active" : ""
                }
                key={item}
                type="button"
                onClick={() => onPlaceholderSelect(index)}
              >
                <span>{item}</span>
              </button>
            ))
          ) : (
            <div className="recent-empty">没有找到匹配的聊天记录。</div>
          )}
        </div>
      </div>
    </aside>
  );
}
