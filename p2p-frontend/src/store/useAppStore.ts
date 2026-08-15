import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";

export interface AuthUser {
  name: string;
  email: string;
  role: string;
  initials: string;
}

interface AppState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLaunching: boolean;
  /** False until Supabase's real session state has been confirmed at least
   * once (its INITIAL_SESSION event). Route guards wait on this so a stale
   * persisted isAuthenticated (e.g. token expired elsewhere) can't briefly
   * render protected routes before being corrected. */
  authReady: boolean;
  /** True once the real DB-backed role has been fetched from /users/me —
   * the role on `user` right after sign-in is a placeholder ("Procurement
   * Lead") until this resolves, so role-based redirects must wait on it
   * rather than acting on the placeholder. */
  roleReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  finishLaunch: () => void;
  /** Called once at app boot to sync with any existing Supabase session
   * (e.g. after a reload) and to keep the store in sync with sign-outs
   * that happen elsewhere (token expiry, etc). */
  initAuthListener: () => void;
}

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "U";
}

function userFromSession(session: Session): AuthUser {
  const meta = session.user.user_metadata as { name?: string };
  const email = session.user.email ?? "";
  const name = meta.name || email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { name, email, role: "Procurement Lead", initials: initialsFrom(name) };
}

let listenerStarted = false;

/** Fetches the real DB-backed role and folds it into `user.role`, replacing
 * the userFromSession() placeholder. Best-effort — if it fails (network
 * blip), roleReady still flips so callers waiting on it don't hang forever;
 * the placeholder role just stays in place until the next successful call. */
async function refreshRole(set: (partial: Partial<AppState>) => void, get: () => AppState) {
  try {
    const me = await api.get<{ role: string }>("/users/me");
    const current = get().user;
    if (current) set({ user: { ...current, role: me.role } });
  } catch {
    // best-effort — see docstring
  } finally {
    set({ roleReady: true });
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      // Never persisted (see partialize below) — a reload should never
      // replay the launch animation, only a fresh sign-in should.
      isLaunching: false,
      // Also never persisted — every fresh page load must reconfirm the
      // real session before route guards trust isAuthenticated.
      authReady: false,
      roleReady: false,

      login: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.session) throw new Error("Sign-in succeeded but no session was returned");
        set({ user: userFromSession(data.session), isAuthenticated: true, isLaunching: true, roleReady: false });
        await refreshRole(set, get);
      },

      signup: async (name, email, password) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) throw error;
        if (!data.session) {
          // Email confirmation is required by the Supabase project — there is
          // no session yet. Surface this distinctly so the UI can tell the
          // user to check their inbox instead of silently doing nothing.
          throw new Error("EMAIL_CONFIRMATION_REQUIRED");
        }
        set({ user: userFromSession(data.session), isAuthenticated: true, isLaunching: true, roleReady: false });
        await refreshRole(set, get);
      },

      logout: async () => {
        await supabase.auth.signOut();
        set({ user: null, isAuthenticated: false, isLaunching: false, roleReady: false });
      },

      finishLaunch: () => set({ isLaunching: false }),

      initAuthListener: () => {
        if (listenerStarted) return;
        listenerStarted = true;

        // authReady must be resolved from a direct getSession() read, not
        // only from the onAuthStateChange callback below. That callback is
        // the sole thing that used to set it, so whenever its initial event
        // didn't reach us (StrictMode's double-invoke means the second
        // initAuthListener() call returns early at the guard above, and the
        // first subscription's INITIAL_SESSION can fire before React
        // commits), authReady stayed false forever — every route guard
        // returns null while !authReady, so the entire app rendered as a
        // permanently blank page on any full load. This is unconditional
        // and idempotent, so authReady always resolves.
        void supabase.auth.getSession().then(({ data }) => {
          const current = get();
          if (data.session) {
            const sameUser = current.isAuthenticated && current.user?.email === data.session.user.email;
            if (sameUser) {
              // Persisted user is still correct — don't rebuild it (that
              // churn is what blanked pages on tab switch). Just unblock the
              // guards and refresh the role in the background.
              set({ authReady: true });
              void refreshRole(set, get);
            } else {
              set({ user: userFromSession(data.session), isAuthenticated: true, authReady: true, roleReady: false });
              void refreshRole(set, get);
            }
          } else {
            set({ user: null, isAuthenticated: false, authReady: true, roleReady: false, isLaunching: false });
          }
        });

        supabase.auth.onAuthStateChange((_event, session) => {
          // Supabase re-validates the session whenever the tab regains
          // visibility and re-emits an auth event (SIGNED_IN as well as
          // TOKEN_REFRESHED) even though nothing actually changed. Rebuilding
          // `user` and resetting roleReady on those was blanking the whole
          // app on every tab switch: the route guards render null while
          // !roleReady, so the entire authenticated tree unmounted until
          // /users/me came back, then remounted from scratch — losing all
          // page state. Bail out when it's the same user we already have.
          const current = get();
          if (session && current.isAuthenticated && current.user?.email === session.user.email) return;

          if (session) {
            set({ user: userFromSession(session), isAuthenticated: true, authReady: true, roleReady: false });
            void refreshRole(set, get);
          } else {
            set({
              user: null,
              isAuthenticated: false,
              authReady: true,
              roleReady: false,
              // A session that was previously "launching" but turns out to
              // be gone shouldn't leave the launch overlay stuck active.
              isLaunching: get().isAuthenticated ? false : get().isLaunching,
            });
          }
        });
      },
    }),
    {
      name: "p2p-session",
      // sessionStorage: survives reloads within the tab, clears when the
      // browser/tab is actually closed — unlike localStorage, which would
      // keep the session alive indefinitely. Supabase's own client persists
      // the actual auth token separately (localStorage, its default); this
      // partialize only mirrors UI-facing user/auth display state.
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
