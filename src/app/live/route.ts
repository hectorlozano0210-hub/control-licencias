import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Endpoint de Liveness Probe (/live)
 * Retorna inmediatamente 200 OK para verificaciones de Kubernetes, Cloud Run o AWS.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "live",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
