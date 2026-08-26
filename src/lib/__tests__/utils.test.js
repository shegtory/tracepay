import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { isValidStellarAddress, validateTransactionAmount, formatErrorMessage } from '../../lib/utils'

describe('Stellar address validation', () => {
  it('accepts valid G-address', () => {
    expect(isValidStellarAddress('GDQJQLZ7DJX5OPSQ7A7MZ5323PV6PX2FNQUPWQXSLW3OFCOO7IS7C4L')).toBe(true)
  })

  it('accepts valid M-address', () => {
    expect(isValidStellarAddress('MDQJQLZ7DJX5OPSQ7A7MZ5323PV6PX2FNQUPWQXSLW3OFCOO7IS7C4L')).toBe(true)
  })

  it('rejects address that is too short', () => {
    expect(isValidStellarAddress('GABCDEFGHIJKLMNOPQRSTUVWXYZ23456789ABCDEFGHIJKLMNOPQRSTUVW')).toBe(false)
  })

  it('rejects address that is too long', () => {
    expect(isValidStellarAddress('GABCDEFGHIJKLMNOPQRSTUVWXYZ23456789ABCDEFGHIJKLMNOPQRSTUVWXAYZ')).toBe(false)
  })

  it('rejects address with lowercase', () => {
    expect(isValidStellarAddress('gABCDEFGHIJKLMNOPQRSTUVWXYZ23456789ABCDEFGHIJKLMNOPQRSTUVWX')).toBe(false)
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

  it('rejects address with space', () => {
    expect(isValidStellarAddress('GDQJQLZ7DJX5OPSQ7A7MZ5323PV6PX2FNQUPWQXSLW3OFCOO7IS7C4L ')).toBe(false)
  })
})

describe('Transaction amount validation', () => {
  it('accepts valid amounts', () => {
    expect(validateTransactionAmount('10')).toBe(true)
    expect(validateTransactionAmount('0.0000001')).toBe(true)
    expect(validateTransactionAmount('1.5')).toBe(true)
  })

  it('rejects zero', () => {
    expect(validateTransactionAmount('0')).toBe(false)
  })

  it('rejects negative amounts', () => {
    expect(validateTransactionAmount('-10')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateTransactionAmount('')).toBe(false)
  })

  it('rejects non-numeric', () => {
    expect(validateTransactionAmount('abc')).toBe(false)
    expect(validateTransactionAmount('10 abc')).toBe(false)
  })

  it('rejects NaN', () => {
    expect(validateTransactionAmount('NaN')).toBe(false)
  })

  it('rejects Infinity', () => {
    expect(validateTransactionAmount('Infinity')).toBe(false)
  })
})

describe('Error message formatting', () => {
  it('returns generic for null', () => {
    expect(formatErrorMessage(null)).toBe('An unknown error occurred.')
  })

  it('returns generic for undefined', () => {
    expect(formatErrorMessage(undefined)).toBe('An unknown error occurred.')
  })

  it('returns generic for empty', () => {
    expect(formatErrorMessage({})).toBe('An unknown error occurred.')
  })

  it('formats insufficient balance', () => {
    expect(formatErrorMessage({ message: 'Insufficient balance' })).toBe('Insufficient XLM balance for this transaction.')
    expect(formatErrorMessage({ message: 'Underfunded account' })).toBe('Insufficient XLM balance for this transaction.')
  })

  it('formats rejected transaction', () => {
    expect(formatErrorMessage({ message: 'rejected' })).toBe('Transaction was rejected.')
    expect(formatErrorMessage({ message: 'declined' })).toBe('Transaction was rejected.')
  })

  it('formats wrong network', () => {
    expect(formatErrorMessage({ message: 'wrong network' })).toBe('Wrong network. Please switch to Stellar Testnet.')
  })

  it('formats invalid address', () => {
    expect(formatErrorMessage({ message: 'invalid address' })).toBe('Invalid Stellar address.')
  })

  it('formats wallet unavailable', () => {
    expect(formatErrorMessage({ message: 'wallet not found' })).toBe('Wallet not found or unavailable.')
  })

  it('formats simulation failure', () => {
    expect(formatErrorMessage({ message: 'simulation failed' })).toBe('Contract simulation failed.')
  })

  it('formats RPC error', () => {
    expect(formatErrorMessage({ message: 'RPC error' })).toBe('Network error. Please check your connection.')
  })

  it('formats policy disabled', () => {
    expect(formatErrorMessage({ message: 'policy is disabled' })).toBe('Policy is disabled.')
  })

  it('formats exceeds limit', () => {
    expect(formatErrorMessage({ message: 'exceeds the limit' })).toBe('Payment exceeds policy limit.')
  })

  it('formats unauthorized', () => {
    expect(formatErrorMessage({ message: 'unauthorized' })).toBe('Unauthorized operation.')
  })

  it('returns raw message for unrecognized errors', () => {
    expect(formatErrorMessage({ message: 'Something unexpected happened' })).toBe('Something unexpected happened')
  })
})
