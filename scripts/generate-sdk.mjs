import { spawnSync } from 'node:child_process'

const cmd = [
  'npx',
  '@hey-api/openapi-ts',
  '-i', './openapi/handshake.v1.yaml',
  '-o', './sdk/typescript/generated',
  '-c', '@hey-api/client-fetch',
]

const res = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit' })
if (res.status !== 0) {
  process.exit(res.status ?? 1)
}
