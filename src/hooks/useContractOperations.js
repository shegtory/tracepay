import { useState, useCallback, useEffect, useRef } from 'react'
import * as stellar from '../lib/stellar'
import { StellarWalletsKit, KitEventType } from '@creit.tech/stellar-wallets-kit/sdk'
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils'
import { Networks } from '@creit.tech/stellar-wallets-kit/types'

// ── Transaction state machine ────────────────────────────────────────────────

export const TRANSACTION_STATES = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  SIMULATING: 'simulating',
  AWAITING_WALLET_APPROVAL: 'awaiting-wallet-approval',
  SUBMITTING: 'submitting',
  CONFIRMING: 'confirming',
  SYNCHRONIZING: 'synchronizing',
  SUCCESS: 'success',
  FAILURE: 'failure',
}

export function useTransactionState() {
  const [state, setState] = useState({ phase: 'idle', hash: '', message: '' })
  const busyRef = useRef(false)

  const setBusy = useCallback((busy) => { busyRef.current = busy }, [])

  const updateState = useCallback((phase, hash = '', message = '') => {
    setState({ phase, hash, message })
  }, [])

  const clearState = useCallback(() => {
    setState({ phase: 'idle', hash: '', message: '' })
  }, [])

  const isBusy = useCallback(() => busyRef.current, [])

  return { state, updateState, clearState, setBusy, isBusy }
}

// ── Wallet connection hook ────────────────────────────────────────────────────

let walletInitialized = false
let walletUnsubscribe = null

export function useWallet() {
  const [address, setAddress] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!walletInitialized) {
      try {
        StellarWalletsKit.init({
          modules: defaultModules(),
          network: Networks.TESTNET,
          authModal: { showInstallLabel: true, hideUnsupportedWallets: false },
        })
        walletInitialized = true
      } catch (err) {
        console.error('WalletKit init failed:', err)
      }
    }

    if (walletUnsubscribe) walletUnsubscribe()

    walletUnsubscribe = StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event) => {
      setAddress(event.payload.address || null)
      setError(null)
    })

    return () => {
      if (walletUnsubscribe) walletUnsubscribe()
    }
  }, [])

  const connect = useCallback(async () => {
    setConnecting(true)
    setError(null)
    try {
      const { address: newAddress } = await StellarWalletsKit.authModal()
      const { networkPassphrase } = await StellarWalletsKit.getNetwork()
      if (networkPassphrase !== Networks.TESTNET) {
        setError('Wrong network: switch the selected wallet to Stellar Testnet.')
        setAddress(null)
        return null
      }
      setAddress(newAddress)
      return newAddress
    } catch (err) {
      const message = String(err?.message || err || '')
      if (/reject|declin|cancel|closed/i.test(message)) {
        setError('Wallet connection was rejected.')
      } else if (/not found|not installed|unavailable/i.test(message)) {
        setError('Selected wallet was not found or is unavailable.')
      } else {
        setError(message)
      }
      setAddress(null)
      return null
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    StellarWalletsKit.disconnect()
    setAddress(null)
    setError(null)
  }, [])

  const openProfile = useCallback(() => {
    StellarWalletsKit.profileModal()
  }, [])

  return { address, connecting, error, connect, disconnect, openProfile }
}

// ── Balance hook ──────────────────────────────────────────────────────────────

export function useBalance(address) {
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!address) {
      setBalance(null)
      return
    }
    setLoading(true)
    stellar.fetchXlmBalance(address)
      .then((bal) => {
        setBalance(bal)
        setError(null)
      })
      .catch((err) => {
        setError(stellar.explainError(err))
        setBalance(null)
      })
      .finally(() => setLoading(false))
  }, [address])

  const refresh = useCallback(async () => {
    if (!address) return
    setLoading(true)
    try {
      const bal = await stellar.fetchXlmBalance(address)
      setBalance(bal)
      setError(null)
    } catch (err) {
      setError(stellar.explainError(err))
    } finally {
      setLoading(false)
    }
  }, [address])

  return { balance, loading, error, refresh }
}

// ── Policy operations hook ────────────────────────────────────────────────────

export function usePolicies() {
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchPolicies = useCallback(async () => {
    const address = StellarWalletsKit.getState()?.address
    if (!address) {
      setError('Connect a wallet to view your policies.')
      return
    }
    setLoading(true)
    try {
      const list = await stellar.readPoliciesByOwner(address)
      setPolicies(list)
      setError(null)
    } catch (err) {
      setError(stellar.explainError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const createPolicy = useCallback(async (maxAmount, dailyLimit, approvedRecipient, onStatus) => {
    setLoading(true)
    try {
      const result = await stellar.createPolicy(maxAmount, dailyLimit, approvedRecipient, onStatus)
      await fetchPolicies()
      return result
    } catch (err) {
      setError(stellar.explainError(err))
      throw err
    } finally {
      setLoading(false)
    }
  }, [fetchPolicies])

  const updatePolicy = useCallback(async (policyId, maxAmount, dailyLimit, approvedRecipient, onStatus) => {
    setLoading(true)
    try {
      const result = await stellar.updatePolicy(policyId, maxAmount, dailyLimit, approvedRecipient, onStatus)
      await fetchPolicies()
      return result
    } catch (err) {
      setError(stellar.explainError(err))
      throw err
    } finally {
      setLoading(false)
    }
  }, [fetchPolicies])

  const setEnabled = useCallback(async (policyId, enabled, onStatus) => {
    setLoading(true)
    try {
      const result = await stellar.setPolicyEnabled(policyId, enabled, onStatus)
      await fetchPolicies()
      return result
    } catch (err) {
      setError(stellar.explainError(err))
      throw err
    } finally {
      setLoading(false)
    }
  }, [fetchPolicies])

  const refresh = useCallback(() => {
    setLoading(true)
    fetchPolicies().finally(() => setLoading(false))
  }, [fetchPolicies])

  return { policies, loading, error, fetchPolicies, createPolicy, updatePolicy, setEnabled, refresh }
}

// ── Payment operations hook ───────────────────────────────────────────────────

export function usePayments() {
  const [recentPayments, setRecentPayments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const payments = await stellar.readRecentPayments(10)
      setRecentPayments(payments)
      setError(null)
    } catch (err) {
      setError(stellar.explainError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const submitRegularPayment = useCallback(async (destination, amount, memo, onStatus) => {
    setLoading(true)
    try {
      const address = StellarWalletsKit.getState()?.address
      if (!address) throw new Error('Wallet is not connected.')
      const result = await stellar.sendAndRecordPayment({
        sender: address,
        destination,
        amount,
        memo,
        onStatus,
      })
      await fetchPayments()
      return result
    } catch (err) {
      setError(stellar.explainError(err))
      throw err
    } finally {
      setLoading(false)
    }
  }, [fetchPayments])

  const submitPolicyProtectedPayment = useCallback(async (destination, amount, memo, policyContractId, policyId, onStatus) => {
    setLoading(true)
    try {
      const address = StellarWalletsKit.getState()?.address
      if (!address) throw new Error('Wallet is not connected.')
      const result = await stellar.recordPolicyProtectedPayment({
        sender: address,
        destination,
        amount,
        memo,
        policyContractId,
        policyId,
        onStatus,
      })
      await fetchPayments()
      return result
    } catch (err) {
      setError(stellar.explainError(err))
      throw err
    } finally {
      setLoading(false)
    }
  }, [fetchPayments])

  const refresh = useCallback(() => {
    setLoading(true)
    fetchPayments().finally(() => setLoading(false))
  }, [fetchPayments])

  return { payments: recentPayments, loading, error, fetchPayments, submitRegularPayment, submitPolicyProtectedPayment, refresh }
}

// ── Event synchronization hook ────────────────────────────────────────────────

export function useEventSync() {
  const [syncState, setSyncState] = useState('loading') // loading, ready, error, empty
  const [paymentEvents, setPaymentEvents] = useState([])
  const [policyEvents, setPolicyEvents] = useState([])
  const [lastSyncedLedger, setLastSyncedLedger] = useState(null)
  const [eventCount, setEventCount] = useState(0)
  const seenEventsRef = useRef(new Set())
  const lastLedgerRef = useRef(null)
  const timerRef = useRef(null)
  const initialSyncDoneRef = useRef(false)

  const sync = useCallback(async () => {
    if (!stellar.isContractConfigured() && !stellar.isPolicyConfigured()) {
      setSyncState('error')
      return
    }

    setSyncState('loading')

    try {
      const [newPaymentEvents, newPolicyEvents] = await Promise.all([
        stellar.fetchPaymentEvents(),
        stellar.fetchPolicyEvents(),
      ])

      const latestLedger = await stellar.rpcServer.getLatestLedger()
      const currentLedger = latestLedger.sequence

      setLastSyncedLedger(currentLedger)

      // Deduplicate payment events by id
      const newPaymentIds = new Set()
      const deduplicatedPayments = []
      for (const event of newPaymentEvents) {
        if (!seenEventsRef.current.has(event.id)) {
          seenEventsRef.current.add(event.id)
          deduplicatedPayments.push(event)
          newPaymentIds.add(event.id)
        }
      }

      // Deduplicate policy events by id
      const newPolicyIds = new Set()
      const deduplicatedPolicies = []
      for (const event of newPolicyEvents) {
        if (!seenEventsRef.current.has(event.id)) {
          seenEventsRef.current.add(event.id)
          deduplicatedPolicies.push(event)
          newPolicyIds.add(event.id)
        }
      }

      setPaymentEvents((prev) => {
        // Merge keeping order: new events first, then existing
        const existingIds = new Set(prev.map((e) => e.id))
        const uniqueNew = deduplicatedPayments.filter((e) => !existingIds.has(e.id))
        return [...uniqueNew, ...prev]
      })

      setPolicyEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e.id))
        const uniqueNew = deduplicatedPolicies.filter((e) => !existingIds.has(e.id))
        return [...uniqueNew, ...prev]
      })

      const totalNew = newPaymentIds.size + newPolicyIds.size
      setEventCount((prev) => prev + totalNew)
      lastLedgerRef.current = currentLedger
      initialSyncDoneRef.current = true

      if (deduplicatedPayments.length === 0 && deduplicatedPolicies.length === 0 && paymentEvents.length === 0 && policyEvents.length === 0) {
        setSyncState('empty')
      } else {
        setSyncState('ready')
      }
    } catch (err) {
      setSyncState('error')
      console.error('Event sync failed:', err)
    }
  }, [paymentEvents.length, policyEvents.length])

  const resync = useCallback(async () => {
    // Clear the seen events set and re-sync from scratch
    seenEventsRef.current = new Set()
    setPaymentEvents([])
    setPolicyEvents([])
    setEventCount(0)
    setLastSyncedLedger(null)
    initialSyncDoneRef.current = false
    await sync()
  }, [sync])

  // Initial sync and periodic polling
  useEffect(() => {
    sync()

    timerRef.current = setInterval(() => {
      if (!initialSyncDoneRef.current) {
        sync()
      }
    }, 6000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [sync])

  return { syncState, paymentEvents, policyEvents, lastSyncedLedger, eventCount, resync, sync }
}

// ── Export the Stellar module for direct access ───────────────────────────────

export { stellar }
