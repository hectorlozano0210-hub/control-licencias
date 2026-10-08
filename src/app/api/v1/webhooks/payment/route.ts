import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Provider detection & payload normalization (Stripe, Wompi, Bold, or Generic)
    let provider = "generic";
    let isSuccess = false;
    let isFailure = false;
    let transactionId = "";
    let companyId = "";
    let licenseId = "";
    let amount = 0;
    let currency = "USD";
    let daysToExtend = 365;

    // 1. WOMPI webhook format
    if (body.event === "transaction.updated" && body.data?.transaction) {
      provider = "wompi";
      const tx = body.data.transaction;
      transactionId = tx.id || tx.reference || `wompi_${Date.now()}`;
      isSuccess = tx.status === "APPROVED";
      isFailure = tx.status === "DECLINED" || tx.status === "ERROR";
      amount = tx.amount_in_cents ? tx.amount_in_cents / 100 : tx.amount || 0;
      currency = (tx.currency || "COP").toUpperCase();
      companyId = tx.metadata?.company_id || tx.customer_data?.legal_id;
      licenseId = tx.metadata?.license_id;
    }
    // 2. BOLD webhook format
    else if (body.bold_order_id || body.event?.startsWith("bold.") || body.event === "payment.created") {
      provider = "bold";
      transactionId = body.bold_order_id || body.id || `bold_${Date.now()}`;
      isSuccess = body.status === "APPROVED" || body.status === "PAID" || body.event === "bold.payment.approved";
      isFailure = body.status === "REJECTED" || body.status === "FAILED";
      amount = body.amount || body.data?.amount || 0;
      currency = (body.currency || "COP").toUpperCase();
      companyId = body.metadata?.company_id || body.data?.metadata?.company_id;
      licenseId = body.metadata?.license_id || body.data?.metadata?.license_id;
    }
    // 3. STRIPE webhook format
    else if (body.type?.startsWith("payment_intent.") || body.type?.startsWith("invoice.") || body.type?.startsWith("charge.")) {
      provider = "stripe";
      const dataObject = body.data?.object || body;
      transactionId = dataObject.id || `str_${Date.now()}`;
      isSuccess =
        body.type === "invoice.payment_succeeded" ||
        body.type === "payment_intent.succeeded" ||
        body.type === "charge.succeeded";
      isFailure =
        body.type === "invoice.payment_failed" ||
        body.type === "payment_intent.payment_failed";
      amount = dataObject.amount_paid ? dataObject.amount_paid / 100 : dataObject.amount || 0;
      currency = (dataObject.currency || "USD").toUpperCase();
      companyId = dataObject.metadata?.company_id || dataObject.customer;
      licenseId = dataObject.metadata?.license_id;
    }
    // 4. Fallback Generic
    else {
      const dataObject = body.data?.object || body;
      transactionId = dataObject.id || dataObject.transaction_id || `txn_${Date.now()}`;
      const status = (body.status || dataObject.status || "").toLowerCase();
      isSuccess = status === "succeeded" || status === "approved" || status === "paid" || body.success === true;
      isFailure = status === "failed" || status === "rejected";
      amount = Number(dataObject.amount || body.amount || 0);
      currency = (dataObject.currency || body.currency || "USD").toUpperCase();
      companyId = dataObject.company_id || body.company_id || "";
      licenseId = dataObject.license_id || body.license_id || "";
    }

    // Auto-reconciliation fallback: if companyId is missing but licenseId is given, resolve company
    if (!companyId && licenseId) {
      const foundLic = store.getLicenses().find((l) => l.id === licenseId || l.license_key === licenseId);
      if (foundLic) {
        companyId = foundLic.company_id;
        licenseId = foundLic.id;
      }
    }

    // Fallback if no company is found at all, assign to first seed company
    if (!companyId) {
      const firstComp = store.getCompanies()[0];
      companyId = firstComp ? firstComp.id : "comp_01";
    }

    if (isSuccess) {
      const payment = store.processPayment({
        external_transaction_id: transactionId,
        company_id: companyId,
        license_id: licenseId || undefined,
        amount: amount || 199.0,
        currency: currency,
        status: "succeeded",
        days_to_extend: daysToExtend,
      });

      return NextResponse.json({
        received: true,
        provider,
        action: "RENEWAL_APPLIED",
        payment_id: payment.id,
        license_id: licenseId || null,
        message: `Pago de ${provider.toUpperCase()} conciliado exitosamente.`,
      });
    } else if (isFailure) {
      const payment = store.processPayment({
        external_transaction_id: transactionId,
        company_id: companyId,
        license_id: licenseId || undefined,
        amount: amount || 0,
        currency: currency,
        status: "failed",
      });

      return NextResponse.json({
        received: true,
        provider,
        action: "LICENSE_SUSPENDED",
        payment_id: payment.id,
        message: `Pago fallido en ${provider.toUpperCase()}. Licencia suspendida preventivamente.`,
      });
    }

    return NextResponse.json({
      received: true,
      provider,
      action: "IGNORED_EVENT_STATUS",
      message: "El evento no requiere acción sobre licencias.",
    });
  } catch (error: any) {
    console.error("Error in webhook processing:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
