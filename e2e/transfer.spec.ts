import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { createSignalingServer } from '../apps/signaling-server/src/server';

let signaling: ReturnType<typeof createSignalingServer> | undefined;
test.beforeEach(async () => {
  signaling = createSignalingServer({ port: 8099 });
  await new Promise<void>((resolve, reject) => {
    signaling!.wss.once('listening', resolve);
    signaling!.wss.once('error', reject);
  });
});
test.afterEach(async () => {
  if (signaling) await signaling.close();
  signaling = undefined;
});

async function connect(a: Page, b: Page) {
  await Promise.all([a.goto('/'), b.goto('/')]);
  await a.getByRole('button', { name: 'Create session' }).last().click();
  const code = a.locator('.share-code strong');
  await expect(code).toHaveText(/^[A-HJ-NP-Z2-9]{8}$/);
  await b.getByRole('button', { name: 'Join session' }).click();
  await b.getByLabel('Enter session code').fill((await code.textContent())!);
  await b.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(
    a.getByRole('status').filter({ hasText: /^Peer connected$/ }),
  ).toBeVisible();
  await expect(
    b.getByRole('status').filter({ hasText: /^Peer connected$/ }),
  ).toBeVisible();
}

async function verifyDownload(a: Page, b: Page, input: Buffer) {
  for (const page of [a, b]) {
    await expect(
      page.getByRole('status').filter({ hasText: 'Transfer complete' }),
    ).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
  }
  const download = b.waitForEvent('download');
  await b.getByRole('link', { name: 'Download file' }).click();
  const result = await download;
  expect(result.suggestedFilename()).toBe('synthetic.bin');
  expect(await readFile((await result.path())!)).toEqual(input);
}

for (const stopSignaling of [false, true]) {
  test(
    stopSignaling
      ? 'active transfer survives real signaling shutdown'
      : 'consent and exact bytes over real WebRTC',
    async ({ browser }) => {
      const contextA = await browser.newContext();
      const contextB = await browser.newContext();
      let releaseRead: (() => void) | undefined;
      try {
        const a = await contextA.newPage();
        const b = await contextB.newPage();
        // Observe real DataChannel.send; no transport is mocked.
        await a.addInitScript(() => {
          const original = RTCDataChannel.prototype.send;
          Object.defineProperty(window, 'payloadSends', {
            value: 0,
            writable: true,
          });
          RTCDataChannel.prototype.send = function (
            data: string | Blob | ArrayBuffer | ArrayBufferView,
          ) {
            if (typeof data !== 'string')
              Reflect.set(
                window,
                'payloadSends',
                Reflect.get(window, 'payloadSends') + 1,
              );
            Reflect.apply(original, this, [data]);
          };
        });
        let readPaused = false;
        if (stopSignaling) {
          await a.exposeBinding('pauseFileRead', () => {
            readPaused = true;
            return new Promise<void>((resolve) => {
              releaseRead = resolve;
            });
          });
          await a.addInitScript(() => {
            const original = Blob.prototype.arrayBuffer;
            let reads = 0;
            Blob.prototype.arrayBuffer = async function () {
              // Gate disk I/O after four real chunks so shutdown cannot race completion.
              if (++reads === 5) await Reflect.get(window, 'pauseFileRead')();
              return original.call(this);
            };
          });
        }
        await connect(a, b);
        const input = Buffer.from(
          Uint8Array.from({ length: 2 * 1024 * 1024 }, (_, i) => i % 251),
        );
        await a
          .getByLabel('Choose file', { exact: true })
          .setInputFiles({
            name: 'synthetic.bin',
            mimeType: 'application/octet-stream',
            buffer: input,
          });
        const incoming = b.getByRole('region', { name: 'Incoming file' });
        await expect(incoming).toContainText('synthetic.bin');
        await expect(incoming).toContainText('2.0 MiB');
        await expect(
          incoming.getByRole('button', { name: 'Reject' }),
        ).toBeVisible();
        await expect(a.getByRole('progressbar')).toHaveAttribute(
          'aria-valuenow',
          '0',
        );
        expect(
          await a.evaluate(() => Reflect.get(window, 'payloadSends')),
        ).toBe(0);
        await incoming
          .getByRole('button', { name: 'Accept', exact: true })
          .click();
        if (stopSignaling) {
          await expect.poll(() => readPaused).toBe(true);
          await expect(a.getByRole('progressbar')).toHaveAttribute(
            'aria-valuenow',
            '13',
          );
          await signaling!.close();
          signaling = undefined;
          for (const page of [a, b])
            await expect(
              page
                .getByRole('status')
                .filter({
                  hasText: 'Your established P2P connection continues.',
                }),
            ).toBeVisible();
          releaseRead!();
        }
        await verifyDownload(a, b, input);
      } finally {
        releaseRead?.();
        await Promise.all([contextA.close(), contextB.close()]);
      }
    },
  );
}
