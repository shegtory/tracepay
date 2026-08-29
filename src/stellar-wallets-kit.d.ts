// TypeScript ambient declarations for @creit.tech/stellar-wallets-kit
// The npm package ships .js files with companion .d.ts files in node_modules,
// but TSC's moduleResolution=node16 can't auto-resolve named subpath imports.
// These ambient declare blocks provide the types directly so the type checker
// accepts the imports used in .js/.jsx source files.

declare module '@creit.tech/stellar-wallets-kit/sdk' {
  export interface WalletState {
    address: string | null
    networkPassphrase: string
    [key: string]: unknown
  }

  export interface AuthModalOptions {
    showInstallLabel?: boolean
    hideUnsupportedWallets?: boolean
    authOptions?: string[]
  }

  export interface SignTransactionOptions {
    address: string
    networkPassphrase: string
  }

  export class StellarWalletsKit {
    static init(options: {
      modules: Record<string, unknown>
      network: string
      authModal?: AuthModalOptions
    }): void
    static getState(): WalletState | null
    static authModal(): Promise<{ address: string; networkPassphrase: string }>
    static getNetwork(): Promise<{ networkPassphrase: string }>
    static disconnect(): void
    static profileModal(): void
    static on(
      event: string,
      callback: (event: { payload: { address: string | null } }) => void
    ): () => void
    static signTransaction(
      xdr: string,
      options: SignTransactionOptions
    ): Promise<{ signedTxXdr: string }>
  }
}

declare module '@creit.tech/stellar-wallets-kit/types' {
  export type KitEventType =
    | 'STATE_UPDATED'
    | 'DISCONNECT'
    | 'WALLET_SELECTED'
    | 'HW_ACCOUNTS_FETCHER'
}

declare module '@creit.tech/stellar-wallets-kit/modules/utils' {
  export interface DefaultModulesOptions {
    [key: string]: unknown
  }

  export function defaultModules(opts?: DefaultModulesOptions): Record<string, unknown>
}
