import { useEffect, useCallback } from "react";
import type { ChatSession } from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "";

function getDeviceId(): string {
  try {
    const stored = localStorage.getItem("punkbot_device_id");
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem("punkbot_device_id", id);
    return id;
  } catch {
    return "unknown";
  }
}

export function useSupabaseSync(
  sessions: ChatSession[],
  setSessions: (sessions: ChatSession[]) => void
) {
  const deviceId = getDeviceId();

  // Carregar sessões do servidor na montagem
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/sessions`, {
          headers: { "x-device-id": deviceId },
        });
        if (!res.ok) return;

        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return;

        const remoteSessions: ChatSession[] = data.map((s: any) => ({
          id: s.id,
          title: s.title,
          messages: (s.messages || []).map((m: any) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            timestamp: m.timestamp,
            isVoice: m.is_voice,
            isPending: false,
          })),
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          deviceId: s.device_id,
          syncStatus: "synced" as const,
        }));

        // Mesclar: servidor tem prioridade (dados mais recentes)
        setSessions(remoteSessions);
      } catch (err) {
        console.warn("⚠️ Erro ao carregar sessões do servidor:", err);
      }
    };

    loadSessions();
  }, [deviceId, setSessions]);

  // Sincronizar sessões com o servidor (título, etc.)
  const syncSave = useCallback(
    async (sessionId?: string) => {
      const targets = sessionId
        ? sessions.filter((s) => s.id === sessionId)
        : sessions;

      for (const session of targets) {
        try {
          await fetch(`${API_BASE}/api/sessions`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "x-device-id": deviceId,
            },
            body: JSON.stringify({
              id: session.id,
              title: session.title,
              createdAt: session.createdAt,
              messages: session.messages.map((m) => ({
                id: m.id,
                role: m.role,
                text: m.text,
                timestamp: m.timestamp,
                isVoice: m.isVoice || false,
              })),
            }),
          });
        } catch (err) {
          console.warn("⚠️ Erro ao sincronizar sessão:", err);
        }
      }
    },
    [sessions, deviceId]
  );

  // Deletar sessão no servidor
  const syncDelete = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
          method: "DELETE",
          headers: { "x-device-id": deviceId },
        });
        if (!res.ok) {
          console.warn("⚠️ Falha ao deletar sessão no servidor:", res.status, res.statusText);
          return false;
        }
        return true;
      } catch (err) {
        console.warn("⚠️ Erro ao deletar sessão:", err);
        return false;
      }
    },
    [deviceId]
  );

  return { syncSave, syncDelete };
}
