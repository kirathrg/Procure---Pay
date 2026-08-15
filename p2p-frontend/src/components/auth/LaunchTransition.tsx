import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PHASES = ["Verifying credentials", "Provisioning workspace", "Syncing procurement data"];
const PHASE_MS = 480;
const SPLIT_AT_MS = PHASES.length * PHASE_MS;
const REDIRECT_AT_MS = SPLIT_AT_MS + 250; // fire the route swap while panels are still covering the screen
const PANEL_DURATION_MS = 550;

/**
 * Full-screen launch sequence played once after a successful login/signup.
 * Two panels split open from the center, a node graph draws itself in as
 * the system "connects", status text cycles through a short provisioning
 * sequence, then the panels slide fully apart to reveal the app underneath.
 *
 * The route swap (via onComplete -> finishLaunch) is triggered *while the
 * panels are still fully covering the screen*, not when they finish sliding
 * away. That way the new route has already mounted underneath by the time
 * the panels clear, instead of exposing the old /login page for a beat.
 *
 * Rendered above the router's <Routes> in App.tsx (not inside the Login
 * page) so it survives the /login -> / redirect instead of being unmounted
 * mid-animation.
 */
export function LaunchTransition({
  active,
  onComplete,
}: {
  active: boolean;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState(0);
  const [splitting, setSplitting] = useState(false);
  const [visible, setVisible] = useState(false);

  // Drives the whole sequence off of active turning true. Deliberately does
  // NOT reset phase/splitting when active later turns false (that happens
  // partway through, once onComplete has fired) — otherwise the panels snap
  // back to "closed" and the sequence appears to restart right before the
  // overlay unmounts.
  //
  // Background tabs throttle setTimeout heavily (often to once/minute or
  // less) — if the tab/window loses focus mid-sequence, these timers can all
  // fire in a burst once it regains focus, which looked exactly like the
  // whole app "reloading": a blank full-screen overlay suddenly appearing
  // and playing out. Driving everything off a wall-clock deadline (via
  // requestAnimationFrame, which still runs — just not while backgrounded —
  // and self-corrects the instant it resumes) instead of a chain of
  // setTimeout delays means resuming from background jumps straight to
  // wherever the real elapsed time says it should be, rather than replaying
  // a queued-up backlog of stale timer callbacks.
  useEffect(() => {
    if (!active) return;

    setVisible(true);
    setPhase(0);
    setSplitting(false);

    const start = Date.now();
    let rafId: number;
    let done = false;

    function tick() {
      const elapsed = Date.now() - start;

      const currentPhase = Math.min(Math.floor(elapsed / PHASE_MS), PHASES.length - 1);
      setPhase(currentPhase);

      if (elapsed >= SPLIT_AT_MS) setSplitting(true);

      if (!done && elapsed >= REDIRECT_AT_MS) {
        done = true;
        onComplete();
      }

      if (elapsed >= SPLIT_AT_MS + PANEL_DURATION_MS + 350) {
        setVisible(false);
        return;
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
          exit={{ transition: { duration: 0 } }}
        >
          {/* Left panel */}
          <motion.div
            className="absolute inset-y-0 left-0 w-1/2 bg-primary"
            initial={{ x: "-100%" }}
            animate={{ x: splitting ? "-100%" : "0%" }}
            transition={{ duration: splitting ? 0.55 : 0.45, ease: [0.76, 0, 0.24, 1] }}
          />
          {/* Right panel */}
          <motion.div
            className="absolute inset-y-0 right-0 w-1/2 bg-primary"
            initial={{ x: "100%" }}
            animate={{ x: splitting ? "100%" : "0%" }}
            transition={{ duration: splitting ? 0.55 : 0.45, ease: [0.76, 0, 0.24, 1] }}
          />

          {/* Center content */}
          <AnimatePresence>
            {!splitting && (
              <motion.div
                exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.2 } }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              >
                <NodeGraph />

                <div className="flex h-4 items-center">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={phase}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="font-tabular text-[12px] tracking-wide text-white/85"
                    >
                      {PHASES[phase]}…
                    </motion.p>
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Three connected nodes drawing themselves in, echoing the app's logo mark. */
function NodeGraph() {
  const nodes = [
    { cx: 20, cy: 16 },
    { cx: 44, cy: 16 },
    { cx: 32, cy: 38 },
  ];
  const edges = [
    { x1: 20, y1: 16, x2: 44, y2: 16 },
    { x1: 20, y1: 16, x2: 32, y2: 38 },
    { x1: 44, y1: 16, x2: 32, y2: 38 },
  ];

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/25 bg-white/10">
      <svg width="40" height="40" viewBox="0 0 64 48" fill="none">
        {edges.map((e, i) => (
          <motion.line
            key={i}
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke="white"
            strokeWidth="1.5"
            strokeOpacity={0.5}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.15 + i * 0.12, ease: "easeOut" }}
          />
        ))}
        {nodes.map((n, i) => (
          <motion.circle
            key={i}
            cx={n.cx}
            cy={n.cy}
            r={4}
            fill="white"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.3, 1], opacity: 1 }}
            transition={{ duration: 0.35, delay: i * 0.12, ease: "easeOut" }}
          />
        ))}
      </svg>
    </div>
  );
}
