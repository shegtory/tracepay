# Orange Belt Screenshots

These screenshots must be captured from real UI interactions, GitHub Actions output,
test results, and Stellar Expert explorer pages. No fake or placeholder screenshots
are included in this repository.

## Required Screenshots

### 1. mobile-responsive.png
**Capture:** A screenshot of TracePay at ~375px width showing:
- Wallet connection button visible
- Policy Center panel visible
- Payment form visible
- No horizontal overflow
- Touch targets adequately sized

**How to capture:**
1. Open the dev server
2. Resize the browser to 375px width
3. Capture the full viewport
4. Save as `mobile-responsive.png`

### 2. multi-wallet-connected.png
**Capture:** A screenshot showing:
- Wallet connected (Freighter, xBull, Albedo, Rabet, or other)
- Wallet address displayed (shortened)
- Disconnect button visible
- TESTNET pill visible

**How to capture:**
1. Connect a Stellar wallet
2. Capture the topbar showing the connected state
3. Save as `multi-wallet-connected.png`

### 3. policy-created.png
**Capture:** A screenshot showing:
- Policy Center with a newly created policy
- Policy details visible (max amount, daily limit, approved recipient)
- Active badge visible
- Success message with transaction hash

**How to capture:**
1. Create a policy via the Policy Center
2. After the transaction confirms, capture the Policy Center
3. Save as `policy-created.png`

### 4. inter-contract-success.png
**Capture:** A screenshot showing:
- Policy-protected payment form with a policy selected
- Validation preview showing the policy rules
- Successful transaction with policy-approved message
- Transaction hash linking to Stellar Expert

**How to capture:**
1. Select a policy in the Policy Center
2. Fill in the payment form
3. Submit the policy-protected payment
4. After confirmation, capture the success state
5. Save as `inter-contract-success.png`

### 5. policy-rejection.png
**Capture:** A screenshot showing:
- A payment rejected by the policy (e.g., exceeds limit or unauthorized recipient)
- Rejection reason visible
- Transaction hash for the rejection event visible

**How to capture:**
1. Create a policy with a low max amount (e.g., 0.1 XLM)
2. Attempt a payment exceeding that limit
3. Capture the error state showing the rejection reason
4. Save as `policy-rejection.png`

### 6. realtime-events.png
**Capture:** A screenshot showing:
- Activity feed with events from both PaymentTracker and PaymentPolicy
- Sync state indicator showing "Syncing every 6s"
- Event count visible
- Multiple payment/policy events visible

**How to capture:**
1. Wait for events to synchronize
2. Capture the activity feed showing live events
3. Save as `realtime-events.png`

### 7. ci-pipeline-passing.png
**Capture:** A screenshot of GitHub Actions showing:
- CI workflow run passing (green checkmark)
- Frontend and contract jobs passing
- All steps completed successfully

**How to capture:**
1. Push to trigger the CI workflow
2. Wait for the workflow to complete
3. Capture the Actions tab showing passing status
4. Save as `ci-pipeline-passing.png`

### 8. contract-tests-passing.png
**Capture:** A screenshot of contract test output showing:
- `cargo test` output for PaymentTracker
- `cargo test` output for PaymentPolicy
- All tests passing (test result lines)

**How to capture:**
1. Run `cargo test` for both contracts locally
2. Capture the terminal output showing passing tests
3. Save as `contract-tests-passing.png`

### 9. deployment-workflow.png
**Capture:** A screenshot of GitHub Actions showing:
- Deployment workflow run (workflow_dispatch)
- Both contracts deployed
- Contract IDs displayed
- Transaction hashes displayed

**How to capture:**
1. Manually trigger the deployment workflow
2. After deployment completes, capture the workflow output
3. Save as `deployment-workflow.png`

### 10. explorer-interaction.png
**Capture:** A screenshot of Stellar Expert showing:
- A contract interaction (payment or policy call)
- Event details visible
- Contract addresses visible

**How to capture:**
1. After a successful on-chain interaction, open the explorer link
2. Capture the explorer page showing the transaction details
3. Save as `explorer-interaction.png`

## Placement

All screenshots go in this folder: `docs/screenshots/orange-belt/`

## Naming Convention

Use the exact filenames listed above. Do not rename or add extra files without
updating the README.

## Quality Requirements

- Screenshots must be real captures, not mockups or edited images
- UI text must be readable (at least 12px equivalent)
- Transaction hashes and contract IDs must match real on-chain data
- Screenshots must show the actual product state at the time of capture
