import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import type { SheetData } from "./domain";
import { cacheTab, dequeue, enqueue, getQueue, readCachedTab } from "./offline";
import { loadTab, saveEntry } from "./sheets.functions";

export function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function usePendingCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const read = () => setCount(getQueue().length);
    read();
    window.addEventListener("rmb-queue-change", read);
    window.addEventListener("online", read);
    return () => {
      window.removeEventListener("rmb-queue-change", read);
      window.removeEventListener("online", read);
    };
  }, []);
  return count;
}

export function useSheetTab(tab: string) {
  const query = useQuery({
    queryKey: ["sheet", tab],
    queryFn: async () => {
      const data = await loadTab({ data: { tab } });
      cacheTab(tab, data);
      return data;
    },
    staleTime: 30_000,
    retry: 1,
  });

  const cached = readCachedTab<SheetData>(tab);
  return {
    ...query,
    data: query.data ?? cached ?? undefined,
    usingCache: !query.data && !!cached,
  };
}

export function useSaveEntry(tab: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { dateText: string; values: Record<string, number> }) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueue({ tab, ...input });
        return { queued: true as const };
      }
      try {
        await saveEntry({ data: { tab, ...input } });
        return { queued: false as const };
      } catch (err) {
        enqueue({ tab, ...input });
        throw err;
      }
    },
    onSuccess: (res) => {
      if (res.queued) toast.success("Saved offline — will sync when you're back online");
      else toast.success("Synced to Google Sheets");
      void qc.invalidateQueries({ queryKey: ["sheet", tab] });
    },
    onError: () => {
      toast.error("Couldn't reach Google Sheets — entry saved locally and queued");
    },
  });
}

/** Flushes locally queued entries once connectivity returns. */
export function useQueueSync() {
  const qc = useQueryClient();

  const flush = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.onLine) return;
    const queue = getQueue();
    if (queue.length === 0) return;
    let synced = 0;
    for (const item of queue) {
      try {
        await saveEntry({
          data: { tab: item.tab, dateText: item.dateText, values: item.values },
        });
        dequeue(item.id);
        synced++;
      } catch {
        break;
      }
    }
    if (synced > 0) {
      toast.success(`Synced ${synced} offline ${synced === 1 ? "entry" : "entries"}`);
      void qc.invalidateQueries({ queryKey: ["sheet"] });
    }
  }, [qc]);

  useEffect(() => {
    void flush();
    window.addEventListener("online", flush);
    const id = window.setInterval(() => void flush(), 60_000);
    return () => {
      window.removeEventListener("online", flush);
      window.clearInterval(id);
    };
  }, [flush]);

  return flush;
}
