/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dedicated Solana RPC endpoint. Public endpoints cannot handle this scan. */
  readonly VITE_RPC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
