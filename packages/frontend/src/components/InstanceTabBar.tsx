import { useEffect, useState } from "react";
import { ArrowLeft, X, Globe, MessageSquarePlus, LogOut, Lock, KeyRound, RefreshCw, ChevronDown, Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "../i18n/index";
import type { OpenTab } from "../App";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface InstanceTabBarProps {
  openTabs: OpenTab[];
  activeTabId: number | null;
  onSwitchTab: (id: number) => void;
  onCloseTab: (id: number) => void;
  /** Persist a new order of open tabs after a drag-and-drop reorder. */
  onReorderTabs: (newOrder: OpenTab[]) => void;
  onBackToInstances: () => void;
  /** Y-app account info shown on the right side of the bar. */
  yAppUser: { id: number; email: string };
  onLogout: () => void;
  /** When true (desktop/Android), the account dropdown shows a "Local vault"
   * label instead of a fake Y-app email, since these builds have no Y-app
   * account — the Stronghold vault password replaces it. */
  localVaultMode?: boolean;
  /** Optional callback to open a "Change vault password" modal. Only
   * rendered when both this and `localVaultMode` are set. */
  onChangeVaultPassword?: () => void;
}

/** One draggable tab in the bar. Extracted so it can use the useSortable hook. */
function SortableTab({
  tab,
  isActive,
  onSwitch,
  onClose,
}: {
  tab: OpenTab;
  isActive: boolean;
  onSwitch: (id: number) => void;
  onClose: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
  });

  const color = tab.themeColor || "#14b8a6";
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderTopColor: isActive ? color : "transparent",
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : "auto" as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group flex items-center rounded-t border-t-[3px] transition-colors flex-shrink-0 cursor-grab active:cursor-grabbing ${
        isActive
          ? "bg-slate-800 text-white h-7"
          : "bg-slate-900 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 h-5 mb-1"
      }`}
    >
      <button
        onClick={() => onSwitch(tab.id)}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => { if (e.button === 1) e.preventDefault(); }}
        onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); onClose(tab.id); } }}
        className="flex items-center gap-1.5 pl-2 pr-0.5 h-full cursor-pointer max-w-[180px]"
        title={tab.url}
      >
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-[11px] font-medium truncate">{tab.name}</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
        onPointerDown={(e) => e.stopPropagation()}
        className={`p-0.5 mr-0.5 rounded hover:bg-slate-700 cursor-pointer ${
          isActive ? "text-slate-400 hover:text-white" : "opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-200"
        }`}
        title="Close tab"
      >
        <X size={10} />
      </button>
    </div>
  );
}

/**
 * In-app tab bar across the top of the workspace. Each tab represents one
 * open ERPNext instance. Click a tab to switch; click × to close. The
 * "Instances" button on the left returns to the InstancesPage picker
 * without closing any tabs.
 */
export default function InstanceTabBar({
  openTabs,
  activeTabId,
  onSwitchTab,
  onCloseTab,
  onReorderTabs,
  onBackToInstances,
  yAppUser,
  onLogout,
  localVaultMode = false,
  onChangeVaultPassword,
}: InstanceTabBarProps) {
  const { t, i18n } = useTranslation();
  const [showFeedback, setShowFeedback] = useState(false);
  const [fbTitle, setFbTitle] = useState("");
  const [fbBody, setFbBody] = useState("");
  const [fbType, setFbType] = useState<"bug" | "feature" | "question">("bug");
  const [showMobileTabs, setShowMobileTabs] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Close the mobile tab sheet whenever the active tab changes (e.g. user
  // picked a row inside the sheet, or switched via some other path).
  useEffect(() => { setShowMobileTabs(false); }, [activeTabId]);

  const activeTab = openTabs.find((tab) => tab.id === activeTabId) || null;
  const userInitial = (yAppUser.email[0] || "?").toUpperCase();

  // Mirror of the existing y-app:refresh-active-tab pattern: this bar lives
  // outside AuthenticatedApp (above the BrowserRouter), so it can't reach
  // the workspace's mobileMenuOpen state directly. AuthenticatedApp listens
  // for this event and toggles its sidebar.
  function handleMobileMenuToggle() {
    window.dispatchEvent(new CustomEvent("y-app:toggle-mobile-menu"));
  }

  // PointerSensor with a 5px activation distance: small movements (clicks) go
  // straight to the inner switch/close buttons; only deliberate drags activate
  // the sortable behaviour. Without this threshold every click would attempt a
  // drag and the tab switch button would never fire.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = openTabs.findIndex((t) => t.id === active.id);
    const newIndex = openTabs.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderTabs(arrayMove(openTabs, oldIndex, newIndex));
  }

  async function handleLogoutClick() {
    try { await fetch("/api/yapp/logout", { method: "POST", credentials: "same-origin" }); } catch { /* */ }
    onLogout();
  }

  function handleRefreshClick() {
    // Dispatch a custom event that AuthenticatedApp listens for. Lets the
    // refresh button live at the global level even though the actual
    // refresh logic (setInstanceKey) lives inside each tab's workspace.
    window.dispatchEvent(new CustomEvent("y-app:refresh-active-tab"));
    // Visual feedback only — the actual refetch is fire-and-forget at this
    // level. Spin for a perceptible-but-short window so the user gets a
    // confirmation that the click registered.
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 900);
  }

  const hasTabs = openTabs.length > 0;

  return (
    <div className="flex bg-slate-900 px-1.5 gap-0.5 flex-shrink-0 h-11 items-center md:h-7 md:items-end">
      {/* Mobile-only hamburger: takes over the role of the now-removed
          InstanceBar's hamburger so we can drop that 36-px row entirely.
          Sized at 36×36 (close to the 44 px iOS guideline) so it's
          comfortably tappable. */}
      {hasTabs && activeTabId != null && (
        <button
          onClick={handleMobileMenuToggle}
          className="md:hidden flex items-center justify-center w-9 h-9 text-slate-300 hover:text-white hover:bg-slate-800 rounded cursor-pointer flex-shrink-0"
          aria-label="Open menu"
          title="Menu"
        >
          <Menu size={18} />
        </button>
      )}

      {/* Desktop: "Instances" back button + horizontal scrollable tab strip. */}
      {hasTabs && (
        <>
          <button
            onClick={onBackToInstances}
            className="hidden md:flex items-center gap-1 px-2 h-5 mb-1 text-[11px] text-slate-400 hover:text-white hover:bg-slate-800 rounded cursor-pointer flex-shrink-0"
            title="Back to instances picker"
          >
            <ArrowLeft size={11} />
            Instances
          </button>
          <div className="hidden md:block w-px h-3.5 bg-slate-700 mx-0.5 mb-1.5" />
        </>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={openTabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
          <div className="hidden md:flex items-end gap-0.5 overflow-x-auto flex-1 min-w-0">
            {openTabs.map((tab) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onSwitch={onSwitchTab}
                onClose={onCloseTab}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Mobile: current-instance chip + bottom sheet for switching/closing. */}
      {hasTabs && activeTab && (
        <div className="md:hidden relative flex-1 min-w-0">
          <button
            onClick={() => setShowMobileTabs((s) => !s)}
            className="flex items-center gap-2 px-3 h-9 w-full min-w-0 text-sm bg-slate-800 text-white rounded-lg cursor-pointer"
            aria-haspopup="listbox"
            aria-expanded={showMobileTabs}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: activeTab.themeColor || "#14b8a6" }}
            />
            <span className="truncate flex-1 text-left font-medium">{activeTab.name}</span>
            {openTabs.length > 1 && (
              <span className="flex-shrink-0 text-[10px] text-slate-300 px-1.5 py-0.5 rounded bg-slate-700">
                {openTabs.length}
              </span>
            )}
            <ChevronDown size={14} className="flex-shrink-0 opacity-60" />
          </button>

          {showMobileTabs && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/60"
                onClick={() => setShowMobileTabs(false)}
                aria-hidden="true"
              />
              <div
                className="fixed bottom-0 left-0 right-0 z-50 bg-slate-800 rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
                role="listbox"
              >
                {/* Drag handle (visual only — tap backdrop or rows to dismiss) */}
                <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
                  <div className="w-10 h-1 bg-slate-600 rounded-full" />
                </div>
                <div className="px-4 pt-1 pb-2 text-[11px] uppercase tracking-wide text-slate-500 flex-shrink-0">
                  {t("instance_bar.open_instances", { defaultValue: "Open instances" })}
                </div>
                <div className="flex-1 overflow-y-auto">
                  {openTabs.map((tab) => {
                    const isActive = tab.id === activeTabId;
                    return (
                      <div
                        key={tab.id}
                        className={`flex items-center gap-3 px-4 py-3 border-b border-slate-700/50 last:border-b-0 ${
                          isActive ? "bg-slate-700/50" : ""
                        }`}
                      >
                        <button
                          onClick={() => { onSwitchTab(tab.id); setShowMobileTabs(false); }}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer min-h-[44px]"
                          role="option"
                          aria-selected={isActive}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tab.themeColor || "#14b8a6" }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm truncate ${isActive ? "text-white font-semibold" : "text-slate-200"}`}>
                              {tab.name}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">{tab.url}</div>
                          </div>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
                          className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-white hover:bg-slate-700 rounded cursor-pointer flex-shrink-0"
                          title="Close tab"
                          aria-label={`Close ${tab.name}`}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => { onBackToInstances(); setShowMobileTabs(false); }}
                  className="flex items-center gap-3 w-full px-4 py-4 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 border-t border-slate-700 cursor-pointer flex-shrink-0 min-h-[48px]"
                >
                  <ArrowLeft size={16} />
                  {t("instance_bar.all_instances", { defaultValue: "All instances" })}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Global controls — refresh (active tab only), language, feedback, user, logout.
          ml-auto pins the cluster to the right edge on InstancesPage where no
          flex-1 element (mobile chip / desktop tab strip) sits before it. */}
      <div className="flex items-center gap-1 ml-auto flex-shrink-0 md:mb-1">
        {hasTabs && activeTabId != null && (
          <button
            onClick={handleRefreshClick}
            disabled={refreshing}
            className="flex items-center justify-center w-9 h-9 md:w-5 md:h-5 text-slate-300 md:text-slate-400 hover:text-white hover:bg-slate-800 rounded cursor-pointer disabled:cursor-default"
            title={t("instance_bar.refresh_data", { defaultValue: "Refresh data" })}
          >
            <RefreshCw size={16} className={`md:!w-[11px] md:!h-[11px] ${refreshing ? "animate-spin" : ""}`} />
          </button>
        )}
        <Globe size={11} className="hidden md:block text-slate-500" />
        <select
          value={i18n.language}
          onChange={(e) => changeLanguage(e.target.value)}
          className="bg-slate-800 text-slate-300 text-xs md:text-[11px] h-9 md:h-5 px-2 md:px-1 rounded border-none outline-none cursor-pointer hover:bg-slate-700"
        >
          <option value="nl">NL</option>
          <option value="en">EN</option>
          <option value="de">DE</option>
        </select>

        <button
          onClick={() => setShowFeedback(true)}
          className="hidden md:flex items-center gap-1 px-1.5 h-5 text-[11px] text-slate-400 hover:text-white hover:bg-slate-800 rounded cursor-pointer"
          title={t("instance_bar.feedback_title", { defaultValue: "Send feedback" })}
        >
          <MessageSquarePlus size={11} />
          <span className="hidden sm:inline">{t("instance_bar.feedback", { defaultValue: "Feedback" })}</span>
        </button>

        <div className="hidden md:block w-px h-4 bg-slate-700 mx-0.5" />

        {!localVaultMode && (
          <span className="hidden md:inline text-[11px] text-slate-400 max-w-[140px] truncate" title={yAppUser.email}>
            {yAppUser.email}
          </span>
        )}

        <button
          onClick={handleLogoutClick}
          className="hidden md:flex items-center justify-center px-1.5 h-5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded cursor-pointer"
          title={localVaultMode
            ? t("instance_bar.lock_vault", { defaultValue: "Lock vault" })
            : t("instance_bar.logout", { defaultValue: "Sign out" })}
        >
          {localVaultMode ? <Lock size={11} /> : <LogOut size={11} />}
        </button>

        {/* Mobile-only avatar popover holding email + Feedback + Logout. */}
        <div className="md:hidden relative">
          <button
            onClick={() => setShowAccountMenu((s) => !s)}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-y-teal text-white text-sm font-bold cursor-pointer hover:opacity-90"
            aria-haspopup="menu"
            aria-expanded={showAccountMenu}
            title={yAppUser.email}
          >
            {userInitial}
          </button>
          {showAccountMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowAccountMenu(false)}
              />
              <div
                className="absolute right-0 top-11 z-50 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden"
                role="menu"
              >
                <div className="px-3 py-2.5 border-b border-slate-700">
                  {localVaultMode ? (
                    <>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                        {t("instance_bar.local_vault_label", { defaultValue: "Vault" })}
                      </div>
                      <div className="text-xs text-white">
                        {t("instance_bar.local_vault_value", { defaultValue: "Local — no Y-app account" })}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                        {t("instance_bar.signed_in_as", { defaultValue: "Signed in as" })}
                      </div>
                      <div className="text-xs text-white truncate" title={yAppUser.email}>
                        {yAppUser.email}
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => { setShowAccountMenu(false); setShowFeedback(true); }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-slate-300 hover:text-white hover:bg-slate-700/50 cursor-pointer"
                  role="menuitem"
                >
                  <MessageSquarePlus size={13} />
                  {t("instance_bar.feedback", { defaultValue: "Feedback" })}
                </button>
                {localVaultMode && onChangeVaultPassword && (
                  <button
                    onClick={() => { setShowAccountMenu(false); onChangeVaultPassword(); }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-slate-300 hover:text-white hover:bg-slate-700/50 cursor-pointer border-t border-slate-700/50"
                    role="menuitem"
                  >
                    <KeyRound size={13} />
                    {t("instance_bar.change_vault_password", { defaultValue: "Change vault password" })}
                  </button>
                )}
                <button
                  onClick={() => { setShowAccountMenu(false); handleLogoutClick(); }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-slate-300 hover:text-red-400 hover:bg-slate-700/50 border-t border-slate-700/50 cursor-pointer"
                  role="menuitem"
                >
                  {localVaultMode ? <Lock size={13} /> : <LogOut size={13} />}
                  {localVaultMode
                    ? t("instance_bar.lock_vault", { defaultValue: "Lock vault" })
                    : t("instance_bar.logout", { defaultValue: "Sign out" })}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Feedback Modal — opens a prefilled GitHub issue */}
      {showFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowFeedback(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">{t("instance_bar.feedback_title", { defaultValue: "Send feedback" })}</h3>
            <p className="text-xs text-slate-500">
              {t("instance_bar.feedback_description_prefix", { defaultValue: "Opens a new issue on" })} <span className="font-mono">OpenAEC-Foundation/y-app</span>.
              {" "}{t("instance_bar.feedback_github_needed", { defaultValue: "You need a GitHub account." })}
            </p>

            <div className="flex gap-2">
              {(["bug", "feature", "question"] as const).map((fbTypeOption) => (
                <button
                  key={fbTypeOption}
                  onClick={() => setFbType(fbTypeOption)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border transition-colors ${
                    fbType === fbTypeOption
                      ? "bg-y-teal text-white border-y-teal"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  {fbTypeOption === "bug" ? t("component_instance_bar.type_bug", { defaultValue: "Bug" }) : fbTypeOption === "feature" ? t("component_instance_bar.type_feature", { defaultValue: "Feature" }) : t("instance_bar.feedback_type_question", { defaultValue: "Question" })}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("instance_bar.feedback_title_label", { defaultValue: "Title *" })}</label>
              <input
                type="text"
                value={fbTitle}
                onChange={(e) => setFbTitle(e.target.value)}
                placeholder={t("instance_bar.feedback_title_placeholder", { defaultValue: "Short summary..." })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("instance_bar.feedback_description_label", { defaultValue: "Description" })}</label>
              <textarea
                value={fbBody}
                onChange={(e) => setFbBody(e.target.value)}
                placeholder={t("instance_bar.feedback_description_placeholder", { defaultValue: "What went wrong, or what would you like to see?" })}
                rows={5}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setShowFeedback(false); setFbTitle(""); setFbBody(""); }}
                className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                onClick={() => {
                  const labels = fbType === "bug" ? "bug" : fbType === "feature" ? "enhancement" : "question";
                  const prefix = fbType === "bug" ? "[Bug] " : fbType === "feature" ? "[Feature] " : t("instance_bar.github_prefix_question", { defaultValue: "[Question] " });
                  const meta = `\n\n---\n*${new Date().toLocaleDateString("nl-NL")}*`;
                  const body = (fbBody || "") + meta;
                  const url = new URL("https://github.com/OpenAEC-Foundation/y-app/issues/new");
                  url.searchParams.set("title", prefix + fbTitle);
                  url.searchParams.set("body", body);
                  url.searchParams.set("labels", labels);
                  window.open(url.toString(), "_blank");
                  setShowFeedback(false);
                  setFbTitle("");
                  setFbBody("");
                }}
                disabled={!fbTitle.trim()}
                className="px-4 py-2 text-sm text-white bg-y-teal rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer"
              >
                {t("instance_bar.open_on_github", { defaultValue: "Open on GitHub" })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
