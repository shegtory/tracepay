import { Address, Contract, rpc, scValToNative, nativeToScVal, xdr, Networks, BASE_FEE, TransactionBuilder, Operation } from '@stellar/stellar-sdk'
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk'
import deployment from '../config/deployment.json'

export const HORIZON_URL = 'https://horizon-testnet.stellar.org'
export const RPC_URL = 'https://soroban-testnet.stellar.org'
export const NETWORK_PASSPHRASE = Networks.TESTNET

export const PAYMENT_TRACKER_CONTRACT_ID = import.meta.env.VITE_PAYMENT_TRACKER_CONTRACT_ID || import.meta.env.VITE_CONTRACT_ID || deployment.contractId || ''
export const PAYMENT_POLICY_CONTRACT_ID = import.meta.env.VITE_PAYMENT_POLICY_CONTRACT_ID || ''

export const isContractConfigured = () => /^C[A-Z2-7]{55}$/.test(PAYMENT_TRACKER_CONTRACT_ID)
export const isPolicyConfigured = () => /^C[A-Z2-7]{55}$/.test(PAYMENT_POLICY_CONTRACT_ID)

const horizon = new (import('@stellar/stellar-sdk').Horizon.Server)(HORIZON_URL)
const rpcServer = new rpc.Server(RPC_URL)

function paymentTrackerContract() {
  if (!isContractConfigured()) throw new Error('PaymentTracker contract is not configured. Add VITE_PAYMENT_TRACKER_CONTRACT_ID to .env.local.')
  return new Contract(PAYMENT_TRACKER_CONTRACT_ID)
}

function paymentPolicyContract() {
  if (!isPolicyConfigured()) throw new Error('PaymentPolicy contract is not configured. Add VITE_PAYMENT_POLICY_CONTRACT_ID to .env.local.')
  return new Contract(PAYMENT_POLICY_CONTRACT_ID)
}

async function buildContractTransaction(sourceAddress, contractId, operations) {
  const source = await rpcServer.getAccount(sourceAddress)
  const transaction = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
  for (const op of operations) {
    transaction.addOperation(op)
  }
  transaction.setTimeout(60).build()
  return rpcServer.prepareTransaction(transaction)
}

async function waitForTransaction(hash, onStatus) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await rpcServer.getTransaction(hash)
    if (result.status === 'SUCCESS') return result
    if (result.status === 'FAILED') throw new Error('Contract transaction failed on-chain.')
    onStatus?.('pending', hash)
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  throw new Error('Confirmation timed out. Check the hash on Stellar Expert.')
}

export async function fetchXlmBalance(publicKey) {
  try {
    const account = await horizon.loadAccount(publicKey)
    return account.balances.find((item) => item.asset_type === 'native')?.balance || '0'
  } catch (error) {
    if (error?.response?.status === 404) return null
    throw error
  }
}

// ── PaymentTracker read operations ──────────────────────────────────────────

export async function readRecentPayments(limit = 10) {
  const source = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
  const transaction = await buildContractTransaction(source, PAYMENT_TRACKER_CONTRACT_ID, [
    paymentTrackerContract().call('recent', nativeToScVal(limit, { type: 'u32' }))
  ])
  const simulation = await rpcServer.simulateTransaction(transaction)
  if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result?.retval) return []
  return scValToNative(simulation.result.retval).map((record) => ({
    ...record,
    id: Number(record.id),
    amount: Number(record.amount) / 10_000_000,
    ledger: Number(record.ledger),
    sender: String(record.sender),
    destination: String(record.destination),
    memo: String(record.memo),
    policy_id: record.policy_id ? Number(record.policy_id) : null,
    policy_approved: Boolean(record.policy_approved),
    policy_contract: record.policy_contract ? String(record.policy_contract) : null,
  })).reverse()
}

export async function readPaymentById(id) {
  const source = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
  const transaction = await buildContractTransaction(source, PAYMENT_TRACKER_CONTRACT_ID, [
    paymentTrackerContract().call('get', nativeToScVal(id, { type: 'u64' }))
  ])
  const simulation = await rpcServer.simulateTransaction(transaction)
  if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result?.retval) return null
  const record = scValToNative(simulation.result.retval)
  if (!record) return null
  return {
    ...record,
    id: Number(record.id),
    amount: Number(record.amount) / 10_000_000,
    ledger: Number(record.ledger),
    sender: String(record.sender),
    destination: String(record.destination),
    memo: String(record.memo),
    policy_id: record.policy_id ? Number(record.policy_id) : null,
    policy_approved: Boolean(record.policy_approved),
    policy_contract: record.policy_contract ? String(record.policy_contract) : null,
  }
}

// ── PaymentPolicy read operations ───────────────────────────────────────────

export async function readPoliciesByOwner(owner) {
  if (!isPolicyConfigured()) return []
  const source = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
  const transaction = await buildContractTransaction(source, PAYMENT_POLICY_CONTRACT_ID, [
    paymentPolicyContract().call('get_policies_by_owner', new Address(owner).toScVal())
  ])
  const simulation = await rpcServer.simulateTransaction(transaction)
  if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result?.retval) return []
  return scValToNative(simulation.result.retval).map((policy) => ({
    ...policy,
    id: Number(policy.id),
    max_amount: Number(policy.max_amount),
    daily_limit: policy.daily_limit ? Number(policy.daily_limit) : null,
    approved_recipient: policy.approved_recipient ? String(policy.approved_recipient) : null,
    enabled: Boolean(policy.enabled),
    total_used_today: Number(policy.total_used_today),
    daily_reset_ledger: Number(policy.daily_reset_ledger),
    owner: String(policy.owner),
  }))
}

export async function readPolicyById(id) {
  if (!isPolicyConfigured()) return null
  const source = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
  const transaction = await buildContractTransaction(source, PAYMENT_POLICY_CONTRACT_ID, [
    paymentPolicyContract().call('get_policy', nativeToScVal(id, { type: 'u64' }))
  ])
  const simulation = await rpcServer.simulateTransaction(transaction)
  if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result?.retval) return null
  const policy = scValToNative(simulation.result.retval)
  if (!policy) return null
  return {
    ...policy,
    id: Number(policy.id),
    max_amount: Number(policy.max_amount),
    daily_limit: policy.daily_limit ? Number(policy.daily_limit) : null,
    approved_recipient: policy.approved_recipient ? String(policy.approved_recipient) : null,
    enabled: Boolean(policy.enabled),
    total_used_today: Number(policy.total_used_today),
    daily_reset_ledger: Number(policy.daily_reset_ledger),
    owner: String(policy.owner),
  }
}

export async function readPolicyCount() {
  if (!isPolicyConfigured()) return 0
  const source = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
  const transaction = await buildContractTransaction(source, PAYMENT_POLICY_CONTRACT_ID, [
    paymentPolicyContract().call('policy_count')
  ])
  const simulation = await rpcServer.simulateTransaction(transaction)
  if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result?.retval) return 0
  return Number(scValToNative(simulation.result.retval))
}

// ── PaymentPolicy write operations ──────────────────────────────────────────

async function signAndSendContractTransaction(xdr, onStatus) {
  onStatus?.('awaiting-wallet-approval')
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
    address: StellarWalletsKit.getState()?.address || '',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
  const submitted = await rpcServer.sendTransaction(TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE))
  if (submitted.status === 'ERROR') throw new Error('RPC rejected the contract transaction.')
  onStatus?.('submitting', submitted.hash)
  const result = await waitForTransaction(submitted.hash, onStatus)
  onStatus?.('success', submitted.hash)
  return { hash: submitted.hash, result }
}

export async function createPolicy(maxAmount, dailyLimit, approvedRecipient, onStatus) {
  if (!isPolicyConfigured()) throw new Error('PaymentPolicy contract is not configured.')
  const address = StellarWalletsKit.getState()?.address
  if (!address) throw new Error('Wallet is not connected.')

  const operation = paymentPolicyContract().call(
    'create',
    nativeToScVal(BigInt(Math.round(Number(maxAmount) * 10_000_000)), { type: 'i128' }),
    nativeToScVal(dailyLimit > 0 ? BigInt(Math.round(Number(dailyLimit) * 10_000_000)) : 0, { type: 'i128' }),
    approvedRecipient ? new Address(approvedRecipient).toScVal() : new Address('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF').toScVal()
  )

  const prepared = await buildContractTransaction(address, PAYMENT_POLICY_CONTRACT_ID, [operation])
  const xdr = prepared.toXDR()
  const result = await signAndSendContractTransaction(xdr, onStatus)
  return result
}

export async function updatePolicy(policyId, maxAmount, dailyLimit, approvedRecipient, onStatus) {
  if (!isPolicyConfigured()) throw new Error('PaymentPolicy contract is not configured.')
  const address = StellarWalletsKit.getState()?.address
  if (!address) throw new Error('Wallet is not connected.')

  const operation = paymentPolicyContract().call(
    'update',
    nativeToScVal(policyId, { type: 'u64' }),
    nativeToScVal(BigInt(Math.round(Number(maxAmount) * 10_000_000)), { type: 'i128' }),
    nativeToScVal(dailyLimit > 0 ? BigInt(Math.round(Number(dailyLimit) * 10_000_000)) : 0, { type: 'i128' }),
    approvedRecipient ? new Address(approvedRecipient).toScVal() : new Address('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF').toScVal()
  )

  const prepared = await buildContractTransaction(address, PAYMENT_POLICY_CONTRACT_ID, [operation])
  const xdr = prepared.toXDR()
  const result = await signAndSendContractTransaction(xdr, onStatus)
  return result
}

export async function setPolicyEnabled(policyId, enabled, onStatus) {
  if (!isPolicyConfigured()) throw new Error('PaymentPolicy contract is not configured.')
  const address = StellarWalletsKit.getState()?.address
  if (!address) throw new Error('Wallet is not connected.')

  const operation = paymentPolicyContract().call(
    'set_enabled',
    nativeToScVal(policyId, { type: 'u64' }),
    nativeToScVal(enabled)
  )

  const prepared = await buildContractTransaction(address, PAYMENT_POLICY_CONTRACT_ID, [operation])
  const xdr = prepared.toXDR()
  const result = await signAndSendContractTransaction(xdr, onStatus)
  return result
}

// ── Payment operations ───────────────────────────────────────────────────────

export async function sendAndRecordPayment({ sender, destination, amount, memo, onStatus }) {
  const source = await horizon.loadAccount(sender)
  let destinationExists = true
  try {
    await horizon.loadAccount(destination)
  } catch (error) {
    if (error?.response?.status === 404) destinationExists = false
    else throw error
  }

  if (!destinationExists) {
    const ledgers = await horizon.ledgers().order('desc').limit(1).call()
    const baseReserve = Number(ledgers.records[0]?.base_reserve_in_stroops || 5_000_000) / 10_000_000
    const minimumStartingBalance = baseReserve * 2
    if (Number(amount) < minimumStartingBalance) {
      throw new Error(`An unfunded destination needs at least ${minimumStartingBalance} XLM to be activated.`)
    }
  }

  const paymentTransaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(destinationExists
      ? Operation.payment({ destination, asset: import('@stellar/stellar-sdk').Asset.native(), amount: String(amount) })
      : Operation.createAccount({ destination, startingBalance: String(amount) })
    )
    .setTimeout(60)
    .build()

  onStatus?.('awaiting-payment-signature', '', destinationExists
    ? 'Approve the XLM payment in your wallet.'
    : 'Approve the XLM transfer and destination activation.')

  const { signedTxXdr: signedPaymentXdr } = await StellarWalletsKit.signTransaction(paymentTransaction.toXDR(), {
    address: sender,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
  const paymentResult = await horizon.submitTransaction(
    TransactionBuilder.fromXDR(signedPaymentXdr, NETWORK_PASSPHRASE),
  )

  onStatus?.('payment-success', paymentResult.hash, 'XLM transferred. Approve the contract record next.')

  const contractResult = await recordPayment({
    sender,
    destination,
    amount,
    memo,
    onStatus: (state, hash) => onStatus?.(
      state === 'awaiting-signature' ? 'awaiting-record-signature' : state,
      hash || paymentResult.hash,
      state === 'awaiting-signature' ? 'Approve the payment record contract call in your wallet.' : '',
    ),
  })

  return { paymentHash: paymentResult.hash, contractHash: contractResult.hash, result: contractResult.result }
}

export async function recordPayment({ sender, destination, amount, memo, onStatus }) {
  if (!isContractConfigured()) throw new Error('PaymentTracker contract is not configured.')

  const operation = paymentTrackerContract().call(
    'record',
    new Address(sender).toScVal(),
    new Address(destination).toScVal(),
    nativeToScVal(BigInt(Math.round(Number(amount) * 10_000_000)), { type: 'i128' }),
    nativeToScVal(memo || 'TracePay payment', { type: 'string' })
  )

  const prepared = await buildContractTransaction(sender, PAYMENT_TRACKER_CONTRACT_ID, [operation])
  onStatus?.('awaiting-signature')
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(prepared.toXDR(), {
    address: sender,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
  const submitted = await rpcServer.sendTransaction(TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE))
  if (submitted.status === 'ERROR') throw new Error('RPC rejected the contract transaction.')
  onStatus?.('pending', submitted.hash)
  const result = await waitForTransaction(submitted.hash, onStatus)
  onStatus?.('success', submitted.hash)
  return { hash: submitted.hash, result }
}

export async function recordPolicyProtectedPayment({ sender, destination, amount, memo, policyContractId, policyId, onStatus }) {
  if (!isContractConfigured()) throw new Error('PaymentTracker contract is not configured.')
  if (!isPolicyConfigured()) throw new Error('PaymentPolicy contract is not configured.')

  const operation = paymentTrackerContract().call(
    'record_with_policy',
    new Address(sender).toScVal(),
    new Address(destination).toScVal(),
    nativeToScVal(BigInt(Math.round(Number(amount) * 10_000_000)), { type: 'i128' }),
    nativeToScVal(memo || 'TracePay policy-protected payment', { type: 'string' }),
    new Address(policyContractId).toScVal(),
    nativeToScVal(policyId, { type: 'u64' })
  )

  const prepared = await buildContractTransaction(sender, PAYMENT_TRACKER_CONTRACT_ID, [operation])
  onStatus?.('simulating')
  const simulated = await rpcServer.simulateTransaction(prepared)
  if (!rpc.Api.isSimulationSuccess(simulated)) {
    const errorMsg = simulated.results?.[0]?.result?.log?.msg || 'Contract simulation failed.'
    throw new Error(`Simulation failed: ${errorMsg}`)
  }
  onStatus?.('awaiting-wallet-approval')
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(prepared.toXDR(), {
    address: sender,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
  const submitted = await rpcServer.sendTransaction(TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE))
  if (submitted.status === 'ERROR') throw new Error('RPC rejected the contract transaction.')
  onStatus?.('submitting', submitted.hash)
  const result = await waitForTransaction(submitted.hash, onStatus)
  onStatus?.('success', submitted.hash)
  return { hash: submitted.hash, result }
}

// ── Event operations ─────────────────────────────────────────────────────────

export async function fetchPaymentEvents() {
  if (!isContractConfigured()) return []
  const latest = await rpcServer.getLatestLedger()
  const paymentTopic = xdr.ScVal.scvSymbol('payment').toXDR('base64')
  const result = await rpcServer.getEvents({
    startLedger: Math.max(1, latest.sequence - 2000),
    filters: [{
      type: 'contract',
      contractIds: [PAYMENT_TRACKER_CONTRACT_ID],
      topics: [[paymentTopic, '*']]
    }],
    limit: 20,
  })
  return result.events.map((event) => ({
    id: event.id,
    ledger: event.ledger,
    txHash: event.txHash,
    value: scValToNative(event.value),
  })).reverse()
}

export async function fetchPolicyEvents() {
  if (!isPolicyConfigured()) return []
  const latest = await rpcServer.getLatestLedger()
  const policyTopic = xdr.ScVal.scvSymbol('policy').toXDR('base64')
  const result = await rpcServer.getEvents({
    startLedger: Math.max(1, latest.sequence - 2000),
    filters: [{
      type: 'contract',
      contractIds: [PAYMENT_POLICY_CONTRACT_ID],
      topics: [[policyTopic, '*']]
    }],
    limit: 20,
  })
  return result.events.map((event) => ({
    id: event.id,
    ledger: event.ledger,
    txHash: event.txHash,
    value: scValToNative(event.value),
  })).reverse()
}

export function shorten(value, front = 6, back = 6) {
  if (!value) return ''
  return value.length <= front + back ? value : `${value.slice(0, front)}...${value.slice(-back)}`
}

// ── Validation helpers ───────────────────────────────────────────────────────

export function validateStellarAddress(address) {
  return /^G[A-Z2-7]{55}$/.test(address)
}

export function validateAmount(amount) {
  const num = Number(amount)
  return !isNaN(num) && num > 0 && isFinite(num)
}

export function explainError(error) {
  const message = String(error?.message || error || 'Something went wrong.')
  if (/insufficient|underfunded|balance/i.test(message)) return 'Insufficient XLM balance for this transaction.'
  if (/rejected|declin|cancel|closed/i.test(message)) return 'Transaction was rejected in your wallet.'
  if (/wrong network|network mismatch/i.test(message)) return 'Wrong network: switch the selected wallet to Stellar Testnet.'
  if (/not found|not installed|unavailable/i.test(message)) return 'Selected wallet was not found or is unavailable.'
  if (/simulation failed|contract simulation/i.test(message)) return 'The contract rejected the transaction. Check the inputs and try again.'
  if (/rpc rejected|rpc.*error/i.test(message)) return 'The Stellar network rejected the transaction. Check your connection and try again.'
  if (/unauthorized|policy is disabled|exceeds|policy.*limit/i.test(message)) return message
  return message
}
