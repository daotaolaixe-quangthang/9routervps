import { getApiKeyByValue, getApiKeyStatus, updateApiKey, validateApiKey } from "@/lib/localDb.js";
import { hasAppliedApiKeyUsage, markApiKeyUsageApplied } from "@/lib/usageDb.js";

function roundUsd(value) {
  return Math.round((Number(value) || 0) * 1e8) / 1e8;
}

export async function getApiKeyAuthState(apiKey) {
  return validateApiKey(apiKey);
}

export function canConsumeCost({ apiKeyRecord, nextCostUsd = 0 }) {
  const record = getApiKeyStatus(apiKeyRecord);
  const nextCost = Math.max(0, Number(nextCostUsd) || 0);

  if (record.costLimitUsd === null) {
    return {
      allowed: true,
      projectedUsedUsd: roundUsd(record.costUsedUsd + nextCost),
      remainingUsd: null,
    };
  }

  const projectedUsedUsd = roundUsd(record.costUsedUsd + nextCost);
  const remainingUsd = Math.max(0, roundUsd(record.costLimitUsd - projectedUsedUsd));

  return {
    allowed: projectedUsedUsd < record.costLimitUsd,
    projectedUsedUsd,
    remainingUsd,
  };
}

export async function incrementApiKeyUsage({ apiKey, costUsd = 0, timestamp = new Date().toISOString() }) {
  const keyRecord = await getApiKeyByValue(apiKey);
  if (!keyRecord) {
    return { ok: false, reason: "not_found" };
  }

  const nextUsedUsd = roundUsd(keyRecord.costUsedUsd + Math.max(0, Number(costUsd) || 0));
  const updated = await updateApiKey(keyRecord.id, {
    costUsedUsd: nextUsedUsd,
    lastUsedAt: timestamp,
  });

  return { ok: true, keyRecord: updated };
}

export async function finalizeApiKeyCost({ apiKey, costUsd = 0, requestId, timestamp = new Date().toISOString() }) {
  if (!apiKey || !requestId) {
    return { ok: false, reason: "missing_input" };
  }

  if (await hasAppliedApiKeyUsage(requestId)) {
    return { ok: true, duplicated: true };
  }

  const result = await incrementApiKeyUsage({ apiKey, costUsd, timestamp });
  if (!result.ok) return result;

  await markApiKeyUsageApplied(requestId, timestamp);
  return result;
}
