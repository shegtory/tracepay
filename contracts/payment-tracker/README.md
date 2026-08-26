# PaymentTracker Contract

## Overview

PaymentTracker records authenticated XLM payments on the Stellar Testnet and emits
`payment` events that the frontend synchronizes for the live activity feed.

## Contract ID (Testnet)

`CB6LYC7FWQTOWHPA3FZRYAOY7QSNUGIPQEN6U3BVCC3YKDDMYQGDHZ2J`

## Explorer

[View contract on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CB6LYC7FWQTOWHPA3FZRYAOY7QSNUGIPQEN6U3BVCC3YKDDMYQGDHZ2J)

## Methods

### `record(sender, destination, amount, memo) -> u64`

Records a payment without policy validation (backward-compatible).

| Parameter | Type | Description |
| --- | --- | --- |
| `sender` | `Address` | Stellar address of the sender (must auth) |
| `destination` | `Address` | Stellar address of the recipient |
| `amount` | `i128` | Amount in stroops (1 XLM = 10,000,000 stroops) |
| `memo` | `String` | Optional memo (max 64 characters) |

Returns the monotonically increasing payment id.

### `record_with_policy(sender, destination, amount, memo, policy_contract, policy_id) -> u64`

Records a payment after validating against a payment policy via inter-contract call.
If the policy rejects, the transaction panics with the rejection reason and a
`payment_rejected` event is emitted.

| Parameter | Type | Description |
| --- | --- | --- |
| `sender` | `Address` | Stellar address of the sender (must auth) |
| `destination` | `Address` | Stellar address of the recipient |
| `amount` | `i128` | Amount in stroops |
| `memo` | `String` | Memo (max 64 characters) |
| `policy_contract` | `Address` | PaymentPolicy contract address |
| `policy_id` | `u64` | Policy id to validate against |

Returns the payment id on success.

### `count() -> u64`

Returns the total number of payments recorded.

### `get(id) -> Option<PaymentRecord>`

Returns a single payment record by id, or None if not found.

### `recent(limit) -> Vec<PaymentRecord>`

Returns the most recent payments, capped at 20.

### `payments_by_policy(policy_id) -> Vec<PaymentRecord>`

Returns all payments that used a specific policy.

## PaymentRecord

| Field | Type | Description |
| --- | --- | --- |
| `id` | `u64` | Payment id |
| `sender` | `Address` | Sender address |
| `destination` | `Address` | Recipient address |
| `amount` | `i128` | Amount in stroops |
| `memo` | `String` | Memo |
| `ledger` | `u32` | Ledger sequence when recorded |
| `policy_id` | `Option<u64>` | Policy id if policy-protected |
| `policy_approved` | `bool` | Whether policy approved |
| `policy_contract` | `Option<Address>` | Policy contract address if policy-protected |

## Events

### `PaymentRecorded(sender, id, destination, amount, memo, policy_id, policy_approved)`

Emitted when a payment is recorded.

| Topic | Data |
| --- | --- |
| `payment` | sender, id, destination, amount, memo, policy_id, policy_approved |

### `PaymentRejected(sender, id, destination, amount, reason, policy_id)`

Emitted when a policy-protected payment is rejected.

| Topic | Data |
| --- | --- |
| `payment` | sender, id, destination, amount, reason, policy_id |

## Inter-Contract Communication

When `record_with_policy` is called with a policy contract and policy id, the
PaymentTracker contract makes a real cross-contract invocation to
`PaymentPolicy.validate_and_record(policy_id, sender, amount)`. The policy returns
whether to approve or reject, and PaymentTracker records or aborts accordingly.

## Authorization

- `sender.require_auth()` is called on every `record` and `record_with_policy` call.
- The sender must be the Stellar account signing the transaction.

## Testnet Verification

The contract was deployed and verified via the Yellow Belt workflow:

- Deployment transaction: `b5fea73178ce5284ccd316c19ff5079fd76b60fcbe94f82eb7a631a95eb9b373`
- [View on Stellar Expert](https://stellar.expert/explorer/testnet/tx/b5fea73178ce5284ccd316c19ff5079fd76b60fcbe94f82eb7a631a95eb9b373)
