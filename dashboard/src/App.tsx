import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout';
import Overview from './views/Overview';
import AssetList from './views/AssetList';
import RoutesView from './views/RoutesView';
import Assets from './views/Assets';
import DeadCode from './views/DeadCode';
import Dependencies from './views/Dependencies';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route
          path="components"
          element={
            <AssetList
              collection="components"
              title="Components"
              subtitle="Reusable UI components discovered by AST analysis"
              placeholder="Search components…"
            />
          }
        />
        <Route
          path="hooks"
          element={
            <AssetList
              collection="hooks"
              title="Hooks"
              subtitle="Custom React hooks and their signatures"
              placeholder="Search hooks…"
            />
          }
        />
        <Route
          path="utils"
          element={
            <AssetList
              collection="utils"
              title="Utils"
              subtitle="Utility functions, formatters and constants"
              placeholder="Search utils…"
            />
          }
        />
        <Route
          path="contexts"
          element={
            <AssetList
              collection="contexts"
              title="Contexts"
              subtitle="Contexts, providers and stores managing shared state"
              placeholder="Search contexts…"
            />
          }
        />
        <Route path="routes" element={<RoutesView />} />
        <Route path="assets" element={<Assets />} />
        <Route path="dependencies" element={<Dependencies />} />
        <Route path="dead-code" element={<DeadCode />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
