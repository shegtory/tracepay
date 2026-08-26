import { shorten } from "../lib/stellar";

export default function StatusBar({
  address,
  onConnect,
  onDisconnect,
  connecting,
  freighterMissing,
}) {
  const isLinked = Boolean(address);

  return (
    <header className="status-bar">
      <div className="status-bar__brand">
        <span className={`ping-dot ${isLinked ? "ping-dot--live" : ""}`} />
        <div>
          <h1>TracePay</h1>
          <p>Testnet XLM transmission console</p>
        </div>
      </div>

      <div className="status-bar__right">
        <span className="badge">TESTNET</span>

        {freighterMissing ? (
          <a
            className="btn btn--ghost"
            href="https://www.freighter.app/"
            target="_blank"
            rel="noreferrer"
          >
            Install Freighter
          </a>
        ) : isLinked ? (
          <div className="wallet-chip">
            <span className="wallet-chip__addr">{shorten(address)}</span>
            <button className="btn btn--ghost btn--sm" onClick={onDisconnect}>
              Disconnect
            </button>
          </div>
        ) : (
          <button className="btn btn--primary" onClick={onConnect} disabled={connecting}>
            {connecting ? "Linking…" : "Connect Wallet"}
          </button>
        )}
      </div>
    </header>
  );
}
