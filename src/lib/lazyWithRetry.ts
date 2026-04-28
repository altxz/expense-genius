import { ComponentType, lazy } from "react";

const CHUNK_RELOAD_KEY = "lovable:chunk-reload";
const CHUNK_RELOAD_COOLDOWN_MS = 10_000;

function isDynamicImportError(message: string) {
  return [
    /Failed to fetch dynamically imported module/i,
    /Importing a module script failed/i,
    /error loading dynamically imported module/i,
  ].some((pattern) => pattern.test(message));
}

function handleChunkReload() {
  if (typeof window === "undefined") return false;

  const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
  if (Date.now() - last <= CHUNK_RELOAD_COOLDOWN_MS) return false;

  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  window.location.reload();
  return true;
}

export async function retryDynamicImport<T>(factory: () => Promise<T>): Promise<T> {
  try {
    return await factory();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (isDynamicImportError(message) && handleChunkReload()) {
      return new Promise(() => {}) as Promise<T>;
    }

    throw error;
  }
}

export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(() => retryDynamicImport(factory));
}

export function lazyNamedWithRetry<TModule, TComponent extends ComponentType<unknown>>(
  factory: () => Promise<TModule>,
  pick: (module: TModule) => TComponent,
) {
  return lazy(() =>
    retryDynamicImport(async () => {
      const module = await factory();
      return { default: pick(module) };
    }),
  );
}