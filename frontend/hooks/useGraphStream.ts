"use client";

import { useEffect, useRef, useState } from "react";

import { WS_URL } from "@/lib/api";
import { EVENT_NEW_NODE, type NewNodeEvent } from "@/lib/types";

type NewNodeHandler = (payload: NewNodeEvent["payload"]) => void;

const RETRY_DELAY_MS = 2000;

/**
 * Subscribes to live graph mutations.
 *
 * The handler is held in a ref so the socket is opened exactly once and
 * survives every parent re-render — resubscribing on each render would tear
 * down and rebuild the connection continuously.
 */
export function useGraphStream(onNewNode: NewNodeHandler): boolean {
  const handler = useRef(onNewNode);
  handler.current = onNewNode;

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const connect = () => {
      socket = new WebSocket(WS_URL);

      socket.onopen = () => setConnected(true);

      socket.onmessage = (event: MessageEvent<string>) => {
        try {
          const message = JSON.parse(event.data) as NewNodeEvent;
          if (message.event === EVENT_NEW_NODE) {
            handler.current(message.payload);
          }
        } catch {
          // A malformed frame must never take the canvas down.
        }
      };

      socket.onclose = () => {
        setConnected(false);
        if (!disposed) retry = setTimeout(connect, RETRY_DELAY_MS);
      };

      // Let onclose drive reconnection so a failure isn't retried twice.
      socket.onerror = () => socket?.close();
    };

    connect();

    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, []);

  return connected;
}
