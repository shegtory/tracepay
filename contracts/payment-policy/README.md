# PaymentPolicy Contract

## Overview

PaymentPolicy is a Soroban smart contract that defines configurable rules for
payments. PaymentTracker invokes this contract before recording a policy-protected
payment. The policy approves or rejects based on max amount, daily limit, approved
recipient, and enabled status.

## Contract ID (Testnet)

_TBD — deployed via the Orange Belt deployment workflow._

## Methods

### `create(max_amount, daily_limit, approved_recipient) -> u64`

Creates a new payment policy. The caller becomes the policy owner.

| Parameter | Type | Description |
| --- | --- | --- |
| `max_amount` | `i128` | Maximum allowed single payment (stroops). Must be > 0. |
| `daily_limit` | `i128` | Optional daily spending limit (stroops). Pass 0 for no limit. |
| `approved_recipient` | `Address` | Optional approved sender. Pass empty address to allow any sender. |

Returns the policy id.

**Events emitted:** `PolicyCreated(id, owner, max_amount)`

### `get_policy(id) -> Option<Policy>`

Returns a policy by id, or None if not found.

### `get_owner(id) -> Option<Address>`

Returns the owner of a policy.

### `get_policies_by_owner(owner) -> Vec<Policy>`

Returns all policies owned by an address.

### `update(id, max_amount, daily_limit, approved_recipient) -> ()`

Updates a policy's configuration. Only the policy owner can call this.

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `u64` | Policy id to update |
| `max_amount` | `i128` | New max amount (must be > 0) |
| `daily_limit` | `i128` | New daily limit (0 for no limit, or >= max_amount) |
| `approved_recipient` | `Address` | New approved recipient (empty to allow any) |

**Events emitted:** `PolicyUpdated(id, max_amount, daily_limit, approved_recipient)`

### `set_enabled(id, enabled) -> ()`

Enables or disables a policy. Only the policy owner can call this.

**Events emitted:** `PolicyEnabled(id, enabled)`

### `validate_and_record(policy_id, sender, amount) -> bool`

Validates a payment against the policy. If approved, records the usage and emits
a `PolicyApproved` event. If rejected, records the usage and emits a
`PolicyRejected` event. Only the policy owner (or authorized contract) can call
this.

| Parameter | Type | Description |
| --- | --- | --- |
| `policy_id` | `u64` | Policy id to validate against |
| `sender` | `Address` | Sender of the payment |
| `amount` | `i128` | Payment amount (stroops) |

Returns true if approved, false if rejected.

**Events emitted:**
- `PolicyApproved(id, sender, amount, ledger)` on approval
- `PolicyRejected(id, sender, amount, reason, ledger)` on rejection

### `policy_count() -> u64`

Returns the total number of policies.

### `usage_count() -> u64`

Returns the total number of policy usage records.

### `recent_usage(limit) -> Vec<PolicyUsage>`

Returns the most recent usage records, capped at 50.

## Policy

| Field | Type | Description |
| --- | --- | --- |
| `id` | `u64` | Policy id |
| `owner` | `Address` | Policy owner |
| `max_amount` | `i128` | Maximum payment (stroops) |
| `daily_limit` | `Option<i128>` | Daily limit (None = no limit) |
| `approved_recipient` | `Option<Address>` | Approved sender (None = any) |
| `enabled` | `bool` | Whether the policy is active |
| `total_used_today` | `i128` | Running total today (stroops) |
| `daily_reset_ledger` | `u32` | Ledger of last daily reset |

## PolicyUsage

| Field | Type | Description |
| --- | --- | --- |
| `policy_id` | `u64` | Policy id |
| `sender` | `Address` | Payment sender |
| `amount` | `i128` | Payment amount (stroops) |
| `approved` | `bool` | Whether approved |
| `reason` | `String` | Approval or rejection reason |
| `ledger` | `u32` | Ledger sequence |

## Events

### `PolicyCreated(id, owner, max_amount)`

Emitted when a policy is created.

| Topic | Data |
| --- | --- |
| `policy` | id, owner, max_amount |

### `PolicyUpdated(id, max_amount, daily_limit, approved_recipient)`

Emitted when a policy is updated.

| Topic | Data |
| --- | --- |
| `policy` | id, max_amount, daily_limit, approved_recipient |

### `PolicyEnabled(id, enabled)`

Emitted when a policy is enabled or disabled.

| Topic | Data |
| --- | --- |
| `policy` | id, enabled |

### `PolicyApproved(id, sender, amount, ledger)`

Emitted when a payment is approved by a policy.

| Topic | Data |
| --- | --- |
| `policy` | id, sender, amount, ledger |

### `PolicyRejected(id, sender, amount, reason, ledger)`

Emitted when a payment is rejected by a policy.

| Topic | Data |
| --- | --- |
| `policy` | id, sender, amount, reason, ledger |

## Authorization

- `create`: The caller becomes the policy owner.
- `update`, `set_enabled`: Only the policy owner can call. Panics with "unauthorized" otherwise.
- `validate_and_record`: Only the policy owner can validate payments. In the
  inter-contract flow, PaymentTracker calls this as the policy owner.

## Validation Rules

A payment is approved by `validate_and_record` when ALL of the following are true:

1. The policy is enabled.
2. The amount does not exceed `max_amount`.
3. If `approved_recipient` is set, the sender matches the approved recipient.
4. If `daily_limit` is set, the daily usage plus this payment does not exceed the limit.

If any rule fails, the payment is rejected with a specific reason string.

## Daily Reset

The daily counter resets when the current ledger exceeds `daily_reset_ledger`.
The reset happens automatically on the next validation call after the ledger
advances.
