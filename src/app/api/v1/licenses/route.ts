import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { createLicenseSchema, patchLicenseSchema, validateRequestBody } from "@/lib/security/validators";
import { handleApiError } from "@/lib/security/error-handler";
import { getSupabaseClient, getDatabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    let dbLicenses: any[] = [];

    if (supabase) {
      try {
        const { data: supaLics, error: supaErr } = await supabase
          .from("licenses")
          .select("*")
          .order("created_at", { ascending: false });

        if (!supaErr && supaLics) {
          dbLicenses = supaLics.map((row: any) => ({
            id: row.id,
            license_key: row.license_key,
            company_id: row.customer_id || "comp_01",
            company_name: row.client_name || row.metadata?.company_name || (row.license_key?.startsWith("MFP-JOY") ? "Master FixPC Joyerías S.A.S." : "Cliente Registrado"),
            company_nit: row.metadata?.company_nit || "N/A",
            app_id: row.metadata?.app_id || (row.license_key?.startsWith("MFP-JOY") ? "joyeria-erp" : "app_horarios"),
            app_slug: row.app_slug || row.metadata?.app_slug || (row.license_key?.startsWith("MFP-JOY") ? "joyeria-erp" : "control-horarios"),
            app_name: row.metadata?.app_name || (row.license_key?.startsWith("MFP-JOY") ? "Master FixPC Joyerías ERP (joyeria-erp)" : "Software Licenciado"),
            plan_tier: row.plan_tier?.toUpperCase() === "PRO" ? "Professional" : row.plan_tier?.toUpperCase() === "STD" ? "Standard" : "Enterprise",
            max_seats: row.max_activations || 1,
            current_seats: row.current_activations || 0,
            status: row.status || "active",
            issued_at: row.created_at || new Date().toISOString(),
            expires_at: row.expires_at || new Date(Date.now() + 365 * 86400000).toISOString(),
            grace_period_days: 7,
            auto_renew: false,
            created_at: row.created_at || new Date().toISOString(),
            updated_at: row.updated_at || new Date().toISOString(),
          }));
        }
      } catch (err) {
        console.warn("[SUPABASE][GET_LICENSES_WARN]", err);
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

    const { company_id, app_id, plan_tier, max_seats, duration_days, notes } = validation.data;

    // 1. Crear registro base en el store local para asignación de clave y prefijo
    const newLic = store.createLicense({
      company_id,
      app_id,
      plan_tier,
      max_seats,
      duration_days,
      notes,
    });

    // 2. Conectar y persistir de forma real en Supabase
    const supabase = getSupabaseClient();

    if (supabase) {
      const planTierNormalized =
        plan_tier.toLowerCase() === "professional"
          ? "pro"
          : plan_tier.toLowerCase() === "enterprise"
          ? "enterprise"
          : "standard";

      const isUuid = (val: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      // Payload base para la tabla licenses en Supabase
      const basePayload: Record<string, any> = {
        license_key: newLic.license_key,
        plan_tier: planTierNormalized,
        status: "active",
        max_activations: Number(max_seats) || 1,
        current_activations: 0,
        expires_at: newLic.expires_at,
      };

      if (company_id && isUuid(company_id)) {
        basePayload.customer_id = company_id;
      }

      // Payload extendido si existen columnas client_name, app_slug o metadata JSONB
      const extendedPayload: Record<string, any> = {
        ...basePayload,
        client_name: newLic.company_name || company_id,
        app_slug: newLic.app_slug || app_id,
        metadata: {
          company_id,
          company_name: newLic.company_name,
          app_id,
          app_slug: newLic.app_slug,
          notes: notes || undefined,
        },
      };

      let insertError: any = null;
      let insertedRow: any = null;

      const firstTry = await supabase
        .from("licenses")
        .insert([extendedPayload])
        .select()
        .maybeSingle();

      if (firstTry.error) {
        const isColumnMissing =
          firstTry.error.code === "PGRST204" ||
          firstTry.error.message?.includes("column") ||
          firstTry.error.message?.includes("does not exist");

        if (isColumnMissing) {
          // Reintentar con solo las columnas garantizadas de la tabla licenses
          const secondTry = await supabase
            .from("licenses")
            .insert([basePayload])
            .select()
            .maybeSingle();

          if (secondTry.error) {
            if (secondTry.error.code === "23514") {
              const thirdTry = await supabase
                .from("licenses")
                .insert([{ ...basePayload, plan_tier: newLic.plan_tier }])
                .select()
                .maybeSingle();

              if (thirdTry.error) {
                insertError = thirdTry.error;
              } else {
                insertedRow = thirdTry.data;
              }
            } else {
              insertError = secondTry.error;
            }
          } else {
            insertedRow = secondTry.data;
          }
        } else if (firstTry.error.code === "23514") {
          const retryCheck = await supabase
            .from("licenses")
            .insert([{ ...extendedPayload, plan_tier: newLic.plan_tier }])
            .select()
            .maybeSingle();

          if (retryCheck.error) {
            insertError = retryCheck.error;
          } else {
            insertedRow = retryCheck.data;
          }
        } else {
          insertError = firstTry.error;
        }
      } else {
        insertedRow = firstTry.data;
      }

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
    } else {
      console.warn("[SUPABASE] Cliente de base de datos no configurado en entorno actual.");
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
