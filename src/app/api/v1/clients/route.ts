import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { createClientSchema, validateRequestBody } from "@/lib/security/validators";
import { handleApiError } from "@/lib/security/error-handler";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    let clientsList: any[] = [];

    if (supabase) {
      try {
        const { data: supaClients, error: supaErr } = await supabase
          .from("clients")
          .select("id, company_name, tax_id, contact_name, contact_email, contact_phone, notes, created_at, updated_at")
          .order("company_name", { ascending: true });

        if (supaErr) {
          console.warn("[SUPABASE][GET_CLIENTS_WARN] Error consultando clients:", supaErr.message);
        } else if (supaClients) {
          clientsList = supaClients.map((row: any) => ({
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
            status: "active" as const,
            notes: row.notes || "",
            created_at: row.created_at || new Date().toISOString(),
            updated_at: row.updated_at || new Date().toISOString(),
            total_licenses: 0,
            active_licenses_count: 0,
            total_paid_usd: 0,
            total_paid_cop: 0,
          }));
        }
      } catch (err) {
        console.warn("[SUPABASE][GET_CLIENTS_EXCEPTION]", err);
      }
    }

    // Unir con memoria para preservar clientes mock en entornos sin BD o enriquecer datos
    const memClients = store.getCompaniesWithStats();
    const existingIds = new Set(clientsList.map((c) => c.id));
    const mergedClients = [
      ...clientsList,
      ...memClients.filter((c) => !existingIds.has(c.id)),
    ];

    return NextResponse.json({
      success: true,
      clients: mergedClients,
    });
  } catch (error: any) {
    return handleApiError(error, "Error al consultar clientes");
  }
}

export async function POST(req: NextRequest) {
  try {
    const validation = await validateRequestBody(req, createClientSchema);
    if (!validation.success) {
      return validation.response;
    }

    const {
      name,
      company_name,
      nit_rut,
      tax_id,
      legal_name,
      contact_name,
      email,
      contact_email,
      phone,
      contact_phone,
      notes,
    } = validation.data;

    const companyName = (company_name || name || "").trim();
    const taxIdValue = (tax_id || nit_rut || "").trim() || null;
    const contactNameValue = (contact_name || legal_name || companyName).trim();
    const contactEmailValue = (contact_email || email || "").trim() || null;
    const contactPhoneValue = (contact_phone || phone || "").trim() || null;
    const notesValue = (notes || "").trim() || null;

    let generatedId: string | undefined = undefined;

    // 1. Inserción real en la tabla `clients` de Supabase con Service Role
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const insertPayload = {
        company_name: companyName,
        tax_id: taxIdValue,
        contact_name: contactNameValue,
        contact_email: contactEmailValue,
        contact_phone: contactPhoneValue,
        notes: notesValue,
      };

      const { data: insertedRow, error: insertError } = await supabase
        .from("clients")
        .insert([insertPayload])
        .select("id, company_name, tax_id, contact_name, contact_email, contact_phone, notes, created_at, updated_at")
        .single();

      if (insertError) {
        console.error("[SUPABASE][INSERT_CLIENT_ERROR]", insertError);
        return NextResponse.json(
          {
            success: false,
            error: `Error al registrar cliente en Supabase: ${insertError.message || insertError.details || "Fallo de inserción"}`,
            code: insertError.code,
            details: insertError,
          },
          { status: 500 }
        );
      }

      if (insertedRow && insertedRow.id) {
        generatedId = insertedRow.id;
      }
    }

    // 2. Sincronizar en store local con el ID devuelto por Supabase
    const newCompany = store.createCompany({
      id: generatedId,
      name: companyName,
      company_name: companyName,
      nit_rut: taxIdValue || "N/A",
      tax_id: taxIdValue || "N/A",
      legal_name: contactNameValue,
      contact_name: contactNameValue,
      email: contactEmailValue || "",
      contact_email: contactEmailValue || "",
      phone: contactPhoneValue || "",
      contact_phone: contactPhoneValue || "",
      status: "active",
      notes: notesValue || "",
    });

    return NextResponse.json({
      success: true,
      client: newCompany,
    });
  } catch (error: any) {
    return handleApiError(error, "Error al crear cliente");
  }
}
