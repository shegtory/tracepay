import { shorten } from "../lib/stellar";

/**
 * Event-backed activity panel.
 *
 * Renders four explicit states:
 * - loading: first synchronization in flight
 * - error: last synchronization failed (manual resync offered)
 * - empty: synchronization succeeded but no session records yet
 * - ready: synchronized contract records with ledger metadata
 *
 * All records come from the deployed contract's `payment` events, never
 * from local form state, so the panel stays truthful to the chain.
 */
export default function ActivityPanel({ records, eventCount, syncState, onResync }) {
  return (
    <section className="card live-feed">
      <div className="card-heading">
        <div>
          <span className="eyebrow live">LIVE EVENTS</span>
          <h3>Network activity</h3>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onResync}
          disabled={syncState === "loading"}
          aria-label="Resynchronize activity from the Testnet contract"
          title="Resynchronize from Testnet"
        >
          {syncState === "loading" ? "…" : "↻"}
        </button>
      </div>

      <div className="feed-list" aria-live="polite">
        {syncState === "loading" && (
          <div className="empty-feed" data-state="loading">
            <span className="feed-spinner" aria-hidden="true" />
            <p>Synchronizing with the contract…</p>
            <small>Reading recent payment events from Stellar Testnet.</small>
          </div>
        )}

        {syncState === "error" && (
          <div className="empty-feed" data-state="error" role="alert">
            <span aria-hidden="true">⚠</span>
            <p>Could not synchronize activity.</p>
            <small>The contract or RPC endpoint did not respond. Press resynchronize to retry.</small>
          </div>
        )}

        {syncState === "ready" && records.length === 0 && (
          <div className="empty-feed" data-state="empty">
            <span aria-hidden="true">◌</span>
            <p>No payments recorded in this session yet.</p>
            <small>Send a payment above; its contract event will appear here automatically.</small>
          </div>
        )}

        {syncState === "ready" &&
          records.map((record) => (
            <article className="feed-item" key={record.id}>
              <span className="event-icon">↗</span>
              <div>
                <strong>{record.amount} XLM</strong>
                <p>
                  {shorten(record.sender)} → {shorten(record.destination)}
                </p>
                <small>
                  {record.memo || "No memo"} · Ledger {record.ledger}
                </small>
              </div>
              <span className="event-id">#{record.id}</span>
            </article>
          ))}
      </div>

      <footer>
        <span>
          <i className="pulse" />
          {syncState === "error"
            ? "Last sync failed — press ↻ to retry"
            : "Syncing every 6s"}
        </span>
        <span>{eventCount} events indexed</span>
      </footer>
    </section>
  );
}
