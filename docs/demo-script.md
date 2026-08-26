# TracePay Orange Belt — Demo Script

**Duration:** 1–2 minutes  
**Format:** Screen recording with voiceover  
**Language:** English

---

## Segment 1: TracePay Problem and Product (0:00–0:15)

**Visual:** Open TracePay in the browser. Show the topbar with "TracePay" branding, the TESTNET pill, and the "Choose wallet" button. Show the hero panel text: "Record proof. Verify with policies."

**Voiceover:**
"TracePay is a payment tracking dApp on the Stellar Testnet. But standard payment tracking has a problem — anyone can record any payment without rules. The recorder controls what gets written. There's no policy enforcement, no spending limits, no recipient restrictions. For real payment control, you need policies that run on-chain and can't be bypassed."

**Visual:** Highlight the existing features briefly — wallet connection, balance display, payment form.

---

## Segment 2: Multi-Wallet Connection (0:15–0:25)

**Visual:** Click "Choose wallet". Show the wallet selection modal (Freighter, xBull, Albedo, Rabet, etc.). Select a wallet and connect. Show the connected state with the wallet address chip and the balance display.

**Voiceover:**
"TracePay supports multiple Stellar wallets through Stellar Wallets Kit. Connect with Freighter, xBull, Albedo, Rabet, or any compatible wallet. Once connected, your Testnet balance is displayed and all operations are signed by your wallet — no keys are stored or transmitted."

---

## Segment 3: Creating a Payment Policy (0:25–0:40)

**Visual:** Navigate to the Policy Center panel. Click "+ New Policy". Fill in:
- Maximum Payment Amount: 10 XLM
- Daily Spending Limit: 50 XLM
- Approved Recipient: leave empty (allow any sender)

Show the form validation. Click "Create Policy". Show the pending → success state flow with the transaction hash.

**Voiceover:**
"Now let's create a payment policy. A policy defines rules that payments must satisfy before they can be recorded. We'll set a maximum single payment of 10 XLM, a daily spending limit of 50 XLM, and leave the approved recipient open so any sender can use this policy. When you create the policy, it's deployed to the Stellar Testnet as a Soroban smart contract. The policy owner is the connected wallet — only the owner can update or disable it."

---

## Segment 4: Making a Policy-Approved Payment (0:40–0:55)

**Visual:** In the payment form, show the policy preview panel appearing when a policy is selected. Show the policy rules: "Max: 10 XLM, Daily: 50 XLM". Fill in a destination address and a small amount (e.g., 2 XLM). Submit the payment. Show the state transitions: preparing → simulating → awaiting wallet approval → submitting → confirming → success.

**Voiceover:**
"Now we'll make a policy-protected payment. Select the policy and fill in the payment form. Notice the policy preview showing the rules. When you submit, here's what happens on-chain: first, the XLM is transferred. Then, PaymentTracker invokes PaymentPolicy.validate_and_record. The policy checks the amount against the max, the daily limit, and the approved recipient. If everything passes, the policy approves and PaymentTracker records the payment. If anything fails, the payment is rejected and you see which rule was violated."

---

## Segment 5: Showing an Intentionally Rejected Payment (0:55–1:10)

**Visual:** Create a second policy with a very low max amount (e.g., 0.1 XLM). Attempt a payment of 5 XLM against that policy. Show the rejection state with the reason "Payment amount exceeds the policy maximum." Show the transaction hash for the rejection event.

**Voiceover:**
"Now let's see a rejection. Create a policy with a maximum of 0.1 XLM. Try to send 5 XLM against it. The policy rejects the payment because it exceeds the maximum. The rejection is recorded on-chain with a reason, and both the payment rejection event and the policy rejection event are emitted. This is the key advantage of on-chain policies — the rejection is verifiable, not just a frontend check."

---

## Segment 6: Explaining Inter-Contract Communication (1:10–1:25)

**Visual:** Show the contract strip at the bottom of the page with both contract IDs. Show the explorer links. Optionally show a diagram or the backend flow in text form.

**Voiceover:**
"TracePay uses two contracts that talk to each other. PaymentTracker records payments. PaymentPolicy validates them. When you submit a policy-protected payment, PaymentTracker calls PaymentPolicy.validate_and_record through a real Soroban cross-contract invocation. This is not simulated in the frontend — it's an actual on-chain call between two deployed contracts. The policy returns approval or rejection, and PaymentTracker acts accordingly. This means the policy can't be bypassed by calling PaymentTracker directly, because PaymentTracker itself enforces the policy check."

---

## Segment 7: Showing Real-Time Events (1:25–1:35)

**Visual:** Show the activity feed with events from both contracts. Show the sync indicator "Syncing every 6s" and the event count. Optionally trigger a sync to show fresh events.

**Voiceover:**
"Both contracts emit events that the frontend synchronizes in real time. PaymentTracker emits payment events. PaymentPolicy emits policy events — created, updated, enabled, approved, and rejected. The frontend polls these events every 6 seconds, deduplicates them by event id, and displays them in the activity feed. You can also manually resync at any time."

---

## Segment 8: Showing CI Test Results (1:35–1:45)

**Visual:** Switch to the GitHub repository. Open the Actions tab. Show the CI workflow run with all jobs passing (green checkmarks). Expand the contract tests job to show passing test output.

**Voiceover:**
"TracePay has a CI pipeline that runs on every pull request and push to main. The frontend job runs npm ci, lint, typecheck, tests, and production build. The contracts job runs rustfmt check, contract tests for both contracts, and builds the WASM. Everything must pass before merging."

---

## Segment 9: Showing Deployed Contracts and Explorer Evidence (1:45–1:55)

**Visual:** Switch to Stellar Expert. Show the PaymentTracker contract page. Show the PaymentPolicy contract page (if deployed). Show a transaction with events. Point out the contract IDs and explorer links in the TracePay UI.

**Voiceover:**
"Both contracts are deployed on Stellar Testnet. You can verify them on Stellar Expert — the contract IDs are displayed in the TracePay UI and linked directly to the explorer. Every transaction has a hash you can look up. The deployment workflow outputs both contract IDs and the inter-contract transaction hash, so you can verify the entire flow independently."

---

## Closing (1:55–2:00)

**Visual:** Back to TracePay. Show the full UI one more time.

**Voiceover:**
"TracePay Orange Belt transforms payment tracking into payment control. With two interoperating Soroban contracts, on-chain policy enforcement, real-time event synchronization, and full CI/CD, it's a production-oriented platform for verifying payments on the Stellar Testnet."

---

## Recording Notes

- Record at 1080p, 30fps
- Use a clean browser profile (no extra tabs or bookmarks visible)
- Speak clearly and at a moderate pace
- Pause briefly between segments for editing
- Ensure all text is readable — zoom in if needed
- Do not include any personal information, secret keys, or private data in the recording
- If a step fails (e.g., wallet doesn't connect), re-record that segment

## Demo Video Link

_Pending — insert the video link here after recording and uploading._
