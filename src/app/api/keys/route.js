import { NextResponse } from "next/server";
import { getApiKeys, createApiKey } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";

export const dynamic = "force-dynamic";

// GET /api/keys - List API keys
export async function GET() {
  try {
    const keys = await getApiKeys();
    return NextResponse.json({ keys });
  } catch (error) {
    console.log("Error fetching keys:", error);
    return NextResponse.json({ error: "Failed to fetch keys" }, { status: 500 });
  }
}

function parseOptionalIso(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseOptionalLimit(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : NaN;
}

// POST /api/keys - Create new API key
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, costLimitUsd, validFrom, validUntil } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const parsedCostLimitUsd = parseOptionalLimit(costLimitUsd);
    if (Number.isNaN(parsedCostLimitUsd)) {
      return NextResponse.json({ error: "Cost limit must be a non-negative number" }, { status: 400 });
    }

    const parsedValidFrom = parseOptionalIso(validFrom);
    if (validFrom !== undefined && validFrom !== null && validFrom !== "" && !parsedValidFrom) {
      return NextResponse.json({ error: "validFrom must be a valid ISO datetime" }, { status: 400 });
    }

    const parsedValidUntil = parseOptionalIso(validUntil);
    if (validUntil !== undefined && validUntil !== null && validUntil !== "" && !parsedValidUntil) {
      return NextResponse.json({ error: "validUntil must be a valid ISO datetime" }, { status: 400 });
    }

    if (parsedValidFrom && parsedValidUntil && new Date(parsedValidFrom) >= new Date(parsedValidUntil)) {
      return NextResponse.json({ error: "validUntil must be later than validFrom" }, { status: 400 });
    }

    // Always get machineId from server
    const machineId = await getConsistentMachineId();
    const apiKey = await createApiKey(name, machineId, {
      costLimitUsd: parsedCostLimitUsd,
      validFrom: parsedValidFrom,
      validUntil: parsedValidUntil,
    });

    return NextResponse.json({ key: apiKey.key, apiKey }, { status: 201 });
  } catch (error) {
    console.log("Error creating key:", error);
    return NextResponse.json({ error: "Failed to create key" }, { status: 500 });
  }
}
