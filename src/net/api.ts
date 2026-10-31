/**
 * Google Apps Script API 呼叫
 * - 使用 Content-Type: text/plain 的 POST（CORS「簡單請求」，不觸發預檢）。
 * - Apps Script 回應會 302 轉址至 script.googleusercontent.com，fetch 預設跟隨轉址並可讀取 JSON。
 * - 不使用 no-cors（無法讀取回應），也不使用 JSONP。
 */
import { DEFAULT_GAS_URL } from '../config/site';

const envUrl = (import.meta.env.VITE_GAS_URL as string | undefined)?.trim();
export const GAS_URL: string = envUrl === 'off' ? '' : envUrl || DEFAULT_GAS_URL;

export interface ApiError {
  ok: false;
  error: string;
  retryAfter?: number;
}

export async function callGas<T extends object>(action: string, body: Record<string, unknown> = {}, timeoutMs = 15000): Promise<(T & { ok: true; serverTime: number }) | ApiError> {
  if (!GAS_URL) return { ok: false, error: 'not_configured' };
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...body }),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, error: `http_${res.status}` };
    return await res.json();
  } catch (err) {
    return { ok: false, error: (err as Error).name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    window.clearTimeout(timer);
  }
}

/** 頁面關閉時通知離開（盡力而為；送不到時由伺服器的心跳逾時移除） */
export function beaconGas(action: string, body: Record<string, unknown>) {
  if (!GAS_URL) return;
  try {
    navigator.sendBeacon?.(GAS_URL, new Blob([JSON.stringify({ action, ...body })], { type: 'text/plain;charset=utf-8' }));
  } catch {
    // ignore
  }
}
