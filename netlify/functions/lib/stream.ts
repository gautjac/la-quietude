// An Opus tool call can outlast the synchronous proxy's idle timeout (~26s),
// which returns an unparseable HTML error. We stream NDJSON instead: a bare
// newline heartbeat every 3s keeps the connection alive, then a final JSON line
// carries { result } (or { error }). The client reads to end-of-stream and
// parses the last non-empty line.
export function ndjsonStream<T>(work: () => Promise<T>): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let done = false;
      const beat = setInterval(() => {
        if (!done) {
          try {
            controller.enqueue(enc.encode("\n"));
          } catch {
            /* stream already closed */
          }
        }
      }, 3000);

      try {
        const result = await work();
        done = true;
        clearInterval(beat);
        controller.enqueue(enc.encode(JSON.stringify({ result }) + "\n"));
      } catch (err) {
        done = true;
        clearInterval(beat);
        const message = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(enc.encode(JSON.stringify({ error: message }) + "\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

export const jsonError = (message: string, status = 400) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
