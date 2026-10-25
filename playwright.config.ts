import { defineConfig, devices } from '@playwright/test';

// Hit-target checks against the production build (npm run build first).
// Each project keeps WebGL on so the hero globe canvas is rendered.
const sizes = [
  { name: '390', viewport: { width: 390, height: 844 }, mobile: true },
  { name: '1280', viewport: { width: 1280, height: 800 }, mobile: false },
];
const engines = [
  { name: 'chromium', device: devices['Desktop Chrome'] },
  { name: 'firefox', device: devices['Desktop Firefox'] },
  { name: 'webkit', device: devices['Desktop Safari'] },
];

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4317' },
  webServer: {
    command: 'npx vite preview --port 4317 --strictPort',
    url: 'http://localhost:4317',
    reuseExistingServer: false,
  },
  projects: engines.flatMap((e) =>
    sizes.map((s) => ({
      name: `${e.name}-${s.name}`,
      use: {
        ...e.device,
        viewport: s.viewport,
        hasTouch: s.mobile,
        // Firefox has no isMobile emulation.
        isMobile: s.mobile && e.name !== 'firefox',
      },
    })),
  ),
});
