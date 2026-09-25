import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { IconContext } from '@phosphor-icons/react';
import './styles.css';
import { DataProvider } from './data';
import { ThemeProvider } from './theme';
import { TooltipProvider } from '@/components/ui/tooltip';
import App from './App';

// Every Phosphor icon defaults to the duotone weight: a solid stroke over a
// 20% `currentColor` fill, so icons pick up whatever ink their parent sets.
const ICONS = { weight: 'duotone', size: 16, mirrored: false } as const;

// HashRouter keeps routing working from any host path, sub-directory, or the
// CLI's local server without needing server-side rewrites.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <IconContext.Provider value={ICONS}>
        <TooltipProvider>
          <HashRouter>
            <DataProvider>
              <App />
            </DataProvider>
          </HashRouter>
        </TooltipProvider>
      </IconContext.Provider>
    </ThemeProvider>
  </StrictMode>,
);
