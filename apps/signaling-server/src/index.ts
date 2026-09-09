import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { createSignalingServer } from './server';
import { WAITING_TTL_MS, ABSOLUTE_TTL_MS } from './sessions';

config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});
const env = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(8080),
    HOST: z.string().default('127.0.0.1'),
    WAITING_TTL_MS: z.coerce
      .number()
      .int()
      .positive()
      .safe()
      .default(WAITING_TTL_MS),
    ABSOLUTE_TTL_MS: z.coerce
      .number()
      .int()
      .positive()
      .safe()
      .default(ABSOLUTE_TTL_MS),
    ALLOWED_ORIGINS: z
      .string()
      .default('http://localhost:5173,http://127.0.0.1:5173'),
  })
  .parse(process.env);
const server = createSignalingServer({
  port: env.PORT,
  host: env.HOST,
  ttlMs: env.WAITING_TTL_MS,
  absoluteTtlMs: env.ABSOLUTE_TTL_MS,
  origins: env.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
});
server.wss.on('listening', () =>
  process.stdout.write(
    `PeerBeam signaling listening on ${env.HOST}:${env.PORT}\n`,
  ),
);
server.wss.on('error', (error) => {
  process.stderr.write(`Signaling server: ${error.message}\n`);
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void server.close();
  });
