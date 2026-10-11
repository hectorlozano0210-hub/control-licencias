export type LicenseStatus = 'active' | 'paused' | 'expired' | 'revoked';
export type CompanyStatus = 'active' | 'suspended' | 'trial';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface Company {
  id: string;
  name: string;
  company_name?: string;
  nit_rut: string;
  tax_id?: string;
  legal_name?: string;
  contact_name?: string;
  email: string;
  contact_email?: string;
  phone?: string;
  contact_phone?: string;
  status: CompanyStatus;
  billing_address?: Record<string, any>;
  metadata?: Record<string, any>;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyWithStats extends Company {
  total_licenses: number;
  active_licenses_count: number;
  total_paid_usd: number;
  total_paid_cop: number;
  licenses?: License[];
  payments?: PaymentRecord[];
}

export interface Application {
  id: string;
  slug: string;
  name: string;
  license_prefix?: string;
  description?: string;
  app_secret_hash?: string;
  public_signing_key?: string;
  current_version: string;
  min_supported_version: string;
  webhook_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface License {
  id: string;
  license_key: string;
  company_id: string;
  company_name?: string;
  company_nit?: string;
  app_id: string;
  app_slug?: string;
  app_name?: string;
  plan_tier: 'Standard' | 'Professional' | 'Enterprise';
  max_seats: number;
  current_seats: number;
  status: LicenseStatus;
  issued_at: string;
  activated_at?: string;
  expires_at: string;
  grace_period_days: number;
  auto_renew: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ActivatedDevice {
  id: string;
  license_id: string;
  license_key?: string;
  machine_fingerprint: string;
  device_name: string;
  os_info?: string;
  app_version: string;
  ip_address?: string;
  is_active: boolean;
  activated_at: string;
  last_heartbeat_at: string;
  heartbeat_count: number;
}

export interface LicenseLog {
  id: string;
  license_id?: string;
  license_key?: string;
  app_id?: string;
  app_slug?: string;
  event_type: 
    | 'activate_attempt'
    | 'activate_success'
    | 'activate_fraud_blocked'
    | 'verify_success'
    | 'verify_failed'
    | 'heartbeat_success'
    | 'heartbeat_timeout'
    | 'device_deactivated'
    | 'license_renewed'
    | 'license_suspended'
    | 'license_revoked';
  machine_fingerprint?: string;
  device_name?: string;
  ip_address?: string;
  app_version?: string;
  success: boolean;
  message?: string;
  payload?: Record<string, any>;
  created_at: string;
}

export interface PaymentRecord {
  id: string;
  company_id: string;
  company_name?: string;
  license_id?: string;
  payment_provider: 'stripe' | 'mercadopago' | 'wire';
  external_transaction_id?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payment_method?: string;
  invoice_url?: string;
  period_start?: string;
  period_end?: string;
  created_at: string;
}

export interface ExpiryAlert {
  show_alert: boolean;
  level: 'none' | 'notice' | 'info' | 'warning' | 'urgent' | 'critical';
  message: string | null;
  days_remaining: number;
}
