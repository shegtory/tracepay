import { shorten } from '../../lib/stellar'

export default function PolicyList({ policies, loading, onSelect, onEdit, onToggle, selectedId }) {
  if (loading) {
    return (
      <div className="policy-list policy-list--loading">
        <div className="policy-list__spinner" />
        <p>Loading policies…</p>
      </div>
    )
  }

  if (policies.length === 0) {
    return (
      <div className="policy-list policy-list--empty">
        <span className="policy-list__empty-icon" aria-hidden="true">◌</span>
        <p>No payment policies yet.</p>
        <small>Create your first policy above to protect payments with configurable rules.</small>
      </div>
    )
  }

  return (
    <div className="policy-list" role="list" aria-label="Your payment policies">
      {policies.map((policy) => (
        <div
          key={policy.id}
          className={`policy-list__item ${selectedId === policy.id ? 'policy-list__item--selected' : ''}`}
          role="listitem"
        >
          <div className="policy-list__header">
            <div className="policy-list__info">
              <span className="policy-list__id">#{shorten(String(policy.id), 4, 4)}</span>
              <span className={`policy-list__badge ${policy.enabled ? 'policy-list__badge--enabled' : 'policy-list__badge--disabled'}`}>
                {policy.enabled ? 'Active' : 'Disabled'}
              </span>
            </div>
            <div className="policy-list__actions" onClick={(e) => e.stopPropagation()}>
              {onSelect && (
                <button
                  type="button"
                  className="policy-list__action"
                  onClick={() => onSelect(policy)}
                  disabled={!policy.enabled}
                  title={policy.enabled ? 'Use this policy for a payment' : 'Enable this policy first'}
                >
                  Use
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  className="policy-list__action"
                  onClick={() => onEdit(policy)}
                >
                  Edit
                </button>
              )}
              {onToggle && (
                <button
                  type="button"
                  className={`policy-list__action ${!policy.enabled ? 'policy-list__action--danger' : ''}`}
                  onClick={() => onToggle(policy.id, !policy.enabled)}
                >
                  {policy.enabled ? 'Disable' : 'Enable'}
                </button>
              )}
            </div>
          </div>

          <div className="policy-list__details">
            <div className="policy-list__row">
              <span>Max payment</span>
              <strong>{(policy.max_amount / 10_000_000).toLocaleString(undefined, { minimumFractionDigits: 7, maximumFractionDigits: 7 })} XLM</strong>
            </div>
            {policy.daily_limit && (
              <div className="policy-list__row">
                <span>Daily limit</span>
                <strong>{(policy.daily_limit / 10_000_000).toLocaleString(undefined, { minimumFractionDigits: 7, maximumFractionDigits: 7 })} XLM</strong>
              </div>
            )}
            {policy.approved_recipient && (
              <div className="policy-list__row">
                <span>Approved sender</span>
                <strong>{shorten(policy.approved_recipient, 6, 6)}</strong>
              </div>
            )}
            <div className="policy-list__row policy-list__row--muted">
              <span>Used today</span>
              <span>{(policy.total_used_today / 10_000_000).toFixed(7)} XLM</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
