import { createApp } from './app'

const port = Number(process.env.PORT ?? 3001)

// Loopback only: this server proxies AI calls and must not be reachable from the network.
createApp().listen(port, '127.0.0.1', () => {
  console.log(`server listening on http://127.0.0.1:${String(port)}`)
})
