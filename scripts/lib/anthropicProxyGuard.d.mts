// Types for the plain-JS guard, so vite.config.ts can import it under `tsc --noEmit`.
// The implementation is .mjs because it is also loaded directly by its test and by Node.

export declare const ANTHROPIC_PROXY_PREFIX: string
export declare const ALLOWED_METHOD: string
export declare const ALLOWED_PATHS: readonly string[]

export declare function isLoopbackAddress(addr: string | undefined | null): boolean
export declare function hostnameOf(value: string | undefined | null): string
export declare function isLocalHostname(value: string | undefined | null): boolean

export interface AnthropicProxyRequest {
  method?: string
  url?: string
  headers?: Record<string, string | string[] | undefined>
  remoteAddress?: string
  isPublicSite?: boolean
  isDev?: boolean
}

export type AnthropicProxyVerdict =
  | { allow: true }
  | { allow: false; status: number; reason: string }

export declare function checkAnthropicProxyRequest(req: AnthropicProxyRequest): AnthropicProxyVerdict
