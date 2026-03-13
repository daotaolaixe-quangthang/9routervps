import fs from "fs";
import os from "os";
import path from "path";

describe("API key quota + validity", () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-api-key-test-"));
    process.env.DATA_DIR = tempDir;
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.DATA_DIR;
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("creates API key with default quota fields", async () => {
    const { createApiKey } = await import("../../src/lib/localDb.js");

    const key = await createApiKey("Team A", "machine1234567890");

    expect(key.costLimitUsd).toBeNull();
    expect(key.costUsedUsd).toBe(0);
    expect(key.validFrom).toBeNull();
    expect(key.validUntil).toBeNull();
    expect(key.status).toBe("active");
  });

  it("rejects paused, expired, future, and quota-exceeded keys", async () => {
    const { createApiKey, updateApiKey, validateApiKey } = await import("../../src/lib/localDb.js");

    const base = await createApiKey("Team B", "machine1234567890", { costLimitUsd: 10 });

    await updateApiKey(base.id, { isActive: false });
    await expect(validateApiKey(base.key)).resolves.toMatchObject({ ok: false, code: "inactive", status: 403 });

    await updateApiKey(base.id, { isActive: true, validFrom: new Date(Date.now() + 3600_000).toISOString() });
    await expect(validateApiKey(base.key)).resolves.toMatchObject({ ok: false, code: "not_yet_valid", status: 403 });

    await updateApiKey(base.id, {
      validFrom: new Date(Date.now() - 7200_000).toISOString(),
      validUntil: new Date(Date.now() - 3600_000).toISOString(),
    });
    await expect(validateApiKey(base.key)).resolves.toMatchObject({ ok: false, code: "expired", status: 403 });

    await updateApiKey(base.id, {
      validUntil: null,
      costUsedUsd: 10,
    });
    await expect(validateApiKey(base.key)).resolves.toMatchObject({ ok: false, code: "quota_exceeded", status: 403 });
  });

  it("finalizeApiKeyCost increments usage once per requestId", async () => {
    const { createApiKey, getApiKeyById } = await import("../../src/lib/localDb.js");
    const { finalizeApiKeyCost } = await import("../../src/lib/apiKeyQuota.js");

    const key = await createApiKey("Team C", "machine1234567890", { costLimitUsd: 10 });

    await finalizeApiKeyCost({ apiKey: key.key, costUsd: 1.25, requestId: "req-1" });
    await finalizeApiKeyCost({ apiKey: key.key, costUsd: 1.25, requestId: "req-1" });
    await finalizeApiKeyCost({ apiKey: key.key, costUsd: 2.5, requestId: "req-2" });

    const updated = await getApiKeyById(key.id);
    expect(updated.costUsedUsd).toBe(3.75);
    expect(updated.status).toBe("active");
  });

  it("blocks the next request after usage exceeds the configured cost limit", async () => {
    const { createApiKey, validateApiKey } = await import("../../src/lib/localDb.js");
    const { finalizeApiKeyCost } = await import("../../src/lib/apiKeyQuota.js");

    const key = await createApiKey("Team D", "machine1234567890", { costLimitUsd: 10 });

    await finalizeApiKeyCost({ apiKey: key.key, costUsd: 10.1, requestId: "req-over" });

    await expect(validateApiKey(key.key)).resolves.toMatchObject({
      ok: false,
      code: "quota_exceeded",
      status: 403,
    });
  });
});
