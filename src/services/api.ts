import Constants from "expo-constants";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function getHostHint(): string | null {
  const expoHostUri = Constants.expoConfig?.hostUri;
  if (expoHostUri) {
    return expoHostUri.split(":")[0] ?? null;
  }

  const debuggerHost =
    (Constants as typeof Constants & { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } }).manifest2
      ?.extra?.expoGo?.debuggerHost;

  if (debuggerHost) {
    return debuggerHost.split(":")[0] ?? null;
  }

  return null;
}

export function getApiBaseUrl(): string | null {
  const explicit = process.env.EXPO_PUBLIC_STEPWISE_API_BASE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location?.hostname) {
    const host = window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname;
    return `http://${host}:8787`;
  }

  const hostHint = getHostHint();
  if (hostHint) {
    return `http://${hostHint}:8787`;
  }

  return null;
}

export function hasApiBaseUrl(): boolean {
  return Boolean(getApiBaseUrl());
}

export async function postJson<TResponse>(path: string, body: Record<string, JsonValue>): Promise<TResponse> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Stepwise API server is not configured.");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let payload: any = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message =
      typeof payload?.error?.message === "string" && payload.error.message.trim()
        ? payload.error.message.trim()
        : `Request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return payload as TResponse;
}
