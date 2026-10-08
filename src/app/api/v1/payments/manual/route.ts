import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { manualPaymentSchema, validateRequestBody } from "@/lib/security/validators";
import { handleApiError } from "@/lib/security/error-handler";

export async function POST(req: NextRequest) {
  try {
    const validation = await validateRequestBody(req, manualPaymentSchema);
    if (!validation.success) {
      return validation.response;
    }

    const {
      company_id,
      license_id,
      amount,
      currency,
      payment_method,
      reference_id,
      action_on_license,
      notes,
    } = validation.data;

    const result = store.processManualPayment({
      company_id,
      license_id,
      amount,
      currency,
      payment_method,
      reference_id,
      action_on_license,
      notes,
    });

    return NextResponse.json({
      success: true,
      payment: result.payment,
      license: result.license,
      message: "Pago manual registrado y procesado exitosamente.",
    });
  } catch (error: any) {
    return handleApiError(error, "Error al procesar pago manual");
  }
}
