import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth-bits';
import { LoginScreen } from './login-screen';
import { ProductList } from './ProductList';

/**
 * AppRoutes — top-level react-router configuration wrapped in AuthProvider.
 */
export function AppRoutes() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProductList products={[]} />} />
          <Route path="/login" element={<LoginScreen />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
