import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

const ROOT_SELECTOR = '[data-jc-lookbook]';
const roots = new Map();

function readConfig(element) {
  const script = element.querySelector('script[type="application/json"][data-jc-lookbook-config]');
  if (!script) return null;
  try {
    return JSON.parse(script.textContent);
  } catch (error) {
    console.error('[jc-lookbook] invalid section config', error);
    return null;
  }
}

function mount(element) {
  if (roots.has(element)) return;
  const config = readConfig(element);
  if (!config) return;

  const target = element.querySelector('[data-jc-lookbook-app]') || element;
  const root = createRoot(target);
  roots.set(element, root);
  root.render(
    <StrictMode>
      <App config={config} />
    </StrictMode>
  );
}

function unmount(element) {
  const root = roots.get(element);
  if (!root) return;
  root.unmount();
  roots.delete(element);
}

function mountAll(scope = document) {
  scope.querySelectorAll(ROOT_SELECTOR).forEach(mount);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountAll(), { once: true });
} else {
  mountAll();
}

// Theme editor: sections are swapped in and out of the DOM without a reload.
document.addEventListener('shopify:section:load', (event) => mountAll(event.target));
document.addEventListener('shopify:section:unload', (event) => {
  event.target.querySelectorAll(ROOT_SELECTOR).forEach(unmount);
});
