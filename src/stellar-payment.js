/** @fileoverview Inline import for Asset.native() so the static import style
 *  is preserved at the call site in sendAndRecordPayment without an
 *  extraneous dynamic import expression. */
import { Asset as AssetModule } from '@stellar/stellar-sdk'

export async function sendAndRecordPayment({ sender, destination, amount, memo, onStatus }) {
  const source = await horizon.loadAccount(sender)
  let destinationExists = true
  try {
    await horizon.loadAccount(destination)
  } catch (error) {
    if (error?.response?.status === 404) destinationExists = false
    else throw error
  }

  if (!destinationExists) {
    const ledgers = await horizon.ledgers().order('desc').limit(1).call()
    const baseReserve = Number(ledgers.records[0]?.base_reserve_in_stroops || 5_000_000) / 10_000_000
    const minimumStartingBalance = baseReserve * 2
    if (Number(amount) < minimumStartingBalance) {
      throw new Error(`An unfunded destination needs at least ${minimumStartingBalance} XLM to be activated.`)
    }
  }

  const paymentTransaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(destinationExists
      ? Operation.payment({ destination, asset: AssetModule.native(), amount: String(amount) })
      : Operation.createAccount({ destination, startingBalance: String(amount) })
    )
    .setTimeout(60)
    .build()

  onStatus?.('awaiting-payment-signature', '', destinationExists
    ? 'Approve the XLM payment in your wallet.'
    : 'Approve the XLM transfer and destination activation.')

  const { signedTxXdr: signedPaymentXdr } = await StellarWalletsKit.signTransaction(paymentTransaction.toXDR(), {
    address: sender,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
  const paymentResult = await horizon.submitTransaction(
    TransactionBuilder.fromXDR(signedPaymentXdr, NETWORK_PASSPHRASE),
  )

  onStatus?.('payment-success', paymentResult.hash, 'XLM transferred. Approve the contract record next.')

  const contractResult = await recordPayment({
    sender,
    destination,
    amount,
    memo,
    onStatus: (state, hash) => onStatus?.(
      state === 'awaiting-signature' ? 'awaiting-record-signature' : state,
      hash || paymentResult.hash,
      state === 'awaiting-signature' ? 'Approve the payment record contract call in your wallet.' : '',
    ),
  })

  return { paymentHash: paymentResult.hash, contractHash: contractResult.hash, result: contractResult.result }
}
