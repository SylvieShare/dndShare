import test from "node:test";
import assert from "node:assert/strict";
import { putReviewedAsset } from "./toxic_sewer_upload.mjs";

test("timeouts stop after four attempts and malformed URLs are sanitized", async () => {
  let calls = 0;
  await assert.rejects(
    putReviewedAsset(
      "https://storage.yandexcloud.net/temp",
      {},
      Buffer.from("x"),
      "lod",
      {
        fetch: async () => {
          calls++;
          throw new DOMException("expired", "TimeoutError");
        },
        delay: async () => {},
        log: () => {},
      },
    ),
    /after four attempts/,
  );
  assert.equal(calls, 4);
  await assert.rejects(
    putReviewedAsset(
      "https://[ private signed token",
      {},
      Buffer.from("x"),
      "lod",
    ),
    (error) =>
      error.message === "Invalid S3 upload URL" && !error.input && !error.cause,
  );
});

test("transient S3 errors resend identical bytes without logging signed URLs", async () => {
  const bytes = Buffer.from("reviewed-model"),
    requests = [],
    logs = [];
  await putReviewedAsset(
    "https://storage.yandexcloud.net/bucket/temp?signature=private",
    { "Content-Type": "model/gltf-binary" },
    bytes,
    "lod",
    {
      fetch: async (url, request) => {
        requests.push({ url: String(url), request });
        return new Response(null, { status: requests.length < 3 ? 503 : 200 });
      },
      delay: async () => {},
      log: (...args) => logs.push(args.join(" ")),
    },
  );
  assert.equal(requests.length, 3);
  for (const { request } of requests) {
    assert.equal(request.body, bytes);
    assert.equal(request.headers["Content-Length"], String(bytes.length));
    assert.equal(request.redirect, "error");
  }
  assert(!logs.join("\n").includes("private"));
});

test("authorization errors are not retried and foreign upload hosts are rejected", async () => {
  let calls = 0;
  const options = {
    fetch: async () => {
      calls++;
      return new Response(null, { status: 403 });
    },
    delay: async () => {},
    log: () => {},
  };
  await assert.rejects(
    putReviewedAsset(
      "https://storage.yandexcloud.net/temp",
      {},
      Buffer.from("x"),
      "render",
      options,
    ),
    /Non-transient S3 status 403/,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    putReviewedAsset(
      "https://example.com/temp",
      {},
      Buffer.from("x"),
      "render",
      options,
    ),
    /not Yandex/,
  );
  assert.equal(calls, 1);
});
