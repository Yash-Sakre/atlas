import React, { useState } from 'react';
import { Button } from './widgets';
import { Badge } from './fancy-inputs';
import Avatar from './stuff';
import { useInfiniteScroll } from './stuff';
import { useCartStore } from './cart-state';
import { formatCurrency, groupBy } from './misc-helpers';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  thumb: string;
}

/**
 * ProductList — renders products grouped by category, with an
 * "add to cart" action and infinite scrolling.
 */
export function ProductList({ products }: { products: Product[] }) {
  const [page, setPage] = useState(1);
  const addItem = useCartStore((s) => s.addItem);
  const sentinelRef = useInfiniteScroll(() => setPage((p) => p + 1), true);

  const grouped = groupBy(products, (p) => p.category);

  return (
    <div>
      {Object.entries(grouped).map(([category, items]) => (
        <section key={category}>
          <Badge label={category} tone="info" />
          {items.map((p) => (
            <div key={p.id}>
              <Avatar src={p.thumb} alt={p.name} size={32} />
              <span>{p.name}</span>
              <span>{formatCurrency(p.price)}</span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => addItem({ id: p.id, name: p.name, price: p.price, qty: 1 })}
              >
                Add to cart
              </Button>
            </div>
          ))}
        </section>
      ))}
      <div ref={sentinelRef} data-page={page} />
    </div>
  );
}
