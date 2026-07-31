import React from 'react';

export interface CheckoutFlowProps {
  cartTotal: number;
}

/**
 * CheckoutFlow — named export pulled in through
 * `lazy(() => import('./checkout-flow').then((m) => ({ default: m.CheckoutFlow })))`,
 * the other common code-splitting shape.
 */
export function CheckoutFlow({ cartTotal }: CheckoutFlowProps) {
  return (
    <section className="checkout-flow">
      <h2>Checkout</h2>
      <p>Total due: ${cartTotal.toFixed(2)}</p>
    </section>
  );
}
