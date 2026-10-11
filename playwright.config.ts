import { defineConfig, devices } from '@playwright/test'

const isCI = Boolean(process.env.CI)
// REAL_AI=1 runs the browser tests against the real model through server/.env. By default a
// stand-in model answers and no key is needed.
const realAi = Boolean(process.env.REAL_AI)

// Ports: dev API 3001, e2e API 3101, stand-in model 3199, preview 4173. The e2e API and the
// stand-in never reuse a running server, so a developer's API (which holds the real key) cannot
// be reached by a browser test by accident.
export default defineConfig({
  testDir: './e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? 'github' : 'list',
  grepInvert: realAi ? /@fake-only/ : undefined,
  use: {
    baseURL: 'http://localhost:4173',
    // Every run is recorded; the pr-demo skill turns a recording into the PR's demo GIF.
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    ...(realAi
      ? []
      : [
          {
            command: 'npm --prefix server run fake-gemini',
            url: 'http://127.0.0.1:3199/__count',
            reuseExistingServer: false,
          },
        ]),
    {
      command: 'npm --prefix server run start',
      url: 'http://127.0.0.1:3101/api/health',
      reuseExistingServer: false,
      env: {
        PORT: '3101',
        ...(realAi
          ? {}
          : { GEMINI_API_KEY: 'ci-fake-key', GEMINI_BASE_URL: 'http://127.0.0.1:3199' }),
      },
    },
    {
      command: 'npm run build && npm run preview -- --port 4173 --strictPort',
      url: 'http://localhost:4173',
      // Never reuse a preview server: one started earlier may proxy to a developer's API.
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: 'http://127.0.0.1:3101' },
    },
  ],
})
