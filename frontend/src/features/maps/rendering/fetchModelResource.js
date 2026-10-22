import { modelLoadError } from "../lib/modelLoadError";
// An idle timeout permits slow transfers that are still making progress.
export async function fetchModelResource(
  url,
  { signal, onProgress, json = false, bytes = 0, timeout = 30000 } = {},
) {
  const controller = new AbortController();
  let timer,
    reader,
    timedOut = false;
  const abort = () => {
    controller.abort();
    reader?.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", abort, { once: true });
  const touch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      abort();
    }, timeout);
  };
  try {
    signal?.throwIfAborted();
    touch();
    const response = await fetch(url, { signal: controller.signal });
    touch();
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw Object.assign(
        new Error(payload.desc || `HTTP ${response.status}`),
        { status: response.status },
      );
    }
    const length = Number(response.headers.get("Content-Length")) || 0;
    reader = response.body?.getReader();
    let buffer;
    if (reader) {
      const chunks = [];
      let loaded = 0;
      while (true) {
        const { done, value } = await reader.read();
        touch();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        onProgress?.({
          loaded,
          total:
            bytes || (response.headers.get("Content-Encoding") ? 0 : length),
        });
      }
      buffer = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }
    } else {
      buffer = new Uint8Array(await response.arrayBuffer());
      onProgress?.({
        loaded: buffer.length,
        total: bytes || (response.headers.get("Content-Encoding") ? 0 : length),
      });
    }
    signal?.throwIfAborted();
    if (timedOut) throw new Error("timeout");
    const expected =
      bytes || (!response.headers.get("Content-Encoding") ? length : 0);
    if (expected && expected !== buffer.length)
      throw new Error(
        `Ответ получен не полностью: ${buffer.length} из ${expected} байт`,
      );
    signal?.throwIfAborted();
    return json ? JSON.parse(new TextDecoder().decode(buffer)) : buffer.buffer;
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    throw modelLoadError(
      timedOut
        ? new Error(
            `Сервер не передаёт данные более ${Math.ceil(timeout / 1000)} с`,
          )
        : error,
      { url, stage: json ? "catalogue" : "download" },
    );
  } finally {
    clearTimeout(timer);
    reader?.releaseLock();
    signal?.removeEventListener("abort", abort);
  }
}
