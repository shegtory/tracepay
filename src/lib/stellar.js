import { Address, Asset, BASE_FEE, Contract, Horizon, Networks, Operation, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk";
import deployment from "../config/deployment.json";

export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID || deployment.contractId || "";
const horizon = new Horizon.Server(HORIZON_URL);
const rpcServer = new rpc.Server(RPC_URL);

export const isContractConfigured = () => /^C[A-Z2-7]{55}$/.test(CONTRACT_ID);

export async function fetchXlmBalance(publicKey) {
  try {
    const account = await horizon.loadAccount(publicKey);
    return account.balances.find((item) => item.asset_type === "native")?.balance || "0";
  } catch (error) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
}

function contractClient() {
  if (!isContractConfigured()) throw new Error("Contract is not configured. Add VITE_CONTRACT_ID to .env.local.");
  return new Contract(CONTRACT_ID);
}

async function buildContractTransaction(sourceAddress, operation) {
  const source = await rpcServer.getAccount(sourceAddress);
  const transaction = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(operation).setTimeout(60).build();
  return rpcServer.prepareTransaction(transaction);
}

async function waitForTransaction(hash, onStatus) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await rpcServer.getTransaction(hash);
    if (result.status === "SUCCESS") return result;
    if (result.status === "FAILED") throw new Error("Contract transaction failed on-chain.");
    onStatus?.("pending", hash);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("Confirmation timed out. Check the hash on Stellar Expert.");
}

export async function recordPayment({ sender, destination, amount, memo, onStatus }) {
  const operation = contractClient().call("record", new Address(sender).toScVal(), new Address(destination).toScVal(), nativeToScVal(BigInt(Math.round(Number(amount) * 10_000_000)), { type: "i128" }), nativeToScVal(memo || "TracePay payment", { type: "string" }));
  const prepared = await buildContractTransaction(sender, operation);
  onStatus?.("awaiting-signature");
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(prepared.toXDR(), { address: sender, networkPassphrase: NETWORK_PASSPHRASE });
  const submitted = await rpcServer.sendTransaction(TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE));
  if (submitted.status === "ERROR") throw new Error("RPC rejected the contract transaction.");
  onStatus?.("pending", submitted.hash);
  const result = await waitForTransaction(submitted.hash, onStatus);
  onStatus?.("success", submitted.hash);
  return { hash: submitted.hash, result };
}

export async function sendAndRecordPayment({ sender, destination, amount, memo, onStatus }) {
  const source = await horizon.loadAccount(sender);
  let destinationExists = true;
  try {
    await horizon.loadAccount(destination);
  } catch (error) {
    if (error?.response?.status === 404) destinationExists = false;
    else throw error;
  }

  if (!destinationExists) {
    const ledgers = await horizon.ledgers().order("desc").limit(1).call();
    const baseReserve = Number(ledgers.records[0]?.base_reserve_in_stroops || 5_000_000) / 10_000_000;
    const minimumStartingBalance = baseReserve * 2;
    if (Number(amount) < minimumStartingBalance) {
      throw new Error(`An unfunded destination needs at least ${minimumStartingBalance} XLM to be activated.`);
    }
  }

  const paymentTransaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(destinationExists
      ? Operation.payment({ destination, asset: Asset.native(), amount: String(amount) })
      : Operation.createAccount({ destination, startingBalance: String(amount) }))
    .setTimeout(60)
    .build();

  onStatus?.(
    "awaiting-payment-signature",
    "",
    destinationExists ? "Approve the XLM payment in your wallet." : "Approve the XLM transfer and destination activation.",
  );
  const { signedTxXdr: signedPaymentXdr } = await StellarWalletsKit.signTransaction(paymentTransaction.toXDR(), {
    address: sender,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  const paymentResult = await horizon.submitTransaction(
    TransactionBuilder.fromXDR(signedPaymentXdr, NETWORK_PASSPHRASE),
  );

  onStatus?.("payment-success", paymentResult.hash, "XLM transferred. Approve the contract record next.");
  const contractResult = await recordPayment({
    sender,
    destination,
    amount,
    memo,
    onStatus: (state, hash) => onStatus?.(
      state === "awaiting-signature" ? "awaiting-record-signature" : state,
      hash || paymentResult.hash,
      state === "awaiting-signature" ? "Approve the payment record contract call in your wallet." : "",
    ),
  });

  return { paymentHash: paymentResult.hash, contractHash: contractResult.hash, result: contractResult.result };
}

export async function readRecentPayments(limit = 10) {
  const source = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
  const transaction = await buildContractTransaction(source, contractClient().call("recent", nativeToScVal(limit, { type: "u32" })));
  const simulation = await rpcServer.simulateTransaction(transaction);
  if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result?.retval) return [];
  return scValToNative(simulation.result.retval).map((record) => ({ ...record, id: Number(record.id), amount: Number(record.amount) / 10_000_000, ledger: Number(record.ledger), sender: String(record.sender), destination: String(record.destination), memo: String(record.memo) })).reverse();
}

export async function fetchPaymentEvents() {
  if (!isContractConfigured()) return [];
  const latest = await rpcServer.getLatestLedger();
  const paymentTopic = xdr.ScVal.scvSymbol("payment").toXDR("base64");
  const result = await rpcServer.getEvents({ startLedger: Math.max(1, latest.sequence - 2000), filters: [{ type: "contract", contractIds: [CONTRACT_ID], topics: [[paymentTopic, "*"]] }], limit: 20 });
  return result.events.map((event) => ({ id: event.id, ledger: event.ledger, txHash: event.txHash, value: scValToNative(event.value) })).reverse();
}

export function shorten(value, front = 6, back = 6) {
  if (!value) return "";
  return value.length <= front + back ? value : `${value.slice(0, front)}…${value.slice(-back)}`;
}
