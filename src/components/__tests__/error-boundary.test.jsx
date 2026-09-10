import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppErrorBoundary from '../AppErrorBoundary'

function BrokenPanel() {
  throw new Error('wallet adapter failed')
}

describe('AppErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks())

  async function renderIntoDom(element) {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => root.render(element))
    return { container, root }
  }

  it('renders children during normal operation', async () => {
    const { container, root } = await renderIntoDom(
      <AppErrorBoundary><p>TracePay ready</p></AppErrorBoundary>,
    )

    expect(container).toHaveTextContent('TracePay ready')
    await act(async () => root.unmount())
  })

  it('replaces a fatal render failure with a recovery screen', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { container, root } = await renderIntoDom(
      <AppErrorBoundary><BrokenPanel /></AppErrorBoundary>,
    )

    expect(container.querySelector('[role="alert"]')).toHaveTextContent('TracePay could not start')
    expect(container).toHaveTextContent('wallet adapter failed')
    expect(container.querySelector('button')).toHaveTextContent('Reload TracePay')
    await act(async () => root.unmount())
  })
})
