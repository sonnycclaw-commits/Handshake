import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: './openapi/handshake.v1.yaml',
  output: './sdk/typescript/generated',
  client: '@hey-api/client-fetch',
})
