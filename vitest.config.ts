import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    isolate: true,
    server: {
      deps: {
        external: ['firebase-admin', /@google-cloud/, /@grpc/, /google-gax/, /proto-loader/],
      },
    },
  },
})