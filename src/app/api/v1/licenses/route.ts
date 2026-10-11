import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { createLicenseSchema, patchLicenseSchema, validateRequestBody } from "@/lib/security/validators";
import { handleApiError } from "@/lib/security/error-handler";
import { getSupabaseAdminClient, getDatabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    let dbLicenses: any[] = [];

    if (supabase) {
      try {
        const { data: supaLics, error: supaErr } = await supabase
          .from("licenses")
          .select("id, license_key, customer_id, customer_email, plan_tier, status, max_activations, current_activations, valid_from, expires_at");

        if (supaErr) {
          console.warn("[SUPABASE][GET_LICENSES_WARN] Error consultando tabla licenses:", supaErr.message);
        } else if (supaLics) {
          dbLicenses = supaLics.map((row: any) => ({
            id: row.id,
            license_key: row.license_key,
            company_id: row.customer_id || "comp_01",
            company_name: row.customer_email
              ? `Cliente (${row.customer_email})`
              : (row.license_key?.startsWith("MFP-JOY") ? "Master FixPC Joyerías S.A.S." : "Cliente Registrado"),
            company_nit: "N/A",
            app_id: row.license_key?.startsWith("MFP-JOY") ? "joyeria-erp" : "app_horarios",
            app_slug: row.license_key?.startsWith("MFP-JOY") ? "joyeria-erp" : "control-horarios",
            app_name: row.license_key?.startsWith("MFP-JOY") ? "Master FixPC Joyerías ERP (joyeria-erp)" : "Software Licenciado",
            plan_tier: row.plan_tier?.toUpperCase() === "PRO" ? "Professional" : row.plan_tier?.toUpperCase() === "STD" ? "Standard" : "Enterprise",
            max_seats: row.max_activations || 1,
            current_seats: row.current_activations || 0,
            status: row.status || "active",
            issued_at: row.valid_from || new Date().toISOString(),
            expires_at: row.expires_at || new Date(Date.now() + 365 * 86400000).toISOString(),
            grace_period_days: 7,
            auto_renew: false,
            created_at: row.valid_from || new Date().toISOString(),
            updated_at: row.valid_from || new Date().toISOString(),
          }));
        }
      } catch (err) {
        console.warn("[SUPABASE][GET_LICENSES_EXCEPTION]", err);
      }
    }

    const memLicenses = store.getLicenses();
    const existingKeys = new Set(dbLicenses.map((l) => l.license_key));
    const mergedLicenses = [
      ...dbLicenses,
      ...memLicenses.filter((l) => !existingKeys.has(l.license_key)),
    ];

    const companies = store.getCompanies();
    const apps = store.getApps();
    const devices = store.getDevices();

    return NextResponse.json({
      licenses: mergedLicenses,
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

    const {
      company_id,
      customer_id,
      customer_email,
      app_id,
      plan_tier,
      plan,
      max_seats,
      max_activations,
      cupos,
      duration_days,
      notes,
    } = validation.data;

    // Normalizar datos de entrada
    const targetCompanyId = customer_id || company_id || "comp_01";
    const targetAppId = app_id || "joyeria-erp";
    const selectedCompany = store.getCompanies().find((c) => c.id === targetCompanyId);

    const resolvedPlanTier: "Standard" | "Professional" | "Enterprise" =
      plan_tier === "Standard" || plan_tier === "STD" || plan === "Standard" || plan === "STD"
        ? "Standard"
        : plan_tier === "Enterprise" || plan_tier === "ENT" || plan === "Enterprise" || plan === "ENT"
        ? "Enterprise"
        : "Professional";

    const resolvedCupos = Number(cupos || max_activations || max_seats) || 1;
    const resolvedDuration = Number(duration_days) || 365;

    // 1. Crear registro base en el store local para generación criptográfica de la clave
    const newLic = store.createLicense({
      company_id: selectedCompany ? selectedCompany.id : targetCompanyId,
      app_id: targetAppId,
      plan_tier: resolvedPlanTier,
      max_seats: resolvedCupos,
      duration_days: resolvedDuration,
      notes,
    });

    // 2. Conectar y persistir de forma real en Supabase con privilegios administrativos
    const supabase = getSupabaseAdminClient();

    if (!supabase) {
      const dbConfig = getDatabaseConfig();
      const msg = !dbConfig.url
        ? "No se ha configurado SUPABASE_URL en las variables de entorno de Render."
        : "No se ha configurado SUPABASE_SERVICE_ROLE_KEY en las variables de entorno de Render.";
      console.error("[SUPABASE][CONFIG_MISSING]", msg);
      return NextResponse.json(
        {
          success: false,
          error: `Error de persistencia: ${msg}`,
          code: "SUPABASE_NOT_CONFIGURED",
        },
        { status: 500 }
      );
    }

    const isUuid = (val: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    const emailCliente = customer_email || selectedCompany?.email || null;
    const planDbValue = plan || (resolvedPlanTier === "Professional" ? "PRO" : resolvedPlanTier === "Standard" ? "STD" : "ENT");

    // Payload sanitizado compatible ESTRICTAMENTE con el esquema real de Supabase:
    // columnas: id, license_key, customer_id, customer_email, plan_tier, status, max_activations, current_activations, valid_from, expires_at
    const insertPayload: Record<string, any> = {
      license_key: newLic.license_key,
      plan_tier: planDbValue,
      status: "active",
      max_activations: resolvedCupos,
      current_activations: 0,
      customer_email: emailCliente,
      expires_at: newLic.expires_at,
      valid_from: new Date().toISOString(),
    };

    // customer_id debe ser un UUID válido o null para evitar rechazo de tipo en Postgres
    if (targetCompanyId && isUuid(targetCompanyId)) {
      insertPayload.customer_id = targetCompanyId;
    } else {
      insertPayload.customer_id = null;
    }

    const { data: insertedRow, error: insertError } = await supabase
      .from("licenses")
      .insert([insertPayload])
      .select()
      .maybeSingle();

    if (insertError) {
      console.error("[SUPABASE][INSERT_ERROR]", insertError);
      return NextResponse.json(
        {
          success: false,
          error: `Error al registrar en Supabase: ${insertError.message || insertError.details || insertError.hint || "Fallo de permisos o tabla"} (Código: ${insertError.code || "UNKNOWN"})`,
          code: insertError.code || "SUPABASE_INSERT_ERROR",
          details: insertError,
        },
        { status: 500 }
      );
    }

    if (insertedRow && insertedRow.id) {
      newLic.id = insertedRow.id;
    }

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
    const supabase = getSupabaseClient();

    if (action === "extend" && days) {
      const updated = store.extendLicense(id, days);
      if (supabase && updated) {
        await supabase
          .from("licenses")
          .update({ expires_at: updated.expires_at, updated_at: new Date().toISOString() })
          .eq("license_key", updated.license_key);
      }
      return NextResponse.json({ success: true, license: updated });
    }

    if (status) {
      const updated = store.updateLicenseStatus(id, status);
      if (supabase && updated) {
        await supabase
          .from("licenses")
          .update({ status: status, updated_at: new Date().toISOString() })
          .eq("license_key", updated.license_key);
      }
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
