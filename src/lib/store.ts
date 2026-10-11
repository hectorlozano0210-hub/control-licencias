import { Company, CompanyWithStats, Application, License, ActivatedDevice, LicenseLog, PaymentRecord } from './types';
import { generateCryptographicLicenseKey } from './crypto';

// In-memory persistent data store with realistic seed data
// Automatically syncs with Supabase when environment credentials exist

export const initialCompanies: Company[] = [
  {
    id: "comp_01",
    name: "TechNova Logistics S.A.",
    nit_rut: "900.543.821-4",
    legal_name: "TechNova Global Logistics",
    email: "operaciones@technova.io",
    phone: "+57 312 455 8920",
    status: "active",
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "comp_02",
    name: "FinSecure Latam Corp",
    nit_rut: "901.882.110-9",
    legal_name: "FinSecure Solutions SAS",
    email: "security@finsecure.co",
    phone: "+57 320 890 1234",
    status: "active",
    created_at: new Date(Date.now() - 40 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "comp_03",
    name: "Nexus Health Systems",
    nit_rut: "860.294.001-2",
    legal_name: "Nexus Health IPS",
    email: "admin@nexushealth.org",
    phone: "+57 300 771 9900",
    status: "active",
    created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "comp_04",
    name: "Quantum Media Studios",
    nit_rut: "900.123.456-7",
    legal_name: "Quantum Visual Media",
    email: "licensing@quantum.tv",
    phone: "+1 415 800 2931",
    status: "trial",
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  }
];

export const initialApps: Application[] = [
  {
    id: "app_horarios",
    slug: "control-horarios",
    name: "Control de Horarios Biométrico",
    description: "Sistema empresarial de marcación y control de asistencia para torniquetes y biométricos en la nube.",
    current_version: "2.4.0",
    min_supported_version: "2.0.0",
    is_active: true,
    created_at: new Date(Date.now() - 120 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "app_cotizador",
    slug: "cotizador-pro",
    name: "Cotizador & ERP Pro",
    description: "Generador de propuestas comerciales, presupuestos en vivo y facturación recurrente.",
    current_version: "3.1.2",
    min_supported_version: "3.0.0",
    is_active: true,
    created_at: new Date(Date.now() - 100 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "app_traductor",
    slug: "traductor-neural",
    name: "Traductor Neural Enterprise",
    description: "Motor offline/online de traducción y transcripción de audios con IA especializada.",
    current_version: "1.8.0",
    min_supported_version: "1.5.0",
    is_active: true,
    created_at: new Date(Date.now() - 80 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "joyeria-erp",
    slug: "joyeria-erp",
    name: "Master FixPC Joyerías ERP (joyeria-erp)",
    description: "Software profesional para gestión de inventarios de joyería, orfebrería y tallado de metales finos.",
    current_version: "5.1.0",
    min_supported_version: "5.0.0",
    is_active: true,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const initialLicenses: License[] = [
  {
    id: "lic_01",
    license_key: "PROD-ENT-8F4A-9C2B-7D1E-0A42",
    company_id: "comp_01",
    company_name: "TechNova Logistics S.A.",
    company_nit: "900.543.821-4",
    app_id: "app_horarios",
    app_slug: "control-horarios",
    app_name: "Control de Horarios Biométrico",
    plan_tier: "Enterprise",
    max_seats: 8,
    current_seats: 6,
    status: "active",
    issued_at: new Date(Date.now() - 45 * 86400000).toISOString(),
    activated_at: new Date(Date.now() - 44 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 320 * 86400000).toISOString(),
    grace_period_days: 3,
    auto_renew: true,
    created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "lic_02",
    license_key: "PROD-PRO-4C8D-1A3E-9B5F-1E8B",
    company_id: "comp_02",
    company_name: "FinSecure Latam Corp",
    company_nit: "901.882.110-9",
    app_id: "app_cotizador",
    app_slug: "cotizador-pro",
    app_name: "Cotizador & ERP Pro",
    plan_tier: "Professional",
    max_seats: 5,
    current_seats: 5,
    status: "active",
    issued_at: new Date(Date.now() - 28 * 86400000).toISOString(),
    activated_at: new Date(Date.now() - 27 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), // Alert in 7 days!
    grace_period_days: 3,
    auto_renew: true,
    created_at: new Date(Date.now() - 28 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "lic_03",
    license_key: "PROD-STD-2A9F-7B3D-6E1C-2F9A",
    company_id: "comp_03",
    company_name: "Nexus Health Systems",
    company_nit: "860.294.001-2",
    app_id: "app_traductor",
    app_slug: "traductor-neural",
    app_name: "Traductor Neural Enterprise",
    plan_tier: "Standard",
    max_seats: 2,
    current_seats: 1,
    status: "active",
    issued_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    activated_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 2 * 86400000).toISOString(), // Critical alert in 2 days!
    grace_period_days: 3,
    auto_renew: false,
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "lic_04",
    license_key: "DEV-ENT-9K1L-3M4N-5P6Q-3D12",
    company_id: "comp_04",
    company_name: "Quantum Media Studios",
    company_nit: "900.123.456-7",
    app_id: "app_horarios",
    app_slug: "control-horarios",
    app_name: "Control de Horarios Biométrico",
    plan_tier: "Enterprise",
    max_seats: 3,
    current_seats: 0,
    status: "paused",
    issued_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    expires_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    grace_period_days: 3,
    auto_renew: false,
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  }
];

export const initialDevices: ActivatedDevice[] = [
  {
    id: "dev_01",
    license_id: "lic_01",
    license_key: "PROD-ENT-8F4A-9C2B-7D1E-0A42",
    machine_fingerprint: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    device_name: "BOGOTA-HQ-TORNIQUETE-01",
    os_info: "Windows 11 Pro 64-bit",
    app_version: "2.4.0",
    ip_address: "186.155.82.14",
    is_active: true,
    activated_at: new Date(Date.now() - 44 * 86400000).toISOString(),
    last_heartbeat_at: new Date(Date.now() - 120000).toISOString(), // 2 min ago (Live)
    heartbeat_count: 1420,
  },
  {
    id: "dev_02",
    license_id: "lic_01",
    license_key: "PROD-ENT-8F4A-9C2B-7D1E-0A42",
    machine_fingerprint: "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
    device_name: "MEDELLIN-PLANTA-BIOMETRIC-02",
    os_info: "Ubuntu Server 22.04 LTS",
    app_version: "2.4.0",
    ip_address: "190.144.20.55",
    is_active: true,
    activated_at: new Date(Date.now() - 40 * 86400000).toISOString(),
    last_heartbeat_at: new Date(Date.now() - 340000).toISOString(), // 5 min ago (Live)
    heartbeat_count: 980,
  },
  {
    id: "dev_03",
    license_id: "lic_02",
    license_key: "PROD-PRO-4C8D-1A3E-9B5F-1E8B",
    machine_fingerprint: "1f8252975249a5b3a37c040d9cbff9f7d08595608b479f67a26f8d3c52a42525",
    device_name: "FIN-LAPTOP-CFO-DELL",
    os_info: "macOS Sonoma 14.6",
    app_version: "3.1.2",
    ip_address: "181.48.90.11",
    is_active: true,
    activated_at: new Date(Date.now() - 27 * 86400000).toISOString(),
    last_heartbeat_at: new Date(Date.now() - 80000).toISOString(), // 1 min ago (Live)
    heartbeat_count: 654,
  }
];

export const initialLogs: LicenseLog[] = [
  {
    id: "log_01",
    license_id: "lic_02",
    license_key: "PROD-PRO-4C8D-1A3E-9B5F-1E8B",
    app_slug: "cotizador-pro",
    event_type: "activate_fraud_blocked",
    machine_fingerprint: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    device_name: "SUSPICIOUS-VM-WIN10",
    ip_address: "45.132.88.204",
    app_version: "3.1.2",
    success: false,
    message: "Límite de puestos alcanzado (5/5). Intento de registro denegado.",
    created_at: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: "log_02",
    license_id: "lic_01",
    license_key: "PROD-ENT-8F4A-9C2B-7D1E-0A42",
    app_slug: "control-horarios",
    event_type: "heartbeat_success",
    machine_fingerprint: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    device_name: "BOGOTA-HQ-TORNIQUETE-01",
    ip_address: "186.155.82.14",
    app_version: "2.4.0",
    success: true,
    message: "Heartbeat ACK recibido.",
    created_at: new Date(Date.now() - 2 * 60000).toISOString(),
  },
  {
    id: "log_03",
    license_id: "lic_03",
    license_key: "PROD-STD-2A9F-7B3D-6E1C-2F9A",
    app_slug: "traductor-neural",
    event_type: "verify_success",
    machine_fingerprint: "7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b",
    device_name: "NEXUS-MED-WORKSTATION-01",
    ip_address: "191.95.22.8",
    app_version: "1.8.0",
    success: true,
    message: "Verificación de licencia exitosa. Aviso de 2 días enviado al cliente.",
    created_at: new Date(Date.now() - 8 * 60000).toISOString(),
  }
];

// Singleton storage in memory
class DataHub {
  private companies: Company[] = [...initialCompanies];
  private apps: Application[] = [...initialApps];
  private licenses: License[] = [...initialLicenses];
  private devices: ActivatedDevice[] = [...initialDevices];
  private logs: LicenseLog[] = [...initialLogs];
  private payments: PaymentRecord[] = [
    {
      id: "pay_01",
      company_id: "comp_01",
      company_name: "TechNova Logistics S.A.",
      license_id: "lic_01",
      payment_provider: "stripe",
      external_transaction_id: "pi_3Nsd92KkLp89201a",
      amount: 450.00,
      currency: "USD",
      status: "succeeded",
      created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
    },
    {
      id: "pay_02",
      company_id: "comp_02",
      company_name: "FinSecure Latam Corp",
      license_id: "lic_02",
      payment_provider: "stripe",
      external_transaction_id: "pi_3Mkk10LlPp22340b",
      amount: 220.00,
      currency: "USD",
      status: "succeeded",
      created_at: new Date(Date.now() - 28 * 86400000).toISOString(),
    }
  ];

  getCompanies() { return this.companies; }
  getCompaniesWithStats(): CompanyWithStats[] {
    return this.companies.map((c) => {
      const clientLicenses = this.licenses.filter((l) => l.company_id === c.id);
      const activeLicenses = clientLicenses.filter((l) => l.status === "active");
      const clientPayments = this.payments.filter((p) => p.company_id === c.id && p.status === "succeeded");
      const totalPaidUSD = clientPayments
        .filter((p) => p.currency === "USD")
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const totalPaidCOP = clientPayments
        .filter((p) => p.currency === "COP")
        .reduce((sum, p) => sum + Number(p.amount), 0);

      return {
        ...c,
        total_licenses: clientLicenses.length,
        active_licenses_count: activeLicenses.length,
        total_paid_usd: totalPaidUSD,
        total_paid_cop: totalPaidCOP,
        licenses: clientLicenses,
        payments: clientPayments,
      };
    });
  }
  getApps() { return this.apps; }
  createApp(app: Omit<Application, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }) {
    const existingIndex = this.apps.findIndex((a) => a.id === app.id || a.slug === app.slug);
    const newApp: Application = {
      ...app,
      created_at: app.created_at || new Date().toISOString(),
      updated_at: app.updated_at || new Date().toISOString(),
    };
    if (existingIndex >= 0) {
      this.apps[existingIndex] = newApp;
    } else {
      this.apps.unshift(newApp);
    }
    return newApp;
  }
  getLicenses() { return this.licenses; }
  getLicenseByKey(key: string) { return this.licenses.find((l) => l.license_key === key); }
  getDevices() { return this.devices; }
  getLogs() { return this.logs; }
  getPayments() { return this.payments; }

  createCompany(c: Omit<Company, 'id' | 'created_at' | 'updated_at'> & { id?: string }) {
    const newComp: Company = {
      ...c,
      id: c.id || `comp_${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.companies.unshift(newComp);
    return newComp;
  }

  createLicense(data: {
    company_id: string;
    app_id: string;
    plan_tier: 'Standard' | 'Professional' | 'Enterprise';
    max_seats: number;
    duration_days: number;
    notes?: string;
  }) {
    const company = this.companies.find(c => c.id === data.company_id);
    let app = this.apps.find(a => a.id === data.app_id || a.slug === data.app_id || (data.app_id === "app_joyeria" && a.slug === "joyeria-erp") || (data.app_id === "masterfixpc-joyerias" && a.slug === "joyeria-erp"));
    if (!app && data.app_id) {
      app = {
        id: data.app_id,
        slug: data.app_id,
        name: data.app_id,
        current_version: "1.0.0",
        min_supported_version: "1.0.0",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.apps.unshift(app);
    }
    if (!company || !app) throw new Error("Compañía o App no encontrada");

    const tierCode = data.plan_tier === 'Standard' ? 'STD' : data.plan_tier === 'Professional' ? 'PRO' : 'ENT';
    const isJoyeria = app.slug === 'joyeria-erp' || app.id === 'joyeria-erp' || data.app_id === 'joyeria-erp' || data.app_id === 'masterfixpc-joyerias';
    const prefix = (app.license_prefix || (isJoyeria ? 'MFP-JOY' : 'PROD')).toUpperCase();
    const key = generateCryptographicLicenseKey(prefix, tierCode);

    const newLic: License = {
      id: `lic_${Date.now()}`,
      license_key: key,
      company_id: company.id,
      company_name: company.name,
      company_nit: company.nit_rut,
      app_id: app.id,
      app_slug: app.slug,
      app_name: app.name,
      plan_tier: data.plan_tier,
      max_seats: data.max_seats,
      current_seats: 0,
      status: 'active',
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + data.duration_days * 86400000).toISOString(),
      grace_period_days: 3,
      auto_renew: true,
      notes: data.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.licenses.unshift(newLic);

    this.addLog({
      license_id: newLic.id,
      license_key: newLic.license_key,
      app_slug: app.slug,
      event_type: 'license_renewed',
      success: true,
      message: `Licencia emitida para ${company.name} (${data.max_seats} cupos, vigencia: ${data.duration_days} días).`,
    });

    return newLic;
  }

  updateLicenseStatus(id: string, status: License['status']) {
    const lic = this.licenses.find(l => l.id === id);
    if (lic) {
      lic.status = status;
      lic.updated_at = new Date().toISOString();
      this.addLog({
        license_id: lic.id,
        license_key: lic.license_key,
        app_slug: lic.app_slug,
        event_type: status === 'revoked' ? 'license_revoked' : 'license_suspended',
        success: true,
        message: `Estado de la licencia cambiado a: ${status.toUpperCase()}`,
      });
    }
    return lic;
  }

  extendLicense(id: string, days: number) {
    const lic = this.licenses.find(l => l.id === id);
    if (lic) {
      const currentExp = new Date(lic.expires_at).getTime();
      const baseTime = currentExp > Date.now() ? currentExp : Date.now();
      lic.expires_at = new Date(baseTime + days * 86400000).toISOString();
      if (lic.status === 'expired') lic.status = 'active';
      lic.updated_at = new Date().toISOString();
      this.addLog({
        license_id: lic.id,
        license_key: lic.license_key,
        app_slug: lic.app_slug,
        event_type: 'license_renewed',
        success: true,
        message: `Extensión manual de vigencia (+${days} días). Nueva fecha: ${lic.expires_at.split('T')[0]}`,
      });
    }
    return lic;
  }

  revokeDevice(deviceId: string) {
    const dev = this.devices.find(d => d.id === deviceId);
    if (dev) {
      dev.is_active = false;
      const lic = this.licenses.find(l => l.id === dev.license_id);
      if (lic) {
        const activeSeats = this.devices.filter(d => d.license_id === lic.id && d.is_active).length;
        lic.current_seats = activeSeats;
        this.addLog({
          license_id: lic.id,
          license_key: lic.license_key,
          app_slug: lic.app_slug,
          event_type: 'device_deactivated',
          machine_fingerprint: dev.machine_fingerprint,
          device_name: dev.device_name,
          success: true,
          message: `Equipo ${dev.device_name} (${dev.machine_fingerprint.substring(0, 12)}...) desvinculado forzosamente. Cupos en uso: ${activeSeats}/${lic.max_seats}.`,
        });
      }
      return { success: true, device: dev };
    }
    return { success: false, message: 'Dispositivo no encontrado.' };
  }

  activateDevice(params: {
    license_key: string;
    app_slug: string;
    machine_fingerprint: string;
    device_name: string;
    os_info?: string;
    app_version: string;
    ip_address?: string;
  }) {
    const lic = this.licenses.find(l => l.license_key === params.license_key && (l.app_slug === params.app_slug || !params.app_slug || params.app_slug === "coreauth" || ((params.app_slug === "joyeria-erp" || params.app_slug === "masterfixpc-joyerias") && l.app_slug === "joyeria-erp")));
    if (!lic) {
      this.addLog({
        event_type: 'activate_attempt',
        machine_fingerprint: params.machine_fingerprint,
        device_name: params.device_name,
        ip_address: params.ip_address,
        app_version: params.app_version,
        success: false,
        message: 'Clave de licencia no encontrada o no corresponde a esta aplicación.'
      });
      return { success: false, code: 'INVALID_LICENSE', message: 'Licencia no válida.' };
    }

    if (lic.status === 'revoked') {
      return { success: false, code: 'LICENSE_REVOKED', message: 'Licencia revocada.' };
    }
    if (lic.status === 'paused') {
      return { success: false, code: 'LICENSE_PAUSED', message: 'Licencia pausada.' };
    }
    if (new Date(lic.expires_at).getTime() < Date.now()) {
      lic.status = 'expired';
      return { success: false, code: 'LICENSE_EXPIRED', message: 'Licencia vencida.' };
    }

    // Check existing device
    const existing = this.devices.find(d => d.license_id === lic.id && d.machine_fingerprint === params.machine_fingerprint);
    if (existing) {
      existing.is_active = true;
      existing.last_heartbeat_at = new Date().toISOString();
      existing.device_name = params.device_name;
      existing.app_version = params.app_version;
      existing.heartbeat_count += 1;
      const activeSeats = this.devices.filter(d => d.license_id === lic.id && d.is_active).length;
      lic.current_seats = activeSeats;
      return {
        success: true,
        code: 'DEVICE_REACTIVATED',
        license: lic,
        device: existing
      };
    }

    // Check seat count
    const activeSeats = this.devices.filter(d => d.license_id === lic.id && d.is_active).length;
    if (activeSeats >= lic.max_seats) {
      this.addLog({
        license_id: lic.id,
        license_key: lic.license_key,
        app_slug: lic.app_slug,
        event_type: 'activate_fraud_blocked',
        machine_fingerprint: params.machine_fingerprint,
        device_name: params.device_name,
        ip_address: params.ip_address,
        app_version: params.app_version,
        success: false,
        message: `Límite de puestos superado (${activeSeats}/${lic.max_seats}). Activación rechazada.`
      });
      return {
        success: false,
        code: 'MAX_SEATS_REACHED',
        message: `Límite de puestos alcanzado (${activeSeats}/${lic.max_seats}). Libere un equipo o amplíe el plan.`,
        max_seats: lic.max_seats,
        current_seats: activeSeats
      };
    }

    // Add device
    const newDev: ActivatedDevice = {
      id: `dev_${Date.now()}`,
      license_id: lic.id,
      license_key: lic.license_key,
      machine_fingerprint: params.machine_fingerprint,
      device_name: params.device_name,
      os_info: params.os_info,
      app_version: params.app_version,
      ip_address: params.ip_address,
      is_active: true,
      activated_at: new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
      heartbeat_count: 1
    };
    this.devices.push(newDev);
    lic.current_seats = activeSeats + 1;
    if (!lic.activated_at) lic.activated_at = new Date().toISOString();

    this.addLog({
      license_id: lic.id,
      license_key: lic.license_key,
      app_slug: lic.app_slug,
      event_type: 'activate_success',
      machine_fingerprint: params.machine_fingerprint,
      device_name: params.device_name,
      ip_address: params.ip_address,
      app_version: params.app_version,
      success: true,
      message: 'Equipo vinculado exitosamente a la licencia.'
    });

    return {
      success: true,
      code: 'DEVICE_ACTIVATED',
      license: lic,
      device: newDev
    };
  }

  verifyLicense(params: {
    license_key: string;
    app_slug: string;
    machine_fingerprint: string;
    app_version: string;
    ip_address?: string;
  }) {
    const lic = this.licenses.find(l => l.license_key === params.license_key && (l.app_slug === params.app_slug || !params.app_slug || params.app_slug === "coreauth" || ((params.app_slug === "joyeria-erp" || params.app_slug === "masterfixpc-joyerias") && l.app_slug === "joyeria-erp")));
    if (!lic) {
      return { valid: false, code: 'INVALID_LICENSE', message: 'Licencia no válida.' };
    }

    if (lic.status === 'revoked') return { valid: false, code: 'LICENSE_REVOKED', message: 'Licencia revocada.' };
    if (lic.status === 'paused') return { valid: false, code: 'LICENSE_PAUSED', message: 'Licencia pausada.' };

    const expiresTime = new Date(lic.expires_at).getTime();
    if (expiresTime < Date.now()) {
      lic.status = 'expired';
      return { valid: false, code: 'LICENSE_EXPIRED', message: 'Licencia caducada.' };
    }

    const device = this.devices.find(d => d.license_id === lic.id && d.machine_fingerprint === params.machine_fingerprint);
    if (!device || !device.is_active) {
      return { valid: false, code: 'DEVICE_NOT_AUTHORIZED', message: 'Dispositivo no registrado en esta licencia.' };
    }

    // Telemetry update
    device.last_heartbeat_at = new Date().toISOString();
    device.app_version = params.app_version;
    if (params.ip_address) device.ip_address = params.ip_address;

    const daysRemaining = Math.max(0, Math.floor((expiresTime - Date.now()) / (1000 * 60 * 60 * 24)));

    let showAlert = false;
    let alertLevel: 'none' | 'notice' | 'info' | 'warning' | 'urgent' | 'critical' = 'none';
    let alertMessage: string | null = null;

    if (daysRemaining <= 1) {
      showAlert = true;
      alertLevel = 'critical';
      alertMessage = '¡Su licencia expira en menos de 24 horas! Renueve ahora para evitar la suspensión del servicio.';
    } else if (daysRemaining <= 3) {
      showAlert = true;
      alertLevel = 'urgent';
      alertMessage = `Atención: Su licencia expirará en ${daysRemaining} días.`;
    } else if (daysRemaining <= 7) {
      showAlert = true;
      alertLevel = 'warning';
      alertMessage = `Recordatorio: Quedan ${daysRemaining} días de vigencia en su licencia.`;
    } else if (daysRemaining <= 15) {
      showAlert = true;
      alertLevel = 'info';
      alertMessage = `Su licencia vencerá en ${daysRemaining} días. Considere agendar la renovación.`;
    } else if (daysRemaining <= 30) {
      showAlert = true;
      alertLevel = 'notice';
      alertMessage = `Aviso informativo: Ciclo de suscripción finaliza en ${daysRemaining} días.`;
    }

    return {
      valid: true,
      code: 'VALID',
      license: lic,
      days_remaining: daysRemaining,
      alerts: {
        show_alert: showAlert,
        level: alertLevel,
        message: alertMessage,
        days_remaining: daysRemaining,
      }
    };
  }

  heartbeat(params: { license_key: string; machine_fingerprint: string; ip_address?: string }) {
    const lic = this.licenses.find(l => l.license_key === params.license_key);
    if (!lic || lic.status !== 'active') return { success: false, code: 'LICENSE_INACTIVE' };

    const dev = this.devices.find(d => d.license_id === lic.id && d.machine_fingerprint === params.machine_fingerprint && d.is_active);
    if (!dev) return { success: false, code: 'DEVICE_NOT_FOUND' };

    dev.last_heartbeat_at = new Date().toISOString();
    dev.heartbeat_count += 1;
    if (params.ip_address) dev.ip_address = params.ip_address;

    return { success: true, code: 'HEARTBEAT_ACK', timestamp: new Date().toISOString() };
  }

  processPayment(payload: {
    external_transaction_id: string;
    company_id: string;
    license_id?: string;
    amount: number;
    currency: string;
    status: 'succeeded' | 'failed';
    days_to_extend?: number;
  }) {
    const payment: PaymentRecord = {
      id: `pay_${Date.now()}`,
      company_id: payload.company_id,
      license_id: payload.license_id,
      payment_provider: 'stripe',
      external_transaction_id: payload.external_transaction_id,
      amount: payload.amount,
      currency: payload.currency,
      status: payload.status,
      created_at: new Date().toISOString(),
    };
    this.payments.unshift(payment);

    if (payload.license_id && payload.status === 'succeeded') {
      const lic = this.licenses.find(l => l.id === payload.license_id);
      if (lic) {
        const extension = (payload.days_to_extend || 365) * 86400000;
        const currentExp = new Date(lic.expires_at).getTime();
        const baseTime = currentExp > Date.now() ? currentExp : Date.now();
        lic.expires_at = new Date(baseTime + extension).toISOString();
        lic.status = 'active';
        lic.updated_at = new Date().toISOString();
        this.addLog({
          license_id: lic.id,
          license_key: lic.license_key,
          app_slug: lic.app_slug,
          event_type: 'license_renewed',
          success: true,
          message: `Renovación de pago exitosa ($${payload.amount} ${payload.currency}). Vigencia extendida por ${payload.days_to_extend || 365} días.`,
        });
      }
    } else if (payload.license_id && payload.status === 'failed') {
      const lic = this.licenses.find(l => l.id === payload.license_id);
      if (lic) {
        lic.status = 'paused';
        this.addLog({
          license_id: lic.id,
          license_key: lic.license_key,
          app_slug: lic.app_slug,
          event_type: 'license_suspended',
          success: false,
          message: `Pago de renovación fallido ($${payload.amount} ${payload.currency}). Licencia suspendida preventivamente.`,
        });
      }
    }

    return payment;
  }

  processManualPayment(payload: {
    company_id: string;
    license_id?: string;
    amount: number;
    currency: 'COP' | 'USD';
    payment_method: 'Transferencia Bancaria' | 'Nequi' | 'PSE' | 'Efectivo' | 'Tarjeta';
    reference_id?: string;
    action_on_license: 'extend_30' | 'extend_180' | 'extend_365' | 'reactivate' | 'none';
    notes?: string;
  }) {
    const comp = this.companies.find((c) => c.id === payload.company_id);
    if (!comp) throw new Error("Cliente/Empresa no encontrado");

    let lic: License | undefined;
    if (payload.license_id) {
      lic = this.licenses.find((l) => l.id === payload.license_id);
    }

    let daysToExtend = 0;
    if (payload.action_on_license === "extend_30") daysToExtend = 30;
    else if (payload.action_on_license === "extend_180") daysToExtend = 180;
    else if (payload.action_on_license === "extend_365") daysToExtend = 365;

    if (lic && daysToExtend > 0) {
      const currentExp = new Date(lic.expires_at).getTime();
      const baseTime = currentExp > Date.now() ? currentExp : Date.now();
      lic.expires_at = new Date(baseTime + daysToExtend * 86400000).toISOString();
      lic.status = "active";
      lic.updated_at = new Date().toISOString();
    } else if (lic && payload.action_on_license === "reactivate") {
      lic.status = "active";
      lic.updated_at = new Date().toISOString();
    }

    const payment: PaymentRecord = {
      id: `pay_${Date.now()}`,
      company_id: comp.id,
      company_name: comp.name,
      license_id: lic?.id,
      payment_provider: "wire",
      payment_method: payload.payment_method,
      external_transaction_id: payload.reference_id || `MAN-${Date.now().toString().slice(-6)}`,
      amount: Number(payload.amount),
      currency: payload.currency,
      status: "succeeded",
      created_at: new Date().toISOString(),
    };
    this.payments.unshift(payment);

    this.addLog({
      license_id: lic?.id,
      license_key: lic?.license_key,
      app_slug: lic?.app_slug,
      event_type: "license_renewed",
      success: true,
      message: `Pago manual registrado ($${Number(payload.amount).toLocaleString()} ${payload.currency} vía ${payload.payment_method}). Ref: ${payment.external_transaction_id}. ${
        daysToExtend > 0
          ? `Vigencia extendida por +${daysToExtend} días.`
          : lic
          ? `Licencia reactivada.`
          : `Pago asentado para ${comp.name}.`
      }`,
    });

    return {
      success: true,
      payment,
      license: lic,
    };
  }

  addLog(log: Omit<LicenseLog, 'id' | 'created_at'>) {
    const newLog: LicenseLog = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      created_at: new Date().toISOString(),
    };
    this.logs.unshift(newLog);
    if (this.logs.length > 500) this.logs.pop();
    return newLog;
  }
}

// Global instance in memory for Next.js App Router
const globalStore = (global as any)._coreAuthStore || new DataHub();
if (process.env.NODE_ENV !== 'production') {
  (global as any)._coreAuthStore = globalStore;
}

export const store = globalStore as DataHub;
