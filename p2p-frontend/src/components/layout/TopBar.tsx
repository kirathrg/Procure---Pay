import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { SearchPalette } from "./SearchPalette";
import { ProfileMenu } from "./ProfileMenu";

function isMac() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/.test(navigator.platform);
}

export function TopBar({ title }: { title: string }) {
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
    <header className="surface-panel flex h-12 shrink-0 items-center justify-between rounded-xl border border-border bg-surface px-4">
      <h1 className="font-heading text-[13px] font-medium tracking-tight text-text">{title}</h1>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-border bg-overlay/[0.04] px-2.5 py-1 text-text-faint transition-colors duration-150 ease-out hover:border-border-strong hover:bg-overlay/[0.06] hover:text-text-dim"
        >
          <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span className="text-[12px]">Search…</span>
          <kbd className="ml-3 rounded-sm border border-border px-1 font-tabular text-[10px] text-text-faint">
            {isMac() ? "⌘F" : "Ctrl+F"}
          </kbd>
        </button>

        <div className="h-4 w-px bg-border" />

        <ProfileMenu />
      </div>

      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
