"use client";

import { useState, useEffect, useCallback } from "react";
import { CoreAuthClient, defaultLicenseClient, StoredLicenseState } from "./client-sdk";

export interface UseLicenseReturn {
  isLicensed: boolean;
  isOfflineGraceActive: boolean;
  offlineDaysRemaining: number;
  license: StoredLicenseState | null;
  fingerprint: string;
  defaultDeviceName: string;
  loading: boolean;
  error: string | null;
  errorCode: string | null;
  activateLicense: (key: string, deviceName?: string) => Promise<{ success: boolean; message: string; code?: string }>;
  deactivateLicense: () => void;
  checkLicense: () => Promise<void>;
}

export function useLicense(client: CoreAuthClient = defaultLicenseClient): UseLicenseReturn {
  const [license, setLicense] = useState<StoredLicenseState | null>(null);
  const [isLicensed, setIsLicensed] = useState<boolean>(false);
  const [isOfflineGraceActive, setIsOfflineGraceActive] = useState<boolean>(false);
  const [offlineDaysRemaining, setOfflineDaysRemaining] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const refreshState = useCallback(() => {
    const stored = client.getStoredState();
    setLicense(stored);

    if (stored && stored.token) {
      const offlineStatus = client.checkOfflineValidity();
      setIsLicensed(offlineStatus.valid);
      setIsOfflineGraceActive(offlineStatus.valid);
      setOfflineDaysRemaining(offlineStatus.daysRemaining);
    } else {
      setIsLicensed(false);
      setIsOfflineGraceActive(false);
      setOfflineDaysRemaining(0);
    }
  }, [client]);

  const checkLicense = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const res = await client.verify();
      setIsLicensed(res.valid);
      setIsOfflineGraceActive(Boolean(res.isOfflineMode));
      if (res.offlineDaysRemaining !== undefined) {
        setOfflineDaysRemaining(res.offlineDaysRemaining);
      }
      setLicense(client.getStoredState());
      if (!res.valid) {
        setError(res.message);
        setErrorCode(res.code);
      }
    } catch (err: any) {
      const offlineStatus = client.checkOfflineValidity();
      setIsLicensed(offlineStatus.valid);
      setIsOfflineGraceActive(offlineStatus.valid);
      setOfflineDaysRemaining(offlineStatus.daysRemaining);
      if (!offlineStatus.valid) {
        setError("Error al verificar la licencia y no hay período offline vigente.");
      }
    } finally {
      setLoading(false);
    }
  }, [client]);

  const activateLicense = useCallback(
    async (key: string, deviceName?: string) => {
      setLoading(true);
      setError(null);
      setErrorCode(null);

      const result = await client.activate(key, deviceName);

      if (result.success && result.license) {
        setLicense(result.license);
        setIsLicensed(true);
        setIsOfflineGraceActive(false);
        const offlineCheck = client.checkOfflineValidity();
        setOfflineDaysRemaining(offlineCheck.daysRemaining);
        setLoading(false);
        return { success: true, message: result.message, code: result.code };
      } else {
        setError(result.message);
        setErrorCode(result.code);
        setLoading(false);
        return { success: false, message: result.message, code: result.code };
      }
    },
    [client]
  );

  const deactivateLicense = useCallback(() => {
    client.clearLicense();
    setLicense(null);
    setIsLicensed(false);
    setIsOfflineGraceActive(false);
    setOfflineDaysRemaining(0);
    setError(null);
    setErrorCode(null);
  }, [client]);

  useEffect(() => {
    refreshState();
    checkLicense();

    const unsubStatus = client.onStatusChange((status) => {
      if (status === "valid") {
        setIsLicensed(true);
        refreshState();
      } else if (status === "offline_grace") {
        setIsLicensed(true);
        setIsOfflineGraceActive(true);
      } else {
        setIsLicensed(false);
        setIsOfflineGraceActive(false);
      }
    });

    return () => {
      unsubStatus();
    };
  }, [client, refreshState, checkLicense]);

  return {
    isLicensed,
    isOfflineGraceActive,
    offlineDaysRemaining,
    license,
    fingerprint: client.getDeviceFingerprint(),
    defaultDeviceName: client.getDefaultDeviceName(),
    loading,
    error,
    errorCode,
    activateLicense,
    deactivateLicense,
    checkLicense,
  };
}
