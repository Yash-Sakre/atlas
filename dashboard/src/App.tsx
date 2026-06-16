import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout';
import Overview from './views/Overview';
import AssetList from './views/AssetList';
import RoutesView from './views/RoutesView';
import TreeView from './views/TreeView';

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
              eyebrow="Catalog"
              subtitle="Reusable UI components discovered by AST analysis"
              placeholder="Search components by name, path, prop…"
            />
          }
        />
        <Route
          path="hooks"
          element={
            <AssetList
              collection="hooks"
              title="Hooks"
              eyebrow="Catalog"
              subtitle="Custom React hooks and their signatures"
              placeholder="Search hooks by name, path…"
            />
          }
        />
        <Route
          path="utils"
          element={
            <AssetList
              collection="utils"
              title="Utils"
              eyebrow="Catalog"
              subtitle="Utility functions, validators, formatters and constants"
              placeholder="Search utilities by name, path…"
            />
          }
        />
        <Route
          path="contexts"
          element={
            <AssetList
              collection="contexts"
              title="Contexts"
              eyebrow="Catalog"
              subtitle="Contexts, providers and stores managing shared state"
              placeholder="Search contexts/stores by name, path…"
            />
          }
        />
        <Route path="routes" element={<RoutesView />} />
        <Route path="tree" element={<TreeView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
