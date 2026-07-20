/**
 * Create a farm.
 *
 * Returns the new farm's key, which is both its address (/farm/{key}) and its
 * credential. The client stores it locally so the user does not have to keep
 * the URL — but the key is the only way back in, by design.
 */

import type { NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db/client";
import { createFarm } from "@/lib/db/farms";

export async function POST(request: NextRequest) {
  if (!isDbConfigured()) {
    return Response.json(
      { error: "Farms require a database, which is not configured on this deployment." },
      { status: 503 },
    );
  }

  let name = "My farm";
  try {
    const body = await request.json();
    if (typeof body?.name === "string") name = body.name;
  } catch {
    // Empty body is fine; the name defaults.
  }

  const farm = await createFarm(name);
  if (!farm) {
    return Response.json({ error: "Could not create farm." }, { status: 500 });
  }
  return Response.json({ key: farm.key, name: farm.name }, { status: 201 });
}
