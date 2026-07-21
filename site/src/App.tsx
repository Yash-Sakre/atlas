import { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Nav from './components/Nav';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import DocsLayout from './docs/DocsLayout';
import GettingStarted from './docs/pages/GettingStarted';
import Installation from './docs/pages/Installation';
import Configuration from './docs/pages/Configuration';
import CommandPage from './docs/pages/CommandPage';
import DashboardViews from './docs/pages/DashboardViews';
import Outputs from './docs/pages/Outputs';
import GlobalOptions from './docs/pages/GlobalOptions';

/**
 * Reset scroll on navigation, and honor `#anchor` jumps within a page.
 * The anchor lookup is deferred a frame so it also works on a cold load,
 * when the target heading hasn't mounted yet.
 */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const jump = () => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
      jump();
      const t = setTimeout(jump, 60);
      return () => clearTimeout(t);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollManager />
      <Nav />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/docs" element={<DocsLayout />}>
          <Route index element={<Navigate to="/docs/getting-started" replace />} />
          <Route path="getting-started" element={<GettingStarted />} />
          <Route path="installation" element={<Installation />} />
          <Route path="configuration" element={<Configuration />} />
          <Route path="cli/:command" element={<CommandPage />} />
          <Route path="dashboard" element={<DashboardViews />} />
          <Route path="outputs" element={<Outputs />} />
          <Route path="options" element={<GlobalOptions />} />
          <Route path="*" element={<Navigate to="/docs/getting-started" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </>
  );
}
