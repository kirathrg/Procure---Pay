import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowUp, Loader2, Mic, Square } from "lucide-react";
import { SummaryCard } from "../components/requisition/SummaryCard";
import { ItemSuggestions } from "../components/requisition/ItemSuggestions";
import {
  useCreateRequisitionSession,
  useRequisitionSession,
  useSendRequisitionMessage,
  useTranscribeAudio,
} from "../hooks/useRequisition";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useProducts } from "../hooks/useCatalog";
import { applySuggestion, currentWordAt, suggestProducts } from "../lib/itemAutocomplete";
import { cn } from "../lib/cn";
import type { ChatMessage, RequisitionSlot } from "../types";

const OPENING_MESSAGE = "What do you need sourced?";
const SESSION_STORAGE_KEY = "p2p-requisition-session-id";

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-text-faint"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

export default function Requisition() {
  const navigate = useNavigate();
  // Persisted (not plain useState) so an in-progress conversation survives
  // navigating to another page and back, or a reload — this component fully
  // unmounts on route change, which was silently discarding the whole chat
  // (and orphaning its backend session) any time a PO hadn't been created
  // yet. Cleared once routing to Sourcing actually happens (see handleSend)
  // — from that point the PO itself, not the chat, is what's resumed.
  const [sessionId, setSessionIdState] = useState<string | null>(() => sessionStorage.getItem(SESSION_STORAGE_KEY));
  function setSessionId(id: string | null) {
    setSessionIdState(id);
    if (id) sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }

  const [messages, setMessages] = useState<ChatMessage[]>([{ id: "opening", role: "assistant", content: OPENING_MESSAGE }]);
  const [restoringSession, setRestoringSession] = useState(() => !!sessionStorage.getItem(SESSION_STORAGE_KEY));
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const createSession = useCreateRequisitionSession();
  const sendMessage = useSendRequisitionMessage();
  const { data: products = [] } = useProducts();
  const productNames = useMemo(() => products.map((p) => p.name), [products]);

  // The session id that was already persisted when this component mounted
  // (frozen in a ref, computed once) — this is the ONLY id the restore path
  // is allowed to act on. `sessionId` itself changes during completely
  // normal use (handleSend creates a brand-new session on the first message
  // of a fresh conversation and calls setSessionId), and a naive "restore
  // whenever sessionId changes and hasn't been restored yet" effect can't
  // tell that apart from an actual page-load restore — it ends up firing for
  // the freshly-created session too, and once that session's own history
  // query resolves it can race behind the real handleSend response and
  // stomp it with a stale snapshot (confirmed live: answering a question,
  // then having this fire and revert the whole conversation and summary
  // card). Scoping to the id present at mount closes that off entirely.
  const [sessionIdToRestore] = useState(() => sessionStorage.getItem(SESSION_STORAGE_KEY));
  const restoredSession = useRequisitionSession(sessionIdToRestore);
  useEffect(() => {
    if (!sessionIdToRestore) return;
    if (restoredSession.data) {
      if (restoredSession.data.status === "routed") {
        setSessionId(null);
        setMessages([{ id: "opening", role: "assistant", content: OPENING_MESSAGE }]);
      } else {
        setMessages(restoredSession.data.messages);
      }
      setRestoringSession(false);
    } else if (restoredSession.isError) {
      setSessionId(null);
      setRestoringSession(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoredSession.data, restoredSession.isError, sessionIdToRestore]);

  const recorder = useAudioRecorder();
  const transcribeAudio = useTranscribeAudio();

  // Autocomplete for the item being typed (e.g. "led" -> "LED Desk Lamp") —
  // tracked against the word run at the cursor, not the whole message.
  const [activeWord, setActiveWord] = useState("");
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const suggestions = useMemo(() => {
    // Once the whole typed message already exactly matches a real catalog
    // product name, there's nothing left to complete — showing a suggestion
    // here was a real bug: it suggests based on the trailing word only (e.g.
    // "TB" out of "External SSD 1TB"), so accepting it via Enter spliced the
    // FULL product name in place of just that trailing word, duplicating the
    // whole prefix ("External SSD 1" + "External SSD 1TB"). It also meant
    // Enter never sent the message at all — it just re-inserted the same
    // (now corrupted) text into the box.
    const trimmed = input.trim().toLowerCase();
    if (productNames.some((name) => name.toLowerCase() === trimmed)) return [];
    return suggestProducts(activeWord, productNames);
  }, [activeWord, productNames, input]);

  // Catalog suggestions only make sense while the assistant is asking what's
  // needed — the exact same fixed question every time (see the backend's
  // OPENING_MESSAGE/_NEXT_QUESTION), so matching it verbatim is a reliable
  // signal without needing the backend to say so explicitly.
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const isAskingForItem = lastAssistantMessage?.content === OPENING_MESSAGE;

  async function handleMicClick() {
    if (recorder.isRecording) {
      const blob = await recorder.stop();
      if (!blob) return;
      try {
        // Transcribed text replaces the composer outright (not appended) —
        // review/editing happens before sending, never sent automatically.
        const { text } = await transcribeAudio.mutateAsync(blob);
        setInput(text);
        if (isAskingForItem) {
          // Treat the whole transcribed phrase as the "word" to replace, so
          // picking a suggestion swaps the entire spoken item name for the
          // matched product rather than just its trailing word.
          setActiveWord(text);
          setSuggestionIndex(0);
        }
        // Explicitly place the cursor at the end rather than relying on
        // focus() alone — selectSuggestion() reads selectionStart to know
        // where "the whole transcribed phrase" ends.
        requestAnimationFrame(() => {
          const el = textareaRef.current;
          el?.focus();
          el?.setSelectionRange(text.length, text.length);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't transcribe that recording. Try again.");
      }
    } else {
      recorder.start();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    setActiveWord(currentWordAt(e.target.value, e.target.selectionStart ?? e.target.value.length));
    setSuggestionIndex(0);
  }

  function selectSuggestion(name: string) {
    const el = textareaRef.current;
    const cursor = el?.selectionStart ?? input.length;
    const { text, cursor: newCursor } = applySuggestion(input, cursor, activeWord, name);
    setInput(text);
    setActiveWord("");
    // Restore focus + cursor after the state update repaints the textarea.
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(newCursor, newCursor);
    });
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sendMessage.isPending]);

  useEffect(() => {
    if (recorder.error) setError(recorder.error);
  }, [recorder.error]);

  // Elapsed recording time, shown in the recording banner so it's obvious
  // at a glance that the mic actually picked up the click.
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  useEffect(() => {
    if (!recorder.isRecording) {
      setRecordingSeconds(0);
      return;
    }
    const start = Date.now();
    const id = window.setInterval(() => setRecordingSeconds(Math.floor((Date.now() - start) / 1000)), 250);
    return () => window.clearInterval(id);
  }, [recorder.isRecording]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sendMessage.isPending || createSession.isPending) return;
    setInput("");
    setActiveWord("");
    setError(null);

    // Optimistically show the user's message immediately.
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: text }]);

    try {
      let activeSessionId = sessionId;
      if (!activeSessionId) {
        const session = await createSession.mutateAsync();
        activeSessionId = session.id;
        setSessionId(session.id);
      }

      const result = await sendMessage.mutateAsync({ sessionId: activeSessionId, content: text });
      // Re-sync from the server's canonical message list (includes the
      // Gemini-extracted slots on the assistant reply) rather than trusting
      // local optimistic state past this point.
      setMessages(result.session.messages);

      if (result.session.status === "routed" && result.session.poId) {
        // The conversation's job is done once a real PO exists — stop
        // persisting it so the next visit to this page starts a fresh
        // requisition instead of trying to resume a finished one.
        setSessionId(null);
        // Follow this specific requisition's PO, not "whichever one happens
        // to be open" — Sourcing reads ?po= directly when present.
        setTimeout(() => navigate(`/sourcing?po=${result.session.poId}`), 1100);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }
  }

  const isEmpty = messages.length === 1;
  const isBusy = createSession.isPending || sendMessage.isPending;
  // Accumulate slots across the whole conversation (the backend does the
  // same for routing) so the panel reflects everything captured so far, not
  // just whatever the most recent turn happened to extract.
  const accumulatedSlots = useMemo(() => {
    const byKey = new Map<string, RequisitionSlot>();
    for (const m of messages) {
      for (const slot of m.slots ?? []) {
        byKey.set(slot.key, slot);
      }
    }
    return Array.from(byKey.values());
  }, [messages]);
  const isRouted = sendMessage.data?.session.status === "routed";

  const recordingLabel = `${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, "0")}`;

  const composer = (
    <div className="relative">
      <AnimatePresence>
        {recorder.isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger-dim px-3.5 py-2.5"
          >
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <motion.span
                  animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full bg-danger"
                />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-danger" />
              </span>
              <span className="text-[13px] font-medium text-danger">Recording…</span>
              <span className="font-tabular text-[12px] text-danger/80">{recordingLabel}</span>
            </div>
            <button
              type="button"
              onClick={handleMicClick}
              className="flex items-center gap-1.5 rounded-md bg-danger px-2.5 py-1.5 text-[12px] font-medium text-white transition-colors duration-150 ease-out hover:bg-danger/90"
            >
              <Square className="h-3 w-3" strokeWidth={2} fill="currentColor" />
              Stop recording
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex items-end gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 focus-within:border-border-strong">
        <ItemSuggestions suggestions={suggestions} activeIndex={suggestionIndex} onSelect={selectSuggestion} />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (suggestions.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSuggestionIndex((i) => (i + 1) % suggestions.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSuggestionIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
                return;
              }
              if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
                e.preventDefault();
                selectSuggestion(suggestions[suggestionIndex]);
                return;
              }
              if (e.key === "Escape") {
                setActiveWord("");
                return;
              }
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          onBlur={() => setActiveWord("")}
          rows={1}
          autoFocus
          disabled={isBusy || isRouted}
          placeholder={
            isEmpty
              ? "e.g. need about 50 chairs for the Chennai office, fairly urgent…"
              : "Message the assistant…"
          }
          className="max-h-32 flex-1 resize-none bg-transparent text-[14px] text-text placeholder:text-text-faint focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isBusy || isRouted}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-white transition-colors duration-150 ease-out enabled:hover:bg-primary-hover disabled:opacity-30"
          aria-label="Send"
        >
          <ArrowUp className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={handleMicClick}
          disabled={transcribeAudio.isPending || isBusy || isRouted}
          className={cn(
            "relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-40",
            recorder.isRecording ? "text-danger" : "text-text-faint hover:text-text-dim",
          )}
          aria-label={recorder.isRecording ? "Stop recording" : "Voice input"}
          title={recorder.isRecording ? "Stop recording" : "Voice input"}
        >
          {recorder.isRecording ? (
            <Square className="relative h-3.5 w-3.5" strokeWidth={1.75} fill="currentColor" />
          ) : transcribeAudio.isPending ? (
            <Loader2 className="relative h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
          ) : (
            <Mic className="relative h-4 w-4" strokeWidth={1.75} />
          )}
        </button>
      </div>
    </div>
  );

  if (restoringSession) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-[12px] text-text-faint">Resuming your requisition…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-5xl gap-6 px-6">
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto py-10">
          {isEmpty && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="flex h-[60vh] flex-col items-center justify-center text-center"
            >
              <p className="font-heading text-[22px] font-medium tracking-tight text-text">
                What do you need sourced?
              </p>
              <p className="mt-2 text-[13px] text-text-faint">
                Describe it naturally — item, rough quantity, timing. No forms.
              </p>
              <div className="mt-6 w-full max-w-lg">{composer}</div>
            </motion.div>
          )}

          {messages.length > 1 &&
            messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[80%] rounded-lg bg-overlay/[0.07] px-3.5 py-2 text-[14px] text-text"
                      : "max-w-[85%] text-[14px] leading-relaxed text-text"
                  }
                >
                  {m.content}
                </div>
              </motion.div>
            ))}

          {isBusy && (
            <div className="flex justify-start">
              <TypingDots />
            </div>
          )}

          {error && (
            <p className="text-center text-[12px] text-danger">{error}</p>
          )}
        </div>

        {!isEmpty && (
          <div className="sticky bottom-0 border-t border-border bg-surface pb-6 pt-4">
            {composer}
            <AnimatePresence>
              {accumulatedSlots.length > 0 && !isRouted && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-2 text-center text-[11px] text-text-faint"
                >
                  No submit button needed — just reply "yes, go ahead" to proceed.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Live summary panel — separate from the chat column so it reads as
          persistent state, not something the assistant "said". Visible as
          soon as the conversation starts (not just after the first slot is
          captured) so the full question sequence is clear from turn one. */}
      <AnimatePresence>
        {!isEmpty && (
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="hidden w-72 shrink-0 py-10 lg:block"
          >
            <div className="sticky top-10">
              <SummaryCard slots={accumulatedSlots} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
