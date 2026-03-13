import { NextResponse } from "next/server";
import { deleteApiKey, getApiKeyById, updateApiKey } from "@/lib/localDb";

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

// GET /api/keys/[id] - Get single key
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const key = await getApiKeyById(id);
    if (!key) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }
    return NextResponse.json({ key });
  } catch (error) {
    console.log("Error fetching key:", error);
    return NextResponse.json({ error: "Failed to fetch key" }, { status: 500 });
  }
}

// PUT /api/keys/[id] - Update key
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { isActive, name, costLimitUsd, validFrom, validUntil } = body;

    const existing = await getApiKeyById(id);
    if (!existing) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const updateData = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (name !== undefined) {
      if (!String(name).trim()) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      updateData.name = String(name).trim();
    }

    if (costLimitUsd !== undefined) {
      const parsedCostLimitUsd = parseOptionalLimit(costLimitUsd);
      if (Number.isNaN(parsedCostLimitUsd)) {
        return NextResponse.json({ error: "Cost limit must be a non-negative number" }, { status: 400 });
      }
      updateData.costLimitUsd = parsedCostLimitUsd;
    }

    if (validFrom !== undefined) {
      const parsedValidFrom = parseOptionalIso(validFrom);
      if (validFrom !== null && validFrom !== "" && !parsedValidFrom) {
        return NextResponse.json({ error: "validFrom must be a valid ISO datetime" }, { status: 400 });
      }
      updateData.validFrom = parsedValidFrom;
    }

    if (validUntil !== undefined) {
      const parsedValidUntil = parseOptionalIso(validUntil);
      if (validUntil !== null && validUntil !== "" && !parsedValidUntil) {
        return NextResponse.json({ error: "validUntil must be a valid ISO datetime" }, { status: 400 });
      }
      updateData.validUntil = parsedValidUntil;
    }

    const nextValidFrom = updateData.validFrom !== undefined ? updateData.validFrom : existing.validFrom;
    const nextValidUntil = updateData.validUntil !== undefined ? updateData.validUntil : existing.validUntil;
    if (nextValidFrom && nextValidUntil && new Date(nextValidFrom) >= new Date(nextValidUntil)) {
      return NextResponse.json({ error: "validUntil must be later than validFrom" }, { status: 400 });
    }

    const updated = await updateApiKey(id, updateData);

    return NextResponse.json({ key: updated });
  } catch (error) {
    console.log("Error updating key:", error);
    return NextResponse.json({ error: "Failed to update key" }, { status: 500 });
  }
}

// DELETE /api/keys/[id] - Delete API key
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    const deleted = await deleteApiKey(id);
    if (!deleted) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Key deleted successfully" });
  } catch (error) {
    console.log("Error deleting key:", error);
    return NextResponse.json({ error: "Failed to delete key" }, { status: 500 });
  }
}
