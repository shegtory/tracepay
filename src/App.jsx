import { useCallback, useEffect, useRef, useState } from "react";
import { CONTRACT_ID, fetchPaymentEvents, fetchXlmBalance, isContractConfigured, readRecentPayments, sendAndRecordPayment, shorten } from "./lib/stellar";
import { connectWallet, disconnectWallet, initWalletKit, openWalletProfile } from "./lib/wallet";
import "./App.css";

const EMPTY_FORM = { destination: "", amount: "", memo: "" };
const ADDRESS_RE = /^G[A-Z2-7]{55}$/;
function explainError(error) {
  const message = String(error?.message || error || "Something went wrong.");
  return /insufficient|underfunded|balance/i.test(message) ? "Insufficient XLM balance for this transaction." : message;
}

export default function App() {
  const [address, setAddress] = useState(null);
  const [balance, setBalance] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState({ state: "idle", hash: "", message: "" });
  const [records, setRecords] = useState([]);
  const [eventCount, setEventCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const sessionBaselineId = useRef(null);
  const sessionBaselineEvents = useRef(null);

  const refreshActivity = useCallback(async () => {
    if (!isContractConfigured()) return;
    try {
      const [nextRecords, nextEvents] = await Promise.all([readRecentPayments(10), fetchPaymentEvents()]);
      if (sessionBaselineId.current === null) {
        sessionBaselineId.current = nextRecords.reduce((latest, record) => Math.max(latest, record.id), 0);
        sessionBaselineEvents.current = new Set(nextEvents.map((event) => event.id));
        setRecords([]);
        setEventCount(0);
        return;
      }
      const sessionRecords = nextRecords.filter((record) => record.id > sessionBaselineId.current);
      setRecords(sessionRecords);
      setEventCount(nextEvents.filter((event) => !sessionBaselineEvents.current.has(event.id)).length);
    } catch (error) {
      setStatus((current) => current.state === "idle" ? { state: "error", hash: "", message: explainError(error) } : current);
    }
  }, []);

  useEffect(() => initWalletKit(({ address: next }) => setAddress(next)), []);
  useEffect(() => { if (!address) return setBalance(null); fetchXlmBalance(address).then(setBalance).catch((error) => setStatus({ state: "error", hash: "", message: explainError(error) })); }, [address]);
  useEffect(() => { refreshActivity(); const timer = setInterval(refreshActivity, 6000); return () => clearInterval(timer); }, [refreshActivity]);

  async function handleConnect() {
    setBusy(true); setStatus({ state: "idle", hash: "", message: "" });
    try { setAddress(await connectWallet()); } catch (error) { setStatus({ state: "error", hash: "", message: explainError(error) }); } finally { setBusy(false); }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!address) return setStatus({ state: "error", hash: "", message: "Connect a wallet first." });
    if (!ADDRESS_RE.test(form.destination.trim())) return setStatus({ state: "error", hash: "", message: "Enter a valid Stellar destination address." });
    if (!form.amount || Number(form.amount) <= 0) return setStatus({ state: "error", hash: "", message: "Amount must be greater than zero." });
    if (balance === null || Number(balance) < Number(form.amount)) return setStatus({ state: "error", hash: "", message: "Insufficient XLM balance for this transaction." });
    setBusy(true);
    try {
      const result = await sendAndRecordPayment({ sender: address, destination: form.destination.trim(), amount: form.amount, memo: form.memo.trim(), onStatus: (state, hash = "", message = "") => setStatus({ state, hash, message }) });
      setStatus({ state: "success", hash: result.contractHash, message: "XLM transferred and payment recorded on Testnet." }); setForm(EMPTY_FORM); setBalance(await fetchXlmBalance(address)); await refreshActivity();
    } catch (error) {
      setStatus((current) => ({ state: "error", hash: current.hash, message: explainError(error) }));
      fetchXlmBalance(address).then(setBalance).catch(() => {});
    } finally { setBusy(false); }
  }

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="signal-mark">T</span><div><h1>TracePay</h1><p>Payment tracker · Yellow Belt</p></div></div><div className="wallet-area"><span className="network-pill">TESTNET</span>{address ? <><button className="wallet-chip" onClick={openWalletProfile}>{shorten(address)}</button><button className="button ghost" onClick={disconnectWallet}>Disconnect</button></> : <button className="button primary" onClick={handleConnect} disabled={busy}>Choose wallet</button>}</div></header>
    <main>
      <section className="hero-panel"><div><span className="eyebrow">ON-CHAIN PAYMENT LOG</span><h2>Record proof.<br />Watch it land.</h2><p>Connect with Freighter, xBull, Albedo, Rabet and more. Every entry is written to Soroban and synchronized from contract events.</p></div><div className="metric"><span>Balance</span><strong>{address ? (balance === null ? "—" : Number(balance).toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 7 })) : "—"}</strong><small>XLM</small></div></section>
      {!isContractConfigured() && <div className="notice"><strong>Deployment pending</strong><span>Set <code>VITE_CONTRACT_ID</code> after deploying the contract to Testnet.</span></div>}
      {status.state !== "idle" && <div className={`tx-status ${status.state}`}><span className="status-dot" /><div><strong>{status.state.replace("-", " ")}</strong><p>{status.message || (status.state === "pending" ? "Waiting for ledger confirmation…" : "Approve the contract call in your wallet.")}</p>{status.hash && <a href={`https://stellar.expert/explorer/testnet/tx/${status.hash}`} target="_blank" rel="noreferrer">{shorten(status.hash, 10, 10)} ↗</a>}</div></div>}
      <div className="workspace-grid">
        <form className="card composer" onSubmit={handleSubmit}><div className="card-heading"><div><span className="eyebrow">NEW ENTRY</span><h3>Send &amp; record a payment</h3></div><span className="step">01</span></div><label>Destination<input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="G…" disabled={busy} /></label><div className="form-row"><label>Amount (XLM)<input type="number" min="0" step="0.0000001" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" disabled={busy} /></label><label>Memo<input maxLength="64" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="Invoice #42" disabled={busy} /></label></div><button className="button primary submit" disabled={busy || !address || !isContractConfigured()}>{busy ? "Processing…" : "Send XLM & record"}<span>→</span></button><p className="form-note">This action transfers XLM first, then writes an authenticated payment record to Soroban.</p></form>
        <section className="card live-feed"><div className="card-heading"><div><span className="eyebrow live">LIVE EVENTS</span><h3>Network activity</h3></div><button className="icon-button" onClick={refreshActivity}>↻</button></div><div className="feed-list">{records.length ? records.map((record) => <article className="feed-item" key={record.id}><span className="event-icon">↗</span><div><strong>{record.amount} XLM</strong><p>{shorten(record.sender)} → {shorten(record.destination)}</p><small>{record.memo || "No memo"} · Ledger {record.ledger}</small></div><span className="event-id">#{record.id}</span></article>) : <div className="empty-feed"><span>◌</span><p>No contract records yet.</p><small>New events appear here automatically.</small></div>}</div><footer><span><i className="pulse" />Syncing every 6s</span><span>{eventCount} events indexed</span></footer></section>
      </div>
      <section className="contract-strip"><div><span className="eyebrow">CONTRACT</span><strong>{CONTRACT_ID ? shorten(CONTRACT_ID, 12, 12) : "Not deployed yet"}</strong></div>{CONTRACT_ID && <a href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`} target="_blank" rel="noreferrer">View on Explorer ↗</a>}</section>
    </main>
  </div>;
}
