"use client";

import { useState, useEffect, useCallback } from "react";
import {
  WalletCredentials, HederaNetwork,
  validatePrivateKey, isValidAccountId,
} from "@/lib/hederaClient";
import {
  encryptPrivateKey, decryptPrivateKey,
  checkPasswordStrength, PasswordStrength,
  EncryptedStore, StoredCredentials,
} from "@/lib/crypto";

const STORAGE_KEY = "minthon_wallet_v2";

// ─── Storage states ───────────────────────────────────────────────────────────
// "none"    — nothing in localStorage
// "locked"  — encrypted ciphertext in localStorage, needs password to unlock
// "unlocked"— decrypted and ready to use
// "plain"   — legacy unencrypted save (auto-migrated on next save)
export type StorageState = "none" | "locked" | "unlocked" | "plain";

export function useWalletCredentials() {
  // Credential fields
  const [accountId, setAccountId]   = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [network, setNetwork]       = useState<HederaNetwork>("testnet");

  // Validation
  const [validating, setValidating] = useState(false);
  const [keyValid, setKeyValid]     = useState<boolean | null>(null);
  const [keyError, setKeyError]     = useState<string | null>(null);

  // Remember / encryption options
  const [remember, setRemember]         = useState(false);
  const [useEncryption, setUseEncryption] = useState(true); // default ON

  // Encryption password UI
  const [encPassword, setEncPassword]       = useState("");
  const [encPasswordConfirm, setEncPasswordConfirm] = useState("");
  const [encPasswordStrength, setEncPasswordStrength] = useState<PasswordStrength | null>(null);

  // Unlock password (for loading from locked storage)
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError]       = useState<string | null>(null);
  const [unlocking, setUnlocking]           = useState(false);

  // Storage state
  const [storageState, setStorageState] = useState<StorageState>("none");
  const [saving, setSaving]             = useState(false);

  // ── On mount: detect what's in localStorage ──────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { setStorageState("none"); return; }
      const stored: StoredCredentials = JSON.parse(raw);
      if (stored.encrypted === true) {
        // Encrypted — show unlock prompt
        setAccountId(stored.accountId ?? "");
        setNetwork((stored.network as HederaNetwork) ?? "testnet");
        setStorageState("locked");
      } else {
        // Legacy plain save — load immediately, prompt to re-save encrypted
        setAccountId(stored.accountId ?? "");
        setPrivateKey(stored.privateKey ?? "");
        setNetwork((stored.network as HederaNetwork) ?? "testnet");
        setRemember(true);
        setStorageState("plain");
      }
    } catch {
      setStorageState("none");
    }
  }, []);

  // ── Validate private key (debounced) ──────────────────────────────────────
  useEffect(() => {
    if (!privateKey.trim()) { setKeyValid(null); setKeyError(null); return; }
    const timer = setTimeout(async () => {
      setValidating(true);
      const result = await validatePrivateKey(privateKey.trim());
      setKeyValid(result.valid);
      setKeyError(result.valid ? null : (result.error ?? "Invalid key"));
      setValidating(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [privateKey]);

  // ── Update password strength as user types ────────────────────────────────
  useEffect(() => {
    if (!encPassword) { setEncPasswordStrength(null); return; }
    setEncPasswordStrength(checkPasswordStrength(encPassword));
  }, [encPassword]);

  // ── Unlock encrypted credentials ──────────────────────────────────────────
  const unlock = useCallback(async () => {
    if (!unlockPassword) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) throw new Error("No stored credentials found");
      const stored: EncryptedStore = JSON.parse(raw);
      const decrypted = await decryptPrivateKey(stored, unlockPassword);
      setPrivateKey(decrypted);
      setStorageState("unlocked");
      setUnlockPassword("");
    } catch (err) {
      setUnlockError(err instanceof Error ? err.message : "Decryption failed");
    }
    setUnlocking(false);
  }, [unlockPassword]);

  // ── Save credentials to localStorage ─────────────────────────────────────
  const saveToStorage = useCallback(async (): Promise<{success:boolean;error?:string}> => {
    if (!remember) {
      localStorage.removeItem(STORAGE_KEY);
      return { success: true };
    }

    if (useEncryption) {
      // Validate passwords match and are strong enough
      if (!encPassword) return { success: false, error: "Enter an encryption password" };
      if (encPassword !== encPasswordConfirm) return { success: false, error: "Passwords do not match" };
      const strength = checkPasswordStrength(encPassword);
      if (strength.score < 2) return { success: false, error: "Password too weak — add length, numbers, or symbols" };

      setSaving(true);
      try {
        const stored = await encryptPrivateKey(privateKey.trim(), encPassword, accountId.trim(), network);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        setStorageState("unlocked");
        setEncPassword("");
        setEncPasswordConfirm("");
        setSaving(false);
        return { success: true };
      } catch (err) {
        setSaving(false);
        return { success: false, error: err instanceof Error ? err.message : "Encryption failed" };
      }
    } else {
      // Plain save (not recommended — warn via UI)
      const store: StoredCredentials = {
        encrypted: false,
        privateKey: privateKey.trim(),
        accountId: accountId.trim(),
        network,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      setStorageState("plain");
      return { success: true };
    }
  }, [remember, useEncryption, encPassword, encPasswordConfirm, privateKey, accountId, network]);

  // ── Clear everything ──────────────────────────────────────────────────────
  const clearCredentials = useCallback(() => {
    setAccountId("");
    setPrivateKey("");
    setKeyValid(null);
    setKeyError(null);
    setRemember(false);
    setEncPassword("");
    setEncPasswordConfirm("");
    setUnlockPassword("");
    setUnlockError(null);
    setStorageState("none");
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // ── Get credentials for signing ───────────────────────────────────────────
  const getCredentials = useCallback((): WalletCredentials | null => {
    if (!accountId.trim() || !privateKey.trim() || !keyValid) return null;
    if (!isValidAccountId(accountId.trim())) return null;
    return { accountId: accountId.trim(), privateKey: privateKey.trim(), network };
  }, [accountId, privateKey, network, keyValid]);

  const isReady = Boolean(
    accountId.trim() && isValidAccountId(accountId.trim()) &&
    privateKey.trim() && keyValid
  );

  const passwordsMatch = encPassword === encPasswordConfirm && encPassword.length > 0;
  const canSaveEncrypted = Boolean(
    encPassword && encPasswordConfirm &&
    passwordsMatch &&
    encPasswordStrength && encPasswordStrength.score >= 2
  );

  return {
    // Credential state
    accountId, setAccountId,
    privateKey, setPrivateKey,
    network, setNetwork,
    keyValid, keyError, validating,
    isReady,
    getCredentials,

    // Remember / save options
    remember, setRemember,
    useEncryption, setUseEncryption,
    saving,
    saveToStorage,
    clearCredentials,

    // Encryption password setup
    encPassword, setEncPassword,
    encPasswordConfirm, setEncPasswordConfirm,
    encPasswordStrength,
    passwordsMatch,
    canSaveEncrypted,

    // Unlock (for loading from locked storage)
    storageState,
    unlockPassword, setUnlockPassword,
    unlockError,
    unlocking,
    unlock,
  };
}
