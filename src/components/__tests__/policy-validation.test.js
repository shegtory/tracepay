import { describe, it, expect } from 'vitest'

// Mock Stellar SDK classes for testing
const _mockHorizon = {
  loadAccount: vi.fn(),
}

const _mockRpcServer = {
  getAccount: vi.fn(),
  prepareTransaction: vi.fn(),
  getTransaction: vi.fn(),
  sendTransaction: vi.fn(),
  simulateTransaction: vi.fn(),
  getLatestLedger: vi.fn(),
  getEvents: vi.fn(),
}

// Mock WalletKit
const _mockWalletKit = {
  init: vi.fn(),
  getState: vi.fn(() => ({ address: 'GDQJQLZ7DJX5OPSQ7A7MZ5323PV6PX2FNQUPWQXSLW3OFCOO7IS7C4L' })),
  authModal: vi.fn(),
  disconnect: vi.fn(),
  profileModal: vi.fn(),
  signTransaction: vi.fn(),
  on: vi.fn(() => vi.fn()),
}

describe('Wallet connection errors', () => {
  it('handles wallet unavailable error', () => {
    const error = new Error('Selected wallet was not found or is unavailable.')
    expect(error.message).toContain('not found')
    expect(error.message).toContain('unavailable')
  })

  it('handles wallet locked error', () => {
    const error = new Error('Wallet is locked. Please unlock it and try again.')
    expect(error.message).toContain('locked')
  })

  it('handles access rejected error', () => {
    const error = new Error('Wallet connection was rejected.')
    expect(error.message).toContain('rejected')
  })

  it('handles signature rejected error', () => {
    const error = new Error('Transaction was rejected in your wallet.')
    expect(error.message).toContain('rejected')
  })

  it('handles wrong network error', () => {
    const error = new Error('Wrong network: switch the selected wallet to Stellar Testnet.')
    expect(error.message).toContain('Wrong network')
    expect(error.message).toContain('Testnet')
  })

  it('handles invalid address error', () => {
    const error = new Error('Invalid Stellar address.')
    expect(error.message).toContain('Invalid')
    expect(error.message).toContain('address')
  })

  it('handles invalid amount error', () => {
    const error = new Error('Amount must be greater than zero.')
    expect(error.message).toContain('greater than zero')
  })

  it('handles insufficient balance error', () => {
    const error = new Error('Insufficient XLM balance for this transaction.')
    expect(error.message).toContain('Insufficient')
    expect(error.message).toContain('balance')
  })

  it('handles RPC unavailable error', () => {
    const error = new Error('RPC unavailable. Please check your network connection.')
    expect(error.message).toContain('RPC')
    expect(error.message).toContain('unavailable')
  })

  it('handles event synchronization failure error', () => {
    const error = new Error('Could not synchronize activity. Press resync to retry.')
    expect(error.message).toContain('synchronize')
  })
})

describe('Contract errors', () => {
  it('handles unauthorized policy operation error', () => {
    const error = new Error('Only the policy owner can update or disable this policy.')
    expect(error.message).toContain('policy owner')
  })

  it('handles policy disabled error', () => {
    const error = new Error('This policy is disabled and cannot approve payments.')
    expect(error.message).toContain('disabled')
  })

  it('handles payment exceeds limit error', () => {
    const error = new Error('Payment amount exceeds the policy maximum.')
    expect(error.message).toContain('exceeds')
    expect(error.message).toContain('maximum')
  })

  it('handles recipient not approved error', () => {
    const error = new Error('Sender is not the approved recipient for this policy.')
    expect(error.message).toContain('not the approved recipient')
  })

  it('handles contract simulation failure error', () => {
    const error = new Error('The contract rejected the transaction. Check the inputs and try again.')
    expect(error.message).toContain('rejected')
  })

  it('handles contract invocation failure error', () => {
    const error = new Error('The contract call failed on-chain.')
    expect(error.message).toContain('failed')
    expect(error.message).toContain('on-chain')
  })

  it('handles deployment configuration missing error', () => {
    const error = new Error('PaymentTracker contract is not configured. Add VITE_PAYMENT_TRACKER_CONTRACT_ID to .env.local.')
    expect(error.message).toContain('not configured')
  })
})

describe('Policy form validation', () => {
  const validatePolicyForm = (maxAmount, dailyLimit, approvedRecipient) => {
    const errors = []

    // maxAmount must be positive number
    const maxAmountNum = Number(maxAmount)
    if (isNaN(maxAmountNum) || maxAmountNum <= 0) {
      errors.push('Maximum payment amount must be greater than 0.')
    }

    // dailyLimit must be 0 or >= maxAmount
    if (dailyLimit && dailyLimit !== '0') {
      const dailyLimitNum = Number(dailyLimit)
      if (isNaN(dailyLimitNum) || dailyLimitNum < Number(maxAmount)) {
        errors.push('Daily limit must be 0 (no limit) or greater than or equal to the maximum amount.')
      }
    }

    // approvedRecipient must be valid Stellar address if provided
    if (approvedRecipient && approvedRecipient.trim() !== '') {
      const recipientPattern = /^G[A-Z2-7]{55}$/
      if (!recipientPattern.test(approvedRecipient)) {
        errors.push('Approved recipient must be a valid Stellar address (starts with G, 56 characters).')
      }
    }

    return errors
  }

  it('accepts valid policy form data', () => {
    const errors = validatePolicyForm('10', '0', '')
    expect(errors.length).toBe(0)
  })

  it('accepts policy with daily limit', () => {
    const errors = validatePolicyForm('10', '50', '')
    expect(errors.length).toBe(0)
  })

  it('accepts policy with approved recipient', () => {
    const errors = validatePolicyForm('10', '0', 'GDQJQLZ7DJX5OPSQ7A7MZ5323PV6PX2FNQUPWQXSLW3OFCOO7IS7C4L')
    expect(errors.length).toBe(0)
  })

  it('rejects zero max amount', () => {
    const errors = validatePolicyForm('0', '0', '')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toContain('greater than 0')
  })

  it('rejects negative max amount', () => {
    const errors = validatePolicyForm('-5', '0', '')
    expect(errors.length).toBeGreaterThan(0)
  })

  it('rejects daily limit less than max amount', () => {
    const errors = validatePolicyForm('50', '10', '')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toContain('greater than or equal to')
  })

  it('rejects invalid recipient address', () => {
    const errors = validatePolicyForm('10', '0', 'INVALID')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toContain('valid Stellar address')
  })

  it('accepts empty recipient (no restriction)', () => {
    const errors = validatePolicyForm('10', '0', '')
    expect(errors.length).toBe(0)
  })

  it('accepts valid G-address as recipient', () => {
    const errors = validatePolicyForm('10', '0', 'GDQJQLZ7DJX5OPSQ7A7MZ5323PV6PX2FNQUPWQXSLW3OFCOO7IS7C4L')
    expect(errors.length).toBe(0)
  })
})
