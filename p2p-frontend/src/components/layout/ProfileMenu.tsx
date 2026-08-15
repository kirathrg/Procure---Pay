import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useNavigate } from "react-router-dom";
import { LogOut, ShieldCheck, User } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";

export function ProfileMenu() {
  const { user, logout } = useAppStore();
  const navigate = useNavigate();

  if (!user) return null;

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-full bg-overlay/[0.08] font-tabular text-[11px] font-medium text-text transition-colors duration-150 ease-out hover:bg-overlay/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label="Account menu"
        >
          {user.initials}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="surface-panel z-50 w-60 origin-top-right overflow-hidden rounded-lg border border-border-strong bg-surface-raised shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-[opacity,transform] duration-150 ease-out data-[state=closed]:pointer-events-none data-[state=closed]:scale-95 data-[state=closed]:opacity-0 data-[state=open]:scale-100 data-[state=open]:opacity-100"
        >
          <div className="relative flex items-center gap-2.5 border-b border-border px-3.5 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-dim font-tabular text-[12px] font-medium text-primary">
              {user.initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-text">{user.name}</p>
              <p className="truncate text-[11px] text-text-faint">{user.email}</p>
            </div>
          </div>

          <div className="relative p-1">
            <DropdownMenu.Item className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] text-text-dim outline-none transition-colors duration-100 data-[highlighted]:bg-overlay/[0.06] data-[highlighted]:text-text">
              <User className="h-3.5 w-3.5" strokeWidth={1.75} />
              {user.role}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => window.open("/manager/login", "_blank", "noopener,noreferrer")}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] text-text-dim outline-none transition-colors duration-100 data-[highlighted]:bg-overlay/[0.06] data-[highlighted]:text-text"
            >
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
              Manager dashboard
            </DropdownMenu.Item>
          </div>

          <div className="relative border-t border-border p-1">
            <DropdownMenu.Item
              onSelect={handleLogout}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] text-danger outline-none transition-colors duration-100 data-[highlighted]:bg-danger-dim"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
              Log out
            </DropdownMenu.Item>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
