// Signed URLs stay in memory; logs contain only role, attempt and status.
export async function putReviewedAsset(
  url,
  headers,
  bytes,
  role,
  options = {},
) {
  let target;
  try {
    target = new URL(url);
  } catch {
    throw Error("Invalid S3 upload URL");
  }
  if (
    target.protocol !== "https:" ||
    !(
      target.hostname === "storage.yandexcloud.net" ||
      target.hostname.endsWith(".storage.yandexcloud.net")
    )
  )
    throw Error("Upload destination is not Yandex Object Storage");
  const fetcher = options.fetch ?? globalThis.fetch;
  const delay =
    options.delay ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const log = options.log ?? console.log;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetcher(target, {
        method: "PUT",
        headers: { ...headers, "Content-Length": String(bytes.length) },
        body: bytes,
        redirect: "error",
        signal: AbortSignal.timeout(45000),
      });
      await response.body?.cancel();
      log("S3_PUT", role, attempt + 1, response.status);
      if (response.ok) return;
      if (![408, 429, 500, 502, 503, 504].includes(response.status))
        throw Error("Non-transient S3 status " + response.status);
    } catch (error) {
      const retryable =
        error.name === "TimeoutError" ||
        ["UND_ERR_SOCKET", "ECONNRESET", "ETIMEDOUT"].includes(
          error.cause?.code,
        );
      if (!retryable)
        throw Error(
          /^Non-transient S3 status \d{3}$/.test(error.message)
            ? error.message
            : "S3 transfer failed for " + role,
        );
      log("S3_RETRY", role, attempt + 1, error.name);
    }
    if (attempt < 3) await delay(2000 * 2 ** attempt);
  }
  throw Error("S3 unavailable after four attempts for " + role);
}
