import { useEffect, useState } from "react";
import { Search, Menu } from "lucide-react";
import { SearchPalette } from "./SearchPalette";
import { ProfileMenu } from "./ProfileMenu";

function isMac() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/.test(navigator.platform);
}

export function TopBar({ title, onMenuClick }: { title: string; onMenuClick?: () => void }) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const metaOrCtrl = isMac() ? e.metaKey : e.ctrlKey;
      if (metaOrCtrl && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="surface-panel flex h-12 shrink-0 items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 md:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={onMenuClick}
          className="-ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-dim transition-colors duration-150 ease-out hover:bg-overlay/[0.06] hover:text-text md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <h1 className="truncate font-heading text-[13px] font-medium tracking-tight text-text">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        {/* Mobile: icon-only search trigger — the full "Search… ⌘F" pill
            doesn't fit next to the hamburger + title on a narrow screen. */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-overlay/[0.04] text-text-faint transition-colors duration-150 ease-out hover:border-border-strong hover:bg-overlay/[0.06] hover:text-text-dim md:hidden"
          aria-label="Search"
        >
          <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
        <button
          onClick={() => setSearchOpen(true)}
          className="hidden items-center gap-1.5 rounded-md border border-border bg-overlay/[0.04] px-2.5 py-1 text-text-faint transition-colors duration-150 ease-out hover:border-border-strong hover:bg-overlay/[0.06] hover:text-text-dim md:flex"
        >
          <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span className="text-[12px]">Search…</span>
          <kbd className="ml-3 rounded-sm border border-border px-1 font-tabular text-[10px] text-text-faint">
            {isMac() ? "⌘F" : "Ctrl+F"}
          </kbd>
        </button>

        <div className="hidden h-4 w-px bg-border md:block" />

        <ProfileMenu />
      </div>

      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
