import { useState, useCallback } from 'react'
import { usePolicies } from '../../hooks/useContractOperations'
import { useWallet } from '../../hooks/useContractOperations'
import PolicyForm from './PolicyForm'
import PolicyList from './PolicyList'
import { shorten } from '../../lib/stellar'

export default function PolicyCenter({ onSelectPolicy, selectedPolicyId, onClearSelection: _onClearSelection }) {
  const { policies, loading, createPolicy, updatePolicy, setEnabled, refresh } = usePolicies()
  const { address } = useWallet()

  const [editingPolicy, setEditingPolicy] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [lastAction, setLastAction] = useState(null)

  const handleCreate = useCallback(async (config) => {
    setSubmitting(true)
    try {
      const result = await createPolicy(
        config.maxAmount,
        config.dailyLimit,
        config.approvedRecipient,
        (phase, hash, message) => setLastAction({ phase, hash, message })
      )
      setLastAction({
        phase: 'success',
        hash: result.hash,
        message: 'Policy created successfully.',
      })
      setShowForm(false)
      refresh()
    } catch (err) {
      setLastAction({
        phase: 'failure',
        message: err.message,
      })
    } finally {
      setSubmitting(false)
    }
  }, [createPolicy, refresh])

  const handleEdit = useCallback(async (policy) => {
    setEditingPolicy(policy)
    setShowForm(true)
  }, [])

  const handleUpdate = useCallback(async (config) => {
    if (!editingPolicy) return
    setSubmitting(true)
    try {
      const result = await updatePolicy(
        editingPolicy.id,
        config.maxAmount,
        config.dailyLimit,
        config.approvedRecipient,
        (phase, hash, message) => setLastAction({ phase, hash, message })
      )
      setLastAction({
        phase: 'success',
        hash: result.hash,
        message: 'Policy updated successfully.',
      })
      setEditingPolicy(null)
      setShowForm(false)
      refresh()
    } catch (err) {
      setLastAction({
        phase: 'failure',
        message: err.message,
      })
    } finally {
      setSubmitting(false)
    }
  }, [updatePolicy, editingPolicy, refresh])

  const handleToggle = useCallback(async (policyId, enabled) => {
    setSubmitting(true)
    try {
      const result = await setEnabled(policyId, enabled, (phase, hash, message) => setLastAction({ phase, hash, message }))
      setLastAction({
        phase: 'success',
        hash: result.hash,
        message: enabled ? 'Policy enabled.' : 'Policy disabled.',
      })
      refresh()
    } catch (err) {
      setLastAction({
        phase: 'failure',
        message: err.message,
      })
    } finally {
      setSubmitting(false)
    }
  }, [setEnabled, refresh])

  const handleSelect = useCallback((policy) => {
    if (!policy.enabled) {
      setLastAction({
        phase: 'failure',
        message: 'This policy is disabled. Enable it before using it for payments.',
      })
      return
    }
    onSelectPolicy?.(policy)
  }, [onSelectPolicy])

  const cancel = useCallback(() => {
    setShowForm(false)
    setEditingPolicy(null)
    setLastAction(null)
  }, [])

  return (
    <section className="card policy-center">
      <div className="card-heading">
        <div>
          <span className="eyebrow live">POLICY CENTER</span>
          <h3>Payment Policies</h3>
        </div>
        <button
          type="button"
          className="button primary"
          onClick={() => { setShowForm(true); setEditingPolicy(null) }}
          disabled={submitting || !address}
        >
          + New Policy
        </button>
      </div>

      {!address && (
        <div className="policy-center__notice">
          <strong>Connect a wallet</strong>
          <span>You need to connect a Stellar wallet to create or manage policies.</span>
        </div>
      )}

      {lastAction && (
        <div className={`tx-status ${lastAction.phase}`}>
          <span className="status-dot" />
          <div>
            <strong>{lastAction.phase.replace(/-/g, ' ')}</strong>
            <p>{lastAction.message || (lastAction.phase === 'pending' ? 'Waiting for ledger confirmation…' : '')}</p>
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

      <PolicyForm
        onCreate={handleCreate}
        onCancel={!editingPolicy ? cancel : undefined}
        submitting={submitting}
        existingPolicy={editingPolicy}
      />

      <div className="policy-list-wrapper">
        <h4 className="policy-list-wrapper__title">
          Your Policies ({policies.length})
        </h4>
        <PolicyList
          policies={policies}
          loading={loading}
          onSelect={handleSelect}
          onEdit={handleEdit}
          onToggle={handleToggle}
          selectedId={selectedPolicyId}
        />
      </div>

      <style>{`
        .policy-center__notice {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          padding: 14px 18px;
          margin-bottom: 18px;
          border: 1px solid #5d4b25;
          background: #1c180d;
          color: #e7d5a8;
          font-size: 12px;
        }
        .policy-center__notice strong { color: var(--lime); }
        .policy-center__notice span { color: inherit; }
        .policy-form { margin-bottom: 24px; }
        .policy-form__header {
          margin-bottom: 24px;
          padding-bottom: 18px;
          border-bottom: 1px solid var(--line);
        }
        .policy-form__title {
          margin: 0 0 8px;
          font-size: 22px;
          letter-spacing: -.03em;
        }
        .policy-form__subtitle {
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.6;
        }
        .policy-form__field {
          margin-bottom: 20px;
        }
        .policy-form__label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          color: var(--muted);
          font: 10px DM Mono, monospace;
          text-transform: uppercase;
          letter-spacing: .1em;
          margin-bottom: 8px;
        }
        .policy-form__hint {
          color: #60746b;
          font-size: 9px;
          text-transform: none;
          letter-spacing: 0;
        }
        .policy-form__input {
          width: 100%;
          border: 1px solid var(--line);
          border-radius: 5px;
          padding: 14px 13px;
          color: #f3f7f4;
          background: #08110e;
          font: 13px DM Mono, monospace;
          outline: 0;
          box-sizing: border-box;
        }
        .policy-form__input:focus {
          border-color: var(--mint);
          box-shadow: 0 0 0 3px rgba(113,230,181,.08);
        }
        .policy-form__input--mono {
          font-family: DM Mono, monospace;
          letter-spacing: .02em;
        }
        .policy-form__error {
          padding: 12px 14px;
          margin-bottom: 18px;
          border: 1px solid #6a3732;
          background: #21110f;
          color: var(--danger);
          font-size: 12px;
          border-radius: 5px;
        }
        .policy-form__actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }
        .policy-form__cancel {
          flex: 1;
          min-height: 44px;
          padding: 0 16px;
          border: 1px solid var(--line);
          background: transparent;
          color: var(--muted);
          border-radius: 7px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
        }
        .policy-form__cancel:disabled {
          opacity: .42;
          cursor: not-allowed;
        }
        .policy-form__submit {
          flex: 2;
          min-height: 44px;
          padding: 0 16px;
          border: 0;
          background: var(--lime);
          color: #0a120e;
          border-radius: 7px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          box-shadow: 0 0 24px rgba(200,255,96,.1);
        }
        .policy-form__submit:disabled {
          opacity: .42;
          cursor: not-allowed;
        }
        .policy-list-wrapper {
          margin-top: 8px;
        }
        .policy-list-wrapper__title {
          margin: 0 0 14px;
          font-size: 11px;
          color: var(--muted);
          font: 600 11px DM Mono, monospace;
          text-transform: uppercase;
          letter-spacing: .12em;
        }
        .policy-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .policy-list--loading {
          padding: 40px 20px;
          text-align: center;
          color: var(--muted);
        }
        .policy-list--empty {
          padding: 40px 20px;
          text-align: center;
          color: var(--muted);
        }
        .policy-list__empty-icon {
          font-size: 40px;
          color: #3e5c4f;
          display: block;
          margin-bottom: 12px;
        }
        .policy-list__spinner {
          width: 24px;
          height: 24px;
          border: 2px solid rgba(120, 200, 255, 0.25);
          border-top-color: #78c8ff;
          border-radius: 50%;
          animation: feed-spin 0.9s linear infinite;
          margin: 0 auto 14px;
        }
        .policy-list__item {
          background: rgba(18,33,27,.6);
          border: 1px solid var(--line);
          border-radius: 6px;
          padding: 14px 16px;
          cursor: pointer;
          transition: border-color .15s;
        }
        .policy-list__item:hover {
          border-color: #345746;
        }
        .policy-list__item--selected {
          border-color: var(--mint);
          background: rgba(113,230,181,.08);
        }
        .policy-list__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }
        .policy-list__info {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .policy-list__id {
          font: 11px DM Mono, monospace;
          color: var(--lime);
        }
        .policy-list__badge {
          font: 9px DM Mono, monospace;
          text-transform: uppercase;
          letter-spacing: .08em;
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid;
        }
        .policy-list__badge--enabled {
          color: var(--mint);
          border-color: #254c3c;
          background: #0c2119;
        }
        .policy-list__badge--disabled {
          color: var(--danger);
          border-color: #4a2520;
          background: #21110f;
        }
        .policy-list__actions {
          display: flex;
          gap: 6px;
        }
        .policy-list__action {
          width: 60px;
          min-height: 34px;
          padding: 0 10px;
          border: 1px solid var(--line);
          background: transparent;
          color: var(--muted);
          border-radius: 5px;
          font: 600 11px DM Mono, monospace;
          text-transform: uppercase;
          letter-spacing: .06em;
          cursor: pointer;
          transition: all .15s;
        }
        .policy-list__action:hover:not(:disabled) {
          border-color: var(--mint);
          color: var(--mint);
        }
        .policy-list__action:disabled {
          opacity: .4;
          cursor: not-allowed;
        }
        .policy-list__action--danger:hover:not(:disabled) {
          border-color: var(--danger);
          color: var(--danger);
        }
        .policy-list__details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px 16px;
        }
        .policy-list__row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font: 10px DM Mono, monospace;
        }
        .policy-list__row span:first-child {
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: .06em;
        }
        .policy-list__row strong {
          color: #eef4ef;
        }
        .policy-list__row--muted span:last-child {
          color: #60746b;
        }
        @media (max-width: 480px) {
          .policy-list__details {
            grid-template-columns: 1fr;
          }
          .policy-list__actions {
            flex-wrap: wrap;
          }
          .policy-list__action {
            flex: 1;
            min-width: 60px;
          }
        }
      `}</style>
    </section>
  )
}
