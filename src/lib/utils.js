export function isValidStellarAddress(address) {
  if (!address || typeof address !== 'string') return false
  const gAddressPattern = /^G[A-Z2-7]{55}$/
  const mAddressPattern = /^M[A-Z2-7]{55}$/
  return gAddressPattern.test(address) || mAddressPattern.test(address)
}

export function validateTransactionAmount(amount) {
  if (!amount || typeof amount !== 'string') return false
  const num = Number(amount)
  if (isNaN(num)) return false
  if (num <= 0) return false
  if (!isFinite(num)) return false
  return true
}

export function formatTransactionStatus(status) {
  const statusMap = {
    idle: 'Idle',
    pending: 'Pending confirmation',
    success: 'Success',
    error: 'Error',
    'awaiting-signature': 'Awaiting signature',
    submitting: 'Submitting',
    synchronizing: 'Synchronizing',
    failure: 'Failure',
    preparing: 'Preparing',
    simulating: 'Simulating',
    confirming: 'Confirming',
  }
  return statusMap[status] || status
}

export function shortenAddress(address, chars = 6) {
  if (!address) return ''
  if (address.length <= chars * 2) return address
  return `${address.slice(0, chars)}…${address.slice(-chars)}`
}

export function formatContractId(contractId, chars = 12) {
  if (!contractId) return 'Not deployed'
  if (contractId.length <= chars * 2) return contractId
  return `${contractId.slice(0, chars)}…${contractId.slice(-chars)}`
}

export function isTestnetNetwork(networkPassphrase) {
  return networkPassphrase === 'Test SDF Network ; September 2015'
}

export function formatErrorMessage(error) {
  if (!error) return 'An unknown error occurred.'
  const message = String(error.message || error)

  if (/insufficient|underfunded|balance/i.test(message)) {
    return 'Insufficient XLM balance for this transaction.'
  }
  if (/rpc.*error|rpc.*rejected|network.*error/i.test(message)) {
    return 'Network error. Please check your connection.'
  }
  if (/rejected|declined|cancelled|user denied/i.test(message)) {
    return 'Transaction was rejected.'
  }
  if (/simulation failed|contract.*simulation/i.test(message)) {
    return 'Contract simulation failed.'
  }
  if (/wrong network|network mismatch|not testnet/i.test(message)) {
    return 'Wrong network. Please switch to Stellar Testnet.'
  }
  if (/invalid.*address|bad.*address|address.*invalid/i.test(message)) {
    return 'Invalid Stellar address.'
  }
  if (/not found|not installed|unavailable|wallet.*not/i.test(message)) {
    return 'Wallet not found or unavailable.'
  }
  if (/policy.*disabled|policy.*inactive/i.test(message)) {
    return 'Policy is disabled.'
  }
  if (/exceeds.*limit|limit.*exceeded/i.test(message)) {
    return 'Payment exceeds policy limit.'
  }
  if (/unauthorized|not.*owner|permission/i.test(message)) {
    return 'Unauthorized operation.'
  }

  return message
}
