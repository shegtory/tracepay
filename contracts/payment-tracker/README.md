# TracePay Payment Tracker contract

Soroban contract for Yellow Belt. It writes authenticated payment records to
persistent storage, exposes read methods, and emits a `payment` contract event.

```powershell
stellar contract build --manifest-path contracts/payment-tracker/Cargo.toml
stellar keys generate signal-deployer --network testnet --fund
stellar contract deploy `
  --wasm contracts/payment-tracker/target/wasm32v1-none/release/signal_payment_tracker.wasm `
  --source-account signal-deployer `
  --network testnet `
  --alias signal-payment-tracker
```

Copy the returned `C...` address to `.env.local` as `VITE_CONTRACT_ID`.
