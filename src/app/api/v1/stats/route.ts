import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  try {
    const licenses = store.getLicenses();
    const companies = store.getCompanies();
    const apps = store.getApps();
    const devices = store.getDevices();
    const logs = store.getLogs();
    const payments = store.getPayments();

    const activeLicenses = licenses.filter((l) => l.status === "active").length;
    const totalSeatsAllocated = licenses.reduce((sum, l) => sum + l.max_seats, 0);
    const totalSeatsUsed = devices.filter((d) => d.is_active).length;

    // Conexiones en vivo (heartbeat en los últimos 10 minutos)
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    const liveDevices = devices.filter(
      (d) => d.is_active && new Date(d.last_heartbeat_at).getTime() > tenMinAgo
    ).length;

    const fraudAttempts = logs.filter((l) => l.event_type === "activate_fraud_blocked").length;

    const totalRevenue = payments
      .filter((p) => p.status === "succeeded")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    return NextResponse.json({
      metrics: {
        total_companies: companies.length,
        total_apps: apps.length,
        active_licenses: activeLicenses,
        total_licenses: licenses.length,
        total_seats_allocated: totalSeatsAllocated,
        total_seats_used: totalSeatsUsed,
        live_devices: liveDevices,
        fraud_attempts_blocked: fraudAttempts,
        total_revenue: totalRevenue,
      },
      recent_logs: logs.slice(0, 20),
      recent_payments: payments.slice(0, 10),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
