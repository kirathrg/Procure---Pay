import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { ChatMessage } from "../types";

interface RequisitionSession {
  id: string;
  status: "active" | "confirmed" | "routed";
  messages: ChatMessage[];
  poId: string | null;
}

interface SendMessageResponse {
  session: RequisitionSession;
  readyToConfirm: boolean;
  poNumber: string | null;
  /** Set when status is "routed" but no PO could be created — the item
   * didn't match a catalog product, or no supplier is linked to it. */
  routingFailureReason: string | null;
}

export function useCreateRequisitionSession() {
  return useMutation({
    mutationFn: () => api.post<RequisitionSession>("/requisition/sessions", {}),
  });
}

/** Restores an in-progress session's message history — used to survive
 * navigating away from the Requisition page (or reloading it) before a PO
 * has been created, since the conversation itself lives only in component
 * state otherwise. `enabled: !!sessionId` so this stays idle until a real
 * session exists (either just-created or restored from storage).
 *
 * This is a one-shot resume, not a live subscription — the caller applies
 * its result exactly once and then owns the conversation entirely via local
 * state (each new turn is appended locally / from the send-message
 * response). Refetch triggers are all disabled: an automatic background
 * refetch returning a stale-relative-to-local-state snapshot has nothing
 * useful to do here and previously caused an in-progress conversation to
 * revert mid-chat when the query happened to refire. */
export function useRequisitionSession(sessionId: string | null) {
  return useQuery({
    queryKey: ["requisitionSessions", sessionId],
    queryFn: () => api.get<RequisitionSession>(`/requisition/sessions/${sessionId}`),
    enabled: !!sessionId,
    // A vanished/invalid session id shouldn't retry forever — the caller
    // falls back to starting a fresh conversation instead.
    retry: false,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useSendRequisitionMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, content }: { sessionId: string; content: string }) =>
      api.post<SendMessageResponse>(`/requisition/sessions/${sessionId}/messages`, { content }),
    onSuccess: (data) => {
      if (data.session.poId) {
        queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
      }
    },
  });
}

export function useTranscribeAudio() {
  return useMutation({
    mutationFn: (audio: Blob) => {
      const formData = new FormData();
      formData.append("file", audio, "recording.webm");
      return api.postForm<{ text: string }>("/requisition/transcribe", formData);
    },
  });
}

export type { RequisitionSession, SendMessageResponse };
