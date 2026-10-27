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
    let dbCompanies: any[] = [];

    if (supabase) {
      try {
        const [supaLicsRes, supaClientsRes] = await Promise.all([
          supabase
            .from("licenses")
            .select("id, license_key, customer_id, customer_email, plan_tier, status, max_activations, current_activations, valid_from, expires_at"),
          supabase
            .from("clients")
            .select("id, company_name, tax_id, contact_name, contact_email, contact_phone, notes, created_at, updated_at")
            .order("company_name", { ascending: true }),
        ]);

        if (supaClientsRes.data) {
          dbCompanies = supaClientsRes.data.map((row: any) => ({
            id: row.id,
            name: row.company_name,
            company_name: row.company_name,
            nit_rut: row.tax_id || "N/A",
            tax_id: row.tax_id || "N/A",
            legal_name: row.contact_name || row.company_name,
            contact_name: row.contact_name || row.company_name,
            email: row.contact_email || "",
            contact_email: row.contact_email || "",
            phone: row.contact_phone || "",
            contact_phone: row.contact_phone || "",
            status: "active",
            notes: row.notes || "",
            created_at: row.created_at || new Date().toISOString(),
            updated_at: row.updated_at || new Date().toISOString(),
          }));
        }

        if (supaLicsRes.data) {
          const clientMap = new Map(dbCompanies.map((c) => [c.id, c.company_name]));
          dbLicenses = supaLicsRes.data.map((row: any) => {
            const clientName = row.customer_id ? clientMap.get(row.customer_id) : undefined;
            return {
              id: row.id,
              license_key: row.license_key,
              company_id: row.customer_id || "comp_01",
              company_name:
                clientName ||
                (row.customer_email
                  ? `Cliente (${row.customer_email})`
                  : row.license_key?.startsWith("MFP-JOY")
                  ? "Master FixPC Joyerías S.A.S."
                  : "Cliente Registrado"),
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
            };
          });
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

    const memCompanies = store.getCompanies();
    const existingCompIds = new Set(dbCompanies.map((c) => c.id));
    const mergedCompanies = [
      ...dbCompanies,
      ...memCompanies.filter((c) => !existingCompIds.has(c.id)),
    ];

    const apps = store.getApps();
    const devices = store.getDevices();

    return NextResponse.json({
      licenses: mergedLicenses,
      companies: mergedCompanies,
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

    let customerId: string | null = null;
    let emailCliente = customer_email || null;

    // 3. Vincular con tabla clients en Supabase: customer_id = client.id, customer_email = client.contact_email
    if (targetCompanyId && isUuid(targetCompanyId)) {
      customerId = targetCompanyId;
      try {
        const { data: clientRow } = await supabase
          .from("clients")
          .select("id, contact_email, company_name")
          .eq("id", targetCompanyId)
          .maybeSingle();

        if (clientRow) {
          customerId = clientRow.id;
          if (!emailCliente && clientRow.contact_email) {
            emailCliente = clientRow.contact_email;
          }
        }
      } catch (err) {
        console.warn("[LICENSES][CLIENT_LOOKUP_WARN]", err);
      }
    }

    if (!emailCliente && selectedCompany?.email) {
      emailCliente = selectedCompany.email;
    }

    const planDbValue = plan || (resolvedPlanTier === "Professional" ? "PRO" : resolvedPlanTier === "Standard" ? "STD" : "ENT");

    // Payload sanitizado compatible ESTRICTAMENTE con el esquema real de Supabase:
    // columnas: id, license_key, customer_id, customer_email, plan_tier, status, max_activations, current_activations, valid_from, expires_at
    const insertPayload: Record<string, any> = {
      license_key: newLic.license_key,
      customer_id: customerId,
      customer_email: emailCliente,
      plan_tier: planDbValue,
      status: "active",
      max_activations: resolvedCupos,
      current_activations: 0,
      expires_at: newLic.expires_at,
      valid_from: new Date().toISOString(),
    };

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
    const supabase = getSupabaseAdminClient();

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
