import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { shortenAddress, formatContractId, isTestnetNetwork } from '../../lib/utils'

describe('Address shortening', () => {
  const longAddress = 'GDQJQLZ7DJX5OPSQ7A7MZ5323PV6PX2FNQUPWQXSLW3OFCOO7IS7C4L'

  it('shortens a long Stellar address', () => {
    const result = shortenAddress(longAddress, 6)
    expect(result).toBe('GDQJQL…S7C4L')
    expect(result.length).toBeLessThan(longAddress.length)
    expect(result).toContain('…')
  })

  it('returns full address when short enough', () => {
    const shortAddress = 'GABCDEF'
    expect(shortenAddress(shortAddress, 6)).toBe('GABCDEF')
  })

  it('returns empty string for empty input', () => {
    expect(shortenAddress('')).toBe('')
  })

  it('returns empty string for null/undefined', () => {
    expect(shortenAddress(null)).toBe('')
    expect(shortenAddress(undefined)).toBe('')
  })

  it('uses specified character count for front and back', () => {
    expect(shortenAddress(longAddress, 4)).toBe('GDQJ…C4L')
    expect(shortenAddress(longAddress, 8)).toBe('GDQJQLZD…7IS7C4L')
  })

  it('always shows at least the leading character', () => {
    const result = shortenAddress(longAddress, 1)
    expect(result).toContain('G')
    expect(result).toContain('…')
  })
})

describe('Contract ID formatting', () => {
  const validContractId = 'CB6LYC7FWQTOWHPA3FZRYAOY7QSNUGIPQEN6U3BVCC3YKDDMYQGDHZ2J'
  const shortContractId = 'CABCD'

  it('shortens a long contract ID', () => {
    const result = formatContractId(validContractId, 12)
    expect(result).toBe('CB6LYC7FW…GDHZ2J')
    expect(result.length).toBeLessThan(validContractId.length)
  })

  it('returns full ID when short enough', () => {
    expect(formatContractId(shortContractId, 12)).toBe('CABCD')
  })

  it('returns "Not deployed" for empty string', () => {
    expect(formatContractId('', 12)).toBe('Not deployed')
  })

  it('returns "Not deployed" for null/undefined', () => {
    expect(formatContractId(null, 12)).toBe('Not deployed')
    expect(formatContractId(undefined, 12)).toBe('Not deployed')
  })

  it('uses specified character count', () => {
    expect(formatContractId(validContractId, 8)).toBe('CB6LYC7F…YQGDHZ2J')
    expect(formatContractId(validContractId, 4)).toBe('CB6L…DHZ2J')
  })

  it('always preserves C-prefix for contract IDs', () => {
    const result = formatContractId(validContractId, 6)
    expect(result).toContain('C')
    expect(result).toContain('…')
  })
})

describe('Testnet network detection', () => {
  const testnetPassphrase = 'Test SDF Network ; September 2015'
  const mainnetPassphrase = 'Public Global Stellar Network ; September 2015'

  it('identifies Testnet passphrase', () => {
    expect(isTestnetNetwork(testnetPassphrase)).toBe(true)
  })

  it('rejects Mainnet passphrase', () => {
    expect(isTestnetNetwork(mainnetPassphrase)).toBe(false)
  })

  it('rejects other network passphrases', () => {
    expect(isTestnetNetwork('Custom Network')).toBe(false)
    expect(isTestnetNetwork('')).toBe(false)
  })

  it('is case-sensitive', () => {
    expect(isTestnetNetwork('test sdf network ; september 2015')).toBe(false)
  })

  it('handles null/undefined', () => {
    expect(isTestnetNetwork(null)).toBe(false)
    expect(isTestnetNetwork(undefined)).toBe(false)
  })
})
