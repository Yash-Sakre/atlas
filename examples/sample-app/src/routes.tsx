import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth-bits';
import { LoginScreen } from './login-screen';
import { ProductList } from './ProductList';

// Code-split screens — resolved through dynamic imports, never statically.
const SettingsPanel = lazy(() => import('./settings-panel'));
const Checkout = lazy(() => import('./checkout-flow').then((m) => ({ default: m.CheckoutFlow })));

/**
 * AppRoutes — top-level react-router configuration wrapped in AuthProvider.
 */
export function AppRoutes() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<p>Loading…</p>}>
          <Routes>
            <Route path="/" element={<ProductList products={[]} />} />
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/settings" element={<SettingsPanel theme="light" />} />
            <Route path="/checkout" element={<Checkout cartTotal={0} />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
