import React, { Component } from 'react'

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('TracePay failed to render', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="fatal-error" role="alert">
        <div className="fatal-error__panel">
          <span className="eyebrow">RECOVERY MODE</span>
          <h1>TracePay could not start</h1>
          <p>
            The interface hit an unexpected browser error. Your wallet and funds were not
            changed. Reload the application to retry with a clean session.
          </p>
          <button type="button" className="button primary" onClick={() => window.location.reload()}>
            Reload TracePay
          </button>
          <details>
            <summary>Technical details</summary>
            <code>{String(this.state.error?.message || this.state.error)}</code>
          </details>
        </div>
      </main>
    )
  }
}
