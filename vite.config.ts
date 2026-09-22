import { defineConfig } from 'vitest/config';
export default defineConfig({
  server: { port: 5173 },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: [
        'src/domain/**/*.ts',
        'src/services/**/*.ts',
        'src/ui/player.ts',
        'src/ui/pose.ts',
      ],
      exclude: ['src/domain/types.ts'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 85 },
    },
  },
});
