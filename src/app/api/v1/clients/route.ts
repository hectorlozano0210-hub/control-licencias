import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { createClientSchema, validateRequestBody } from "@/lib/security/validators";
import { handleApiError } from "@/lib/security/error-handler";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const clients = store.getCompaniesWithStats();
    return NextResponse.json({
      success: true,
      clients,
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

    const { name, nit_rut, legal_name, email, phone, notes } = validation.data;

    const newCompany = store.createCompany({
      name,
      nit_rut,
      legal_name: legal_name || name,
      email,
      phone: phone || "",
      status: "active",
      notes: notes || "",
    });

    return NextResponse.json({
      success: true,
      client: newCompany,
    });
  } catch (error: any) {
    return handleApiError(error, "Error al crear cliente");
  }
}
