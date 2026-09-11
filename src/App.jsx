import { useState, useCallback, useEffect, useRef } from 'react'
import { useWallet, useBalance, usePayments, useEventSync } from './hooks/useContractOperations'
import { shorten, validateStellarAddress, validateAmount, explainError, PAYMENT_TRACKER_CONTRACT_ID, PAYMENT_POLICY_CONTRACT_ID, INTER_CONTRACT_TRANSACTION_HASH } from './lib/stellar'
import PolicyCenter from './components/policies/PolicyCenter'
import ActivityPanel from './components/ActivityPanel'
import './App.css'

const EMPTY_FORM = { destination: '', amount: '', memo: '' }

function PolicyProtectedPaymentForm({ onSubmit, submitting, selectedPolicy, onClearSelection, busy }) {
  const [destination, setDestination] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [formError, setFormError] = useState(null)
  const [validationResult, setValidationResult] = useState(null)

  const validate = useCallback(() => {
    if (!validateStellarAddress(destination.trim())) {
      return 'Enter a valid Stellar public key (starts with G, 56 characters).'
    }
    if (!validateAmount(amount)) {
      return 'Enter an amount greater than 0.'
    }
    if (selectedPolicy) {
      const maxXLM = selectedPolicy.max_amount / 10_000_000
      const sendXLM = Number(amount)
      if (sendXLM > maxXLM) {
        return `This payment (${sendXLM} XLM) exceeds the policy maximum (${maxXLM} XLM).`
      }
      if (selectedPolicy.approved_recipient && selectedPolicy.approved_recipient !== destination.trim()) {
        return 'This destination is not approved by the selected policy.'
      }
    }
    return null
  }, [destination, amount, selectedPolicy])

  const handleSubmit = useCallback((e) => {
    e.preventDefault()
    const error = validate()
    if (error) {
      setFormError(error)
      return
    }
    setFormError(null)
    onSubmit({
      destination: destination.trim(),
      amount: Number(amount),
      memo: memo.trim(),
      policy: selectedPolicy,
    })
  }, [destination, amount, memo, selectedPolicy, onSubmit, validate])

  // When a policy is selected, show the policy validation preview
  useEffect(() => {
    if (selectedPolicy) {
      const maxXLM = selectedPolicy.max_amount / 10_000_000
      setValidationResult({
        policyId: selectedPolicy.id,
        maxAmount: maxXLM,
        dailyLimit: selectedPolicy.daily_limit ? selectedPolicy.daily_limit / 10_000_000 : null,
        approvedRecipient: selectedPolicy.approved_recipient,
        enabled: selectedPolicy.enabled,
      })
    } else {
      setValidationResult(null)
    }
  }, [selectedPolicy])

  return (
    <form className="card composer" onSubmit={handleSubmit}>
      <div className="card-heading">
        <div>
          <span className="eyebrow">POLICY-PROTECTED PAYMENT</span>
          <h3>Send XLM with policy check</h3>
        </div>
        {selectedPolicy && (
          <button
            type="button"
            className="button ghost"
            onClick={onClearSelection}
            disabled={busy}
            style={{ fontSize: '11px', padding: '6px 10px' }}
          >
            Clear policy ↺
          </button>
        )}
      </div>

      {validationResult && (
        <div className={`policy-preview ${validationResult.enabled ? 'policy-preview--active' : 'policy-preview--disabled'}`}>
          <span className="policy-preview__label">POLICY #{validationResult.policyId}</span>
          <div className="policy-preview__rules">
            <span>Max: <strong>{validationResult.maxAmount} XLM</strong></span>
            {validationResult.dailyLimit && <span>Daily: <strong>{validationResult.dailyLimit} XLM</strong></span>}
            {validationResult.approvedRecipient && (
              <span>Recipient: <strong>{shorten(validationResult.approvedRecipient, 6, 6)}</strong></span>
            )}
          </div>
          <span className="policy-preview__status">
            {validationResult.enabled ? '✓ Policy active — payment will be validated on-chain' : '✗ Policy disabled — enable it before sending'}
          </span>
        </div>
      )}

      {!selectedPolicy && (
        <div className="policy-selection-empty">
          Select an active policy below before preparing a protected payment.
        </div>
      )}

      <label className="field">
        <span className="field__label">Destination address</span>
        <input
          className="field__input field__input--mono"
          type="text"
          placeholder="GABCDEF...WXYZ"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          disabled={submitting || busy}
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <div className="form-row">
        <label>
          <span className="field__label">Amount (XLM)</span>
          <input
            type="number"
            step="0.0000001"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={submitting || busy}
          />
        </label>
        <label>
          <span className="field__label">Memo</span>
          <input
            maxLength={64}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Invoice #42"
            disabled={submitting || busy}
          />
        </label>
      </div>

      {formError && (
        <div className="form-error" role="alert">
          {formError}
        </div>
      )}

      {validationResult && (
        <div className="policy-validation-result">
          <div className="policy-validation-result__header">
            <span className="policy-validation-result__title">On-chain validation</span>
          </div>
          <p className="policy-validation-result__description">
            When you submit, PaymentTracker will call PaymentPolicy.validate_and_record().
            If the policy approves, XLM is transferred and the payment is recorded atomically.
            If validation fails, no funds move and the wallet displays the rejection.
          </p>
        </div>
      )}

      <button
        className="button primary submit"
        type="submit"
        disabled={submitting || busy || !selectedPolicy || !validateStellarAddress(destination.trim()) || !validateAmount(amount)}
      >
        {submitting ? 'Submitting...' : 'Send XLM & Record (Policy-Protected)'}
        <span>→</span>
      </button>

      <p className="form-note">
        PaymentTracker validates the policy first, then transfers XLM and records the payment
        in one atomic contract transaction.
      </p>
    </form>
  )
}

export default function App() {
  const { address, connecting, connect, disconnect, openProfile } = useWallet()
  const { balance, refresh: refreshBalance } = useBalance(address)
  const { payments, fetchPayments, submitRegularPayment, submitPolicyProtectedPayment, refresh: _refreshPayments } = usePayments()
  const { syncState, eventCount, resync } = useEventSync()

  const [_form, setForm] = useState(EMPTY_FORM)
  const [selectedPolicy, setSelectedPolicy] = useState(null)
  const [status, setStatus] = useState({ phase: 'idle', hash: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [lastAction, setLastAction] = useState(null)
  const sessionBaselineId = useRef(null)
  const sessionBaselineEvents = useRef(null)

  const refreshActivity = useCallback(async () => {
    if (!address) {
      setStatus({ phase: 'idle', hash: '', message: '' })
      return
    }
    try {
      const nextPayments = await fetchPayments()

      if (sessionBaselineId.current === null) {
        sessionBaselineId.current = nextPayments.reduce((latest, record) => Math.max(latest, record.id), 0)
        sessionBaselineEvents.current = new Set()
        setStatus({ phase: 'synchronizing', hash: '', message: 'Initial sync complete.' })
        return
      }

      const newPayments = nextPayments.filter((record) => record.id > sessionBaselineId.current)
      sessionBaselineId.current = nextPayments.reduce((latest, record) => Math.max(latest, record.id), 0)

      if (newPayments.length > 0) {
        setStatus({ phase: 'synchronizing', hash: '', message: `Synced ${newPayments.length} new payment(s).` })
      }
    } catch (err) {
      setStatus({ phase: 'error', hash: '', message: explainError(err) })
    }
  }, [address, fetchPayments])

  // Initial activity sync and periodic polling
  useEffect(() => {
    refreshActivity()
    const timer = setInterval(refreshActivity, 6000)
    return () => clearInterval(timer)
  }, [refreshActivity])

  const handleConnect = useCallback(async () => {
    setBusy(true)
    setStatus({ phase: 'idle', hash: '', message: '' })
    try {
      await connect()
    } catch (err) {
      setStatus({ phase: 'error', hash: '', message: explainError(err) })
    } finally {
      setBusy(false)
    }
  }, [connect])

  const handleDisconnect = useCallback(() => {
    disconnect()
    setForm(EMPTY_FORM)
    setSelectedPolicy(null)
    setStatus({ phase: 'idle', hash: '', message: '' })
    setLastAction(null)
  }, [disconnect])

  const handlePayment = useCallback(async ({ destination, amount, memo, policy }) => {
    if (!address) {
      setStatus({ phase: 'error', hash: '', message: 'Connect a wallet first.' })
      return
    }
    if (!validateStellarAddress(destination)) {
      setStatus({ phase: 'error', hash: '', message: 'Enter a valid Stellar destination address.' })
      return
    }
    if (!validateAmount(amount)) {
      setStatus({ phase: 'error', hash: '', message: 'Amount must be greater than zero.' })
      return
    }
    if (balance === null || Number(balance) < Number(amount)) {
      setStatus({ phase: 'error', hash: '', message: 'Insufficient XLM balance for this transaction.' })
      return
    }

    setBusy(true)
    setStatus({ phase: 'preparing', hash: '', message: 'Preparing transaction...' })

    try {
      if (policy) {
        const result = await submitPolicyProtectedPayment(
          destination,
          amount,
          memo,
          PAYMENT_POLICY_CONTRACT_ID,
          policy.id,
          (phase, hash, message) => setStatus({ phase, hash, message })
        )
        setLastAction({
          phase: 'success',
          hash: result.hash,
          message: policy
            ? `Policy-approved payment recorded. Policy ${policy.id} validated this payment on-chain.`
            : 'Payment recorded on Testnet.',
        })
        setForm(EMPTY_FORM)
        await refreshBalance()
        await refreshActivity()
      } else {
        const result = await submitRegularPayment(
          destination,
          amount,
          memo,
          (phase, hash, message) => setStatus({ phase, hash, message })
        )
        setLastAction({
          phase: 'success',
          hash: result.contractHash,
          message: 'XLM transferred and payment recorded on Testnet.',
        })
        setForm(EMPTY_FORM)
        await refreshBalance()
        await refreshActivity()
      }
    } catch (err) {
      setLastAction({
        phase: 'failure',
        message: explainError(err),
      })
    } finally {
      setBusy(false)
    }
  }, [address, balance, submitRegularPayment, submitPolicyProtectedPayment, refreshBalance, refreshActivity])

  const handleClearPolicy = useCallback(() => {
    setSelectedPolicy(null)
    setLastAction(null)
  }, [])

  const isContractConfigured = () => /^C[A-Z2-7]{55}$/.test(PAYMENT_TRACKER_CONTRACT_ID)

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="signal-mark">T</span>
          <div>
            <h1>TracePay</h1>
            <p>Payment control platform · Orange Belt</p>
          </div>
        </div>
        <div className="wallet-area">
          <span className="network-pill">TESTNET</span>
          {address ? (
            <>
              <button className="wallet-chip" onClick={openProfile}>
                {shorten(address)}
              </button>
              <button className="button ghost" onClick={handleDisconnect}>
                Disconnect
              </button>
            </>
          ) : (
            <button
              className="button primary"
              onClick={handleConnect}
              disabled={busy || connecting}
            >
              {connecting ? 'Connecting...' : 'Choose wallet'}
            </button>
          )}
        </div>
      </header>

      <main>
        <section className="hero-panel">
          <div>
            <span className="eyebrow">ON-CHAIN PAYMENT CONTROL</span>
            <h2>Record proof.<br />Verify with policies.</h2>
            <p>
              Connect with Freighter, xBull, Albedo, Rabet and more.
              Every payment is recorded to Soroban. Policy-protected payments are validated
              by the PaymentPolicy contract before being recorded — the policy contract
              approves or rejects on-chain.
            </p>
          </div>
          <div className="metric">
            <span>Balance</span>
            <strong>
              {address ? (balance === null ? '—' : Number(balance).toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 7 })) : '—'}
            </strong>
            <small>XLM</small>
          </div>
        </section>

        <section className="proof-grid" aria-label="Deployment evidence">
          <div className="proof-card">
            <span className="proof-card__icon" aria-hidden="true">↗</span>
            <div><strong>2 live contracts</strong><small>PaymentTracker + PaymentPolicy</small></div>
          </div>
          <div className="proof-card">
            <span className="proof-card__icon" aria-hidden="true">✓</span>
            <div><strong>130 automated tests</strong><small>Frontend and Soroban coverage</small></div>
          </div>
          <a className="proof-card proof-card--link" href={`https://stellar.expert/explorer/testnet/tx/${INTER_CONTRACT_TRANSACTION_HASH}`} target="_blank" rel="noreferrer">
            <span className="proof-card__icon" aria-hidden="true">⟷</span>
            <div><strong>Verified cross-contract call</strong><small>{shorten(INTER_CONTRACT_TRANSACTION_HASH, 8, 8)} ↗</small></div>
          </a>
        </section>

        {!isContractConfigured() && (
          <div className="notice">
            <strong>Deployment pending</strong>
            <span>Set <code>VITE_PAYMENT_TRACKER_CONTRACT_ID</code> and <code>VITE_PAYMENT_POLICY_CONTRACT_ID</code> after deploying the contracts to Testnet.</span>
          </div>
        )}

        {status.phase !== 'idle' && (
          <div className={`tx-status ${status.phase}`}>
            <span className="status-dot" />
            <div>
              <strong>{status.phase.replace(/-/g, ' ')}</strong>
              <p>{status.message || (status.phase === 'pending' ? 'Waiting for ledger confirmation...' : status.phase === 'simulating' ? 'Simulating contract call...' : status.phase === 'awaiting-wallet-approval' ? 'Approve the contract call in your wallet.' : status.phase === 'submitting' ? 'Submitting to network...' : status.phase === 'confirming' ? 'Confirming on-chain...' : status.phase === 'synchronizing' ? 'Syncing with contract...' : 'Approve the contract call in your wallet.')}</p>
              {status.hash && (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${status.hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shorten(status.hash, 10, 10)} ↗
                </a>
              )}
            </div>
          </div>
        )}

        {lastAction && (
          <div className={`tx-status ${lastAction.phase}`}>
            <span className="status-dot" />
            <div>
              <strong>{lastAction.phase.replace(/-/g, ' ')}</strong>
              <p>{lastAction.message}</p>
              {lastAction.hash && (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${lastAction.hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shorten(lastAction.hash, 10, 10)} ↗
                </a>
              )}
            </div>
          </div>
        )}

        <div className="workspace-grid">
          <PolicyProtectedPaymentForm
            onSubmit={handlePayment}
            submitting={busy && status.phase !== 'idle'}
            selectedPolicy={selectedPolicy}
            onClearSelection={handleClearPolicy}
            busy={busy}
          />

          <PolicyCenter
            onSelectPolicy={setSelectedPolicy}
            selectedPolicyId={selectedPolicy?.id}
            onClearSelection={handleClearPolicy}
          />

          <ActivityPanel
            records={payments}
            eventCount={eventCount}
            syncState={syncState}
            onResync={() => { setStatus({ phase: 'synchronizing', hash: '', message: 'Resyncing...' }); void resync() }}
          />
        </div>

        <section className="contract-strip" aria-label="Deployed contracts">
          <div className="contract-strip__heading">
            <span className="eyebrow">CONTRACTS</span>
            <strong>Live on Stellar Testnet</strong>
          </div>
          <div className="contract-strip__links">
            {PAYMENT_TRACKER_CONTRACT_ID && (
              <a
                href={`https://stellar.expert/explorer/testnet/contract/${PAYMENT_TRACKER_CONTRACT_ID}`}
                target="_blank"
                rel="noreferrer"
              >
                <span>PaymentTracker</span>
                <strong>{shorten(PAYMENT_TRACKER_CONTRACT_ID, 8, 8)} ↗</strong>
              </a>
            )}
            {PAYMENT_POLICY_CONTRACT_ID && (
              <a href={`https://stellar.expert/explorer/testnet/contract/${PAYMENT_POLICY_CONTRACT_ID}`} target="_blank" rel="noreferrer">
                <span>PaymentPolicy</span>
                <strong>{shorten(PAYMENT_POLICY_CONTRACT_ID, 8, 8)} ↗</strong>
              </a>
            )}
          </div>
        </section>

        <footer className="site-footer">
          <span>TracePay · Built on Stellar Soroban</span>
          <a href="https://github.com/shegtory/tracepay" target="_blank" rel="noreferrer">View source on GitHub ↗</a>
        </footer>
      </main>
    </div>
  )
}
