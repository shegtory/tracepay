import { describe, it, expect } from 'vitest'
import { isValidStellarAddress, validateTransactionAmount, formatErrorMessage } from '../../lib/utils'

describe('Stellar address validation', () => {
  const validGAddress = 'GDQJQLZ7DJX5OPSQ7A7MZ5323PV6PX2FNQUPWQXSLW3OFCOO7IS7C4L'
  const validMAddress = 'MDQJQLZ7DJX5OPSQ7A7MZ5323PV6PX2FNQUPWQXSLW3OFCOO7IS7C4L'

  it('accepts valid G-address', () => {
    expect(isValidStellarAddress(validGAddress)).toBe(true)
  })

  it('accepts valid M-address (medici)', () => {
    expect(isValidStellarAddress(validMAddress)).toBe(true)
  })

  it('rejects address that is too short', () => {
    expect(isValidStellarAddress('GABCDEFGHIJKLMNOPQRSTUVWXYZ23456789ABCDEFGHIJKLMNOPQRSTUVW')).toBe(false)
  })

  it('rejects address that is too long', () => {
    expect(isValidStellarAddress('GABCDEFGHIJKLMNOPQRSTUVWXYZ23456789ABCDEFGHIJKLMNOPQRSTUVWXAYZ')).toBe(false)
  })

  it('rejects address with invalid characters', () => {
    expect(isValidStellarAddress('GABCDEFGHIJKLMNOPQRSTUVWXYZ23456789ABCDEFGHIJKLMNOPQRSTUVWX ')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidStellarAddress('')).toBe(false)
  })

  it('rejects null', () => {
    expect(isValidStellarAddress(null)).toBe(false)
  })

  it('rejects undefined', () => {
    expect(isValidStellarAddress(undefined)).toBe(false)
  })

  it('rejects address starting with invalid letter', () => {
    expect(isValidStellarAddress('XABCDEFGHIJKLMNOPQRSTUVWXYZ23456789ABCDEFGHIJKLMNOPQRSTUVWX')).toBe(false)
  })

  it('rejects address with lowercase (addresses are uppercase)', () => {
    expect(isValidStellarAddress('gABCDEFGHIJKLMNOPQRSTUVWXYZ23456789ABCDEFGHIJKLMNOPQRSTUVWX')).toBe(false)
  })
})

describe('Transaction amount validation', () => {
  it('accepts positive whole numbers', () => {
    expect(validateTransactionAmount('10')).toBe(true)
    expect(validateTransactionAmount('100')).toBe(true)
    expect(validateTransactionAmount('1')).toBe(true)
  })

  it('accepts positive decimal amounts', () => {
    expect(validateTransactionAmount('10.5')).toBe(true)
    expect(validateTransactionAmount('0.0000001')).toBe(true)
    expect(validateTransactionAmount('0.000001')).toBe(true)
  })

  it('rejects zero', () => {
    expect(validateTransactionAmount('0')).toBe(false)
    expect(validateTransactionAmount('0.0')).toBe(false)
  })

  it('rejects negative amounts', () => {
    expect(validateTransactionAmount('-5')).toBe(false)
    expect(validateTransactionAmount('-0.01')).toBe(false)
  })

  it('rejects non-numeric input', () => {
    expect(validateTransactionAmount('abc')).toBe(false)
    expect(validateTransactionAmount('10 abc')).toBe(false)
    expect(validateTransactionAmount('10.5.3')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateTransactionAmount('')).toBe(false)
  })

  it('rejects NaN string', () => {
    expect(validateTransactionAmount('NaN')).toBe(false)
  })

  it('rejects Infinity', () => {
    expect(validateTransactionAmount('Infinity')).toBe(false)
  })

  it('handles string with whitespace', () => {
    expect(validateTransactionAmount('  10  ')).toBe(false)
  })

  it('accepts scientific notation for small values', () => {
    expect(validateTransactionAmount('1e-7')).toBe(true)
  })
})

describe('Error message formatting', () => {
  it('returns generic message for null/undefined', () => {
    expect(formatErrorMessage(null)).toBe('An unknown error occurred.')
    expect(formatErrorMessage(undefined)).toBe('An unknown error occurred.')
  })

  it('returns generic message for empty error', () => {
    expect(formatErrorMessage({})).toBe('An unknown error occurred.')
    expect(formatErrorMessage('')).toBe('An unknown error occurred.')
  })

  it('formats insufficient balance errors', () => {
    expect(formatErrorMessage({ message: 'Insufficient balance' })).toBe('Insufficient XLM balance for this transaction.')
    expect(formatErrorMessage({ message: 'Account underfunded' })).toBe('Insufficient XLM balance for this transaction.')
  })

  it('formats rejected transaction errors', () => {
    expect(formatErrorMessage({ message: 'Transaction rejected' })).toBe('Transaction was rejected.')
    expect(formatErrorMessage({ message: 'User declined' })).toBe('Transaction was rejected.')
    expect(formatErrorMessage({ message: 'cancel' })).toBe('Transaction was rejected.')
  })

  it('formats wrong network errors', () => {
    expect(formatErrorMessage({ message: 'Wrong network' })).toBe('Wrong network. Please switch to Stellar Testnet.')
    expect(formatErrorMessage({ message: 'network mismatch' })).toBe('Wrong network. Please switch to Stellar Testnet.')
  })

  it('formats invalid address errors', () => {
    expect(formatErrorMessage({ message: 'Invalid address' })).toBe('Invalid Stellar address.')
    expect(formatErrorMessage({ message: 'bad address format' })).toBe('Invalid Stellar address.')
  })

  it('formats wallet unavailable errors', () => {
    expect(formatErrorMessage({ message: 'Wallet not found' })).toBe('Wallet not found or unavailable.')
    expect(formatErrorMessage({ message: 'Freighter not installed' })).toBe('Wallet not found or unavailable.')
  })

  it('formats contract simulation errors', () => {
    expect(formatErrorMessage({ message: 'simulation failed' })).toBe('Contract simulation failed.')
    expect(formatErrorMessage({ message: 'Contract simulation error' })).toBe('Contract simulation failed.')
  })

  it('formats RPC errors', () => {
    expect(formatErrorMessage({ message: 'RPC error' })).toBe('Network error. Please check your connection.')
    expect(formatErrorMessage({ message: 'rpc rejected' })).toBe('Network error. Please check your connection.')
  })

  it('formats policy disabled errors', () => {
    expect(formatErrorMessage({ message: 'policy is disabled' })).toBe('Policy is disabled.')
    expect(formatErrorMessage({ message: 'Policy inactive' })).toBe('Policy is disabled.')
  })

  it('formats limit exceeded errors', () => {
    expect(formatErrorMessage({ message: 'exceeds limit' })).toBe('Payment exceeds policy limit.')
    expect(formatErrorMessage({ message: 'limit exceeded' })).toBe('Payment exceeds policy limit.')
  })

  it('formats unauthorized errors', () => {
    expect(formatErrorMessage({ message: 'unauthorized' })).toBe('Unauthorized operation.')
    expect(formatErrorMessage({ message: 'not the owner' })).toBe('Unauthorized operation.')
  })

  it('returns raw message for unknown errors', () => {
    expect(formatErrorMessage({ message: 'Some weird error 42' })).toBe('Some weird error 42')
  })
})
