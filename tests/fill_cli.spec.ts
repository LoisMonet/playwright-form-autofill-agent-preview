import { test, expect } from '@playwright/test';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

// These tests run the agent's command (scripts/fill_cli.mts) as a separate
// process, the way Claude or Copilot runs it. The command always uses Chromium,
// so the tests run once, in the chromium project only.

const root = path.resolve(__dirname, '..');
const cli = path.join('scripts', 'fill_cli.mts');
const closeCli = path.join('scripts', 'close_cli.mts');
const run = promisify(execFile);

const profile = JSON.parse(readFileSync(path.join(root, 'data', 'fake_profile.json'), 'utf8')) as Record<
  string,
  string
>;

test.skip(({ browserName }) => browserName !== 'chromium', 'The command always uses Chromium');

function expectNoProfileValue(output: string): void {
  for (const value of Object.values(profile)) {
    expect(output).not.toContain(value);
  }
}

test('fills, submits the local form and never prints a profile value', async () => {
  const { stdout } = await run('node', [cli, '--headless', '--submit'], { cwd: root });

  const lines = stdout.trim().split('\n');
  expect(lines.filter((line) => line.startsWith('OK '))).toHaveLength(9);
  expect(lines).not.toContainEqual(expect.stringMatching(/^UNKNOWN /));
  expect(lines).toContain('SUBMITTED');
  expect(lines.at(-1)).toBe('CLOSED');
  expectNoProfileValue(stdout);
});

test('refuses to submit a form that is not a local file, before opening a browser', async () => {
  const result = await run('node', [cli, '--headless', '--submit', '--form', 'https://example.com/apply'], {
    cwd: root,
  }).catch((error: { code: number; stdout: string }) => error);

  expect('code' in result ? result.code : 0).toBe(2);
  expect(result.stdout).toContain('REFUSED submit');
  expect(result.stdout).not.toContain('OK ');
});

test('keeps the window open until the close signal, then closes it', async () => {
  const signal = path.join('tmp', `close-request-${test.info().testId}`);
  const child = spawn('node', [cli, '--headless', '--wait-close', '--signal', signal], { cwd: root });
  let stdout = '';
  const waiting = new Promise<void>((resolve) => {
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stdout.includes('WAITING_CLOSE')) {
        resolve();
      }
    });
  });
  const exited = new Promise<number | null>((resolve) => child.on('exit', resolve));

  await waiting;
  expect(stdout).not.toContain('CLOSED');

  execFileSync('node', [closeCli, '--signal', signal], { cwd: root });

  expect(await exited).toBe(0);
  expect(stdout.trim().split('\n').at(-1)).toBe('CLOSED');
});
