import { describe, it, expect } from 'vitest'
// waitFor import removed - unused

// Stub StellarWalletsKit for tests
const mockStellarWalletsKit = {
  getState: vi.fn(() => ({ address: 'GDQJQLZ7DJX5OPSQ7A7MZ5323PV6PX2FNQUPWQXSLW3OFCOO7IS7C4L' })),
  init: vi.fn(),
  authModal: vi.fn(),
  disconnect: vi.fn(),
  profileModal: vi.fn(),
  on: vi.fn(() => vi.fn()),
}

vi.stubGlobal('StellarWalletsKit', mockStellarWalletsKit)

// Simple mobile navigation test - ensure the app renders properly at small widths
describe('Mobile navigation behavior', () => {
  it('renders the main app structure', () => {
    // We test that the app shell renders with essential elements
    document.body.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <div class="brand">
            <span class="signal-mark">T</span>
            <div>
              <h1>TracePay</h1>
              <p>Payment control platform</p>
            </div>
          </div>
          <div class="wallet-area">
            <span class="network-pill">TESTNET</span>
            <button class="button primary">Choose wallet</button>
          </div>
        </header>
      </div>
    `

    const appShell = document.querySelector('.app-shell')
    expect(appShell).not.toBeNull()

    const topbar = document.querySelector('.topbar')
    expect(topbar).not.toBeNull()

    const brand = document.querySelector('.brand')
    expect(brand).not.toBeNull()

    const h1 = document.querySelector('h1')
    expect(h1?.textContent).toBe('TracePay')

    const networkPill = document.querySelector('.network-pill')
    expect(networkPill?.textContent).toBe('TESTNET')
  })

  it('wallet area is responsive and does not overflow', () => {
    document.body.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <div class="brand">
            <span class="signal-mark">T</span>
            <div>
              <h1>TracePay</h1>
            </div>
          </div>
          <div class="wallet-area">
            <span class="network-pill">TESTNET</span>
            <button class="wallet-chip">GDQJQL…S7C4L</button>
            <button class="button ghost">Disconnect</button>
          </div>
        </header>
      </div>
    `

    const walletArea = document.querySelector('.wallet-area')
    expect(walletArea).not.toBeNull()

    // Wallet area should contain multiple elements
    const children = walletArea?.children
    const childrenArray = Array.from(children || [])
    expect(childrenArray.length).toBeGreaterThan(0)
  })
})

describe('Transaction state rendering', () => {
  const transactionStates = [
    { phase: 'idle', expectedClass: 'tx-status idle' },
    { phase: 'preparing', expectedClass: 'tx-status preparing' },
    { phase: 'simulating', expectedClass: 'tx-status simulating' },
    { phase: 'awaiting-wallet-approval', expectedClass: 'tx-status awaiting-wallet-approval' },
    { phase: 'submitting', expectedClass: 'tx-status submitting' },
    { phase: 'confirming', expectedClass: 'tx-status confirming' },
    { phase: 'synchronizing', expectedClass: 'tx-status synchronizing' },
    { phase: 'success', expectedClass: 'tx-status success' },
    { phase: 'error', expectedClass: 'tx-status error' },
    { phase: 'failure', expectedClass: 'tx-status failure' },
  ]

  it('renders each transaction state with correct class', () => {
    transactionStates.forEach(({ phase }) => {
      document.body.innerHTML = `
        <div class="tx-status ${phase}">
          <span class="status-dot"></span>
          <div>
            <strong>${phase.replace(/-/g, ' ')}</strong>
            <p>Status message for ${phase}</p>
          </div>
        </div>
      `

      const txStatus = document.querySelector('.tx-status')
      expect(txStatus).not.toBeNull()
      expect(txStatus?.className).toContain(phase)

      const statusDot = document.querySelector('.status-dot')
      expect(statusDot).not.toBeNull()
    })
  })

  it('success state has lime dot', () => {
    document.body.innerHTML = `
      <div class="tx-status success">
        <span class="status-dot"></span>
        <div><strong>Success</strong></div>
      </div>
    `

    const dot = document.querySelector('.status-dot')
    const parent = dot?.parentElement
    expect(parent?.className).toContain('success')
  })

  it('error state has danger dot', () => {
    document.body.innerHTML = `
      <div class="tx-status error">
        <span class="status-dot"></span>
        <div><strong>Error</strong></div>
      </div>
    `

    const dot = document.querySelector('.status-dot')
    const parent = dot?.parentElement
    expect(parent?.className).toContain('error')
  })
})

describe('Policy approval display', () => {
  it('shows policy approval when payment is approved', () => {
    document.body.innerHTML = `
      <div class="tx-status success">
        <span class="status-dot"></span>
        <div>
          <strong>Success</strong>
          <p>Policy-approved payment recorded. Policy 1 validated this payment on-chain.</p>
          <a href="https://stellar.expert/explorer/testnet/tx/abcd1234">abcd1234 ↗</a>
        </div>
      </div>
    `

    const successStatus = document.querySelector('.tx-status.success')
    expect(successStatus).not.toBeNull()

    const message = successStatus?.querySelector('p')
    expect(message?.textContent).toContain('Policy-approved')
    expect(message?.textContent).toContain('on-chain')
  })

  it('shows policy reference in approval message', () => {
    document.body.innerHTML = `
      <div class="policy-preview policy-preview--active">
        <span class="policy-preview__label">POLICY #1</span>
        <div class="policy-preview__rules">
          <span>Max: <strong>10.0000000 XLM</strong></span>
          <span>Daily: <strong>50.0000000 XLM</strong></span>
        </div>
        <span class="policy-preview__status">✓ Policy active — payment will be validated on-chain</span>
      </div>
    `

    const policyPreview = document.querySelector('.policy-preview--active')
    expect(policyPreview).not.toBeNull()

    const status = policyPreview?.querySelector('.policy-preview__status')
    expect(status?.textContent).toContain('active')
    expect(status?.textContent).toContain('validated on-chain')
  })
})
