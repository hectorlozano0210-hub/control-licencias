import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { createAppSchema, validateRequestBody } from "@/lib/security/validators";
import { handleApiError } from "@/lib/security/error-handler";
import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  MASTER_SESSION_COOKIE,
  verifyMasterSessionToken,
} from "@/lib/security/master-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    let dbApps: any[] = [];

    if (supabase) {
      try {
        const { data: supaApps, error: supaErr } = await supabase
          .from("applications")
          .select("id, slug, name, license_prefix, description, current_version, min_supported_version, is_active, created_at, updated_at")
          .order("name", { ascending: true });

        if (supaErr) {
          // Si la tabla aún no existe o no tiene datos, loguear advertencia sin romper la llamada
          console.warn("[SUPABASE][GET_APPS_WARN]", supaErr.message);
        } else if (supaApps && supaApps.length > 0) {
          dbApps = supaApps.map((row: any) => ({
            id: row.id,
            slug: row.slug,
            name: row.name,
            license_prefix: row.license_prefix || (row.slug === "joyeria-erp" ? "MFP-JOY" : "PROD"),
            description: row.description || "",
            current_version: row.current_version || "1.0.0",
            min_supported_version: row.min_supported_version || "1.0.0",
            is_active: row.is_active !== false,
            created_at: row.created_at || new Date().toISOString(),
            updated_at: row.updated_at || new Date().toISOString(),
          }));
        }
      } catch (err) {
        console.warn("[SUPABASE][GET_APPS_EXCEPTION]", err);
      }
    }

    // Unir con el catálogo en memoria garantizando aplicaciones esenciales (Master FixPC Joyerías ERP)
    const memApps = store.getApps();
    const existingSlugs = new Set(dbApps.map((a) => a.slug));
    const mergedApps = [
      ...dbApps,
      ...memApps.filter((a) => !existingSlugs.has(a.slug)),
    ];

    return NextResponse.json({
      success: true,
      apps: mergedApps,
    });
  } catch (error: any) {
    return handleApiError(error, "Error al consultar catálogo de aplicaciones");
  }
}

export async function POST(req: NextRequest) {
  try {
    // =========================================================================
    // 1. BLINDAJE DE SEGURIDAD: Exigir Sesión Maestra y Terminal Vinculada
    // =========================================================================
    const tokenCookie = req.cookies.get(MASTER_SESSION_COOKIE);
    if (!tokenCookie || !tokenCookie.value) {
      return NextResponse.json(
        {
          success: false,
          error: "No autorizado: Se requiere sesión activa de Super Administrador para registrar aplicaciones.",
          code: "UNAUTHORIZED_ADMIN",
        },
        { status: 401 }
      );
    }

    const verification = await verifyMasterSessionToken(tokenCookie.value);
    if (!verification.valid) {
      return NextResponse.json(
        {
          success: false,
          error: verification.reason || "Acceso denegado: Estación no autorizada para cambios de software.",
          code: "UNAUTHORIZED_DEVICE",
        },
        { status: 403 }
      );
    }

    // =========================================================================
    // 2. Validación Estricta de Entradas (Anti Mass-Assignment e Inyección)
    // =========================================================================
    const validation = await validateRequestBody(req, createAppSchema);
    if (!validation.success) {
      return validation.response;
    }

    const {
      name,
      slug,
      license_prefix,
      description,
      current_version,
      min_supported_version,
      is_active,
    } = validation.data;

    // Normalizar slug y prefijo de licencia
    const normalizedSlug = slug.trim().toLowerCase();
    const normalizedPrefix = (
      license_prefix?.trim() ||
      normalizedSlug.replace(/[^a-z0-9]/gi, "").substring(0, 4).toUpperCase() ||
      "APP"
    ).toUpperCase();

    let generatedId: string = `app_${normalizedSlug}`;

    // =========================================================================
    // 3. Persistencia Real en Tabla 'applications' de Supabase
    // =========================================================================
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const insertPayload = {
        slug: normalizedSlug,
        name: name.trim(),
        license_prefix: normalizedPrefix,
        description: description ? description.trim() : null,
        current_version: current_version || "1.0.0",
        min_supported_version: min_supported_version || "1.0.0",
        is_active: is_active ?? true,
      };

      const { data: insertedRow, error: insertError } = await supabase
        .from("applications")
        .insert([insertPayload])
        .select("id, slug, name, license_prefix, description, current_version, min_supported_version, is_active, created_at, updated_at")
        .single();

      if (insertError) {
        // Si la tabla aún no existe en Supabase, advertir amigablemente
        if (
          insertError.code === "PGRST204" ||
          insertError.message?.includes("does not exist") ||
          insertError.message?.includes("relation")
        ) {
          console.warn("[SUPABASE] La tabla 'applications' aún no ha sido creada en Supabase. Registrando en memoria.");
        } else {
          console.error("[SUPABASE][INSERT_APP_ERROR]", insertError);
          return NextResponse.json(
            {
              success: false,
              error: `Error al persistir aplicación en Supabase: ${insertError.message || insertError.details}`,
              code: insertError.code,
              details: insertError,
            },
            { status: 500 }
          );
        }
      } else if (insertedRow && insertedRow.id) {
        generatedId = insertedRow.id;
      }
    }

    // =========================================================================
    // 4. Registro en Store Local y Auditoría Forense
    // =========================================================================
    const newApp = store.createApp({
      id: generatedId,
      slug: normalizedSlug,
      name: name.trim(),
      license_prefix: normalizedPrefix,
      description: description ? description.trim() : "",
      current_version: current_version || "1.0.0",
      min_supported_version: min_supported_version || "1.0.0",
      is_active: is_active ?? true,
    });

    store.addLog({
      app_slug: normalizedSlug,
      event_type: "license_renewed",
      success: true,
      message: `Nueva aplicación registrada por Super Admin: ${name.trim()} (slug: ${normalizedSlug}, prefijo: ${normalizedPrefix}).`,
    });

    return NextResponse.json({
      success: true,
      app: newApp,
    });
  } catch (error: any) {
    return handleApiError(error, "Error al registrar aplicación");
  }
}
