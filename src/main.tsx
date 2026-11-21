import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { bootstrapNativeStorage } from './game/services/nativeStorage';
import { initNativeChrome } from './game/services/platform';

async function boot() {
  // Restore the durable Android mirror before React reads the save synchronously.
  await bootstrapNativeStorage();
  createRoot(document.getElementById('root')!).render(<App />);
  void initNativeChrome();
}

void boot();
