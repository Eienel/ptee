/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional dedicated mainnet RPC endpoint, baked in at build time. */
  readonly VITE_RPC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
