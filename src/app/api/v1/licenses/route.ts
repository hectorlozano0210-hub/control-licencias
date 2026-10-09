import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { createLicenseSchema, patchLicenseSchema, validateRequestBody } from "@/lib/security/validators";
import { handleApiError } from "@/lib/security/error-handler";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const licenses = store.getLicenses();
    const companies = store.getCompanies();
    const apps = store.getApps();
    const devices = store.getDevices();

    return NextResponse.json({
      licenses,
      companies,
      apps,
      devices,
    });
  } catch (error: any) {
    return handleApiError(error, "Error al consultar licencias");
  }
}

export async function POST(req: NextRequest) {
  try {
    const validation = await validateRequestBody(req, createLicenseSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { company_id, app_id, plan_tier, max_seats, duration_days, notes } = validation.data;

    const newLic = store.createLicense({
      company_id,
      app_id,
      plan_tier,
      max_seats,
      duration_days,
      notes,
    });

    return NextResponse.json({
      success: true,
      license: newLic,
    });
  } catch (error: any) {
    return handleApiError(error, "Error al generar licencia");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const validation = await validateRequestBody(req, patchLicenseSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { id, status, action, days } = validation.data;

    if (action === "extend" && days) {
      const updated = store.extendLicense(id, days);
      return NextResponse.json({ success: true, license: updated });
    }

    if (status) {
      const updated = store.updateLicenseStatus(id, status);
      return NextResponse.json({ success: true, license: updated });
    }

    return NextResponse.json(
      { error: "INVALID_PARAMETERS", message: "Parámetros insuficientes para la modificación de la licencia." },
      { status: 400 }
    );
  } catch (error: any) {
    return handleApiError(error, "Error al actualizar licencia");
  }
}
