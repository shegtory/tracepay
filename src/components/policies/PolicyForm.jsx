import { useState, useCallback } from 'react'
import { validateStellarAddress, validateAmount } from '../../lib/stellar'

export default function PolicyForm({ onCreate, onCancel, submitting, existingPolicy }) {
  const [maxAmount, setMaxAmount] = useState(existingPolicy?.max_amount ? (existingPolicy.max_amount / 10_000_000).toString() : '')
  const [dailyLimit, setDailyLimit] = useState(existingPolicy?.daily_limit ? (existingPolicy.daily_limit / 10_000_000).toString() : '')
  const [approvedRecipient, setApprovedRecipient] = useState(existingPolicy?.approved_recipient || '')
  const [formError, setFormError] = useState(null)

  const validate = useCallback(() => {
    if (!validateAmount(maxAmount)) {
      return 'Maximum payment amount must be greater than 0.'
    }
    if (dailyLimit && (!validateAmount(dailyLimit) || Number(dailyLimit) < Number(maxAmount))) {
      return 'Daily limit must be 0 (no limit) or greater than or equal to the maximum amount.'
    }
    if (approvedRecipient && !validateStellarAddress(approvedRecipient)) {
      return 'Approved recipient must be a valid Stellar address (starts with G, 56 characters).'
    }
    return null
  }, [maxAmount, dailyLimit, approvedRecipient])

  const handleSubmit = useCallback((e) => {
    e.preventDefault()
    const error = validate()
    if (error) {
      setFormError(error)
      return
    }
    setFormError(null)
    onCreate({
      maxAmount: Number(maxAmount) * 10_000_000,
      dailyLimit: dailyLimit ? Number(dailyLimit) * 10_000_000 : 0,
      approvedRecipient: approvedRecipient || null,
    })
  }, [maxAmount, dailyLimit, approvedRecipient, onCreate, validate])

  return (
    <form onSubmit={handleSubmit} className="policy-form">
      <div className="policy-form__header">
        <h3 className="policy-form__title">
          {existingPolicy ? 'Edit Policy' : 'Create Payment Policy'}
        </h3>
        <p className="policy-form__subtitle">
          {existingPolicy
            ? 'Update the policy rules that payments must pass before being recorded.'
            : 'Define the rules a payment must satisfy before it can be recorded on-chain.'
          }
        </p>
      </div>

      <div className="policy-form__field">
        <label className="policy-form__label">
          <span>Maximum Payment Amount (XLM)</span>
          <span className="policy-form__hint">Largest single payment this policy will approve</span>
        </label>
        <input
          type="number"
          min="0.0000001"
          step="0.0000001"
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
          placeholder="10.00"
          disabled={submitting}
          className="policy-form__input"
        />
      </div>

      <div className="policy-form__field">
        <label className="policy-form__label">
          <span>Daily Spending Limit (XLM, optional)</span>
          <span className="policy-form__hint">Leave at 0 for no daily limit</span>
        </label>
        <input
          type="number"
          min="0"
          step="0.0000001"
          value={dailyLimit}
          onChange={(e) => setDailyLimit(e.target.value)}
          placeholder="0"
          disabled={submitting}
          className="policy-form__input"
        />
      </div>

      <div className="policy-form__field">
        <label className="policy-form__label">
          <span>Approved Recipient (optional)</span>
          <span className="policy-form__hint">Leave empty to allow any sender; enter a G… address to restrict to one sender</span>
        </label>
        <input
          type="text"
          value={approvedRecipient}
          onChange={(e) => setApprovedRecipient(e.target.value.toUpperCase())}
          placeholder="GABCDEF…WXYZ"
          disabled={submitting}
          className="policy-form__input policy-form__input--mono"
        />
      </div>

      {formError && (
        <div className="policy-form__error" role="alert">
          {formError}
        </div>
      )}

      <div className="policy-form__actions">
        {onCancel && (
          <button
            type="button"
            className="policy-form__cancel"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="policy-form__submit"
          disabled={submitting}
        >
          {submitting ? 'Submitting…' : (existingPolicy ? 'Update Policy' : 'Create Policy')}
        </button>
      </div>
    </form>
  )
}
