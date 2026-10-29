import { chromium } from '@playwright/test';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fillForm, isLocalForm, submitForm, type FieldMapping, type Profile } from './fill.mts';

/**
 * Command run by the agent (Claude or Copilot) to fill the application form.
 *
 * Opens the form in a visible Chromium window, fills it from the local profile
 * and prints one "<STATUS> <label>" line per field. With --submit, clicks the
 * submit button and prints SUBMITTED or NOT SUBMITTED, checked on the page.
 * Then keeps the window open until the close signal file appears (created by
 * scripts/close_cli.mts) or the user closes the window. Never prints a profile
 * value, so the agent only sees labels and statuses.
 *
 * Usage: node scripts/fill_cli.mts [options]
 *   --delay-ms <n>     wait n milliseconds after each filled field (default 0)
 *   --submit           submit the form; refused unless the form is a local file
 *   --form <path|url>  form to fill (default: forms/application_form.html)
 *   --signal <path>    close signal file (default: tmp/close-request)
 *   --headless         no window; exits right after filling unless --wait-close
 *   --wait-close       wait for the close signal even when headless (tests)
 */

const root = path.resolve(import.meta.dirname, '..');
const CONFIRMATION_TEXT = 'Application submitted';
const POLL_MS = 500;

function readJson<T>(...parts: string[]): T {
  return JSON.parse(readFileSync(path.join(root, ...parts), 'utf8')) as T;
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function formUrl(form: string): string {
  if (/^https?:\/\//.test(form)) {
    return form;
  }
  return pathToFileURL(path.resolve(root, form)).href;
}

async function main(): Promise<void> {
  const headless = process.argv.includes('--headless');
  const submit = process.argv.includes('--submit');
  const waitClose = !headless || process.argv.includes('--wait-close');
  const delayMs = Number(argValue('--delay-ms') ?? '0');
  const url = formUrl(argValue('--form') ?? 'forms/application_form.html');
  const signalPath = path.resolve(root, argValue('--signal') ?? 'tmp/close-request');

  // Checked before opening anything: no browser, no network call.
  if (submit && !isLocalForm(url)) {
    console.log('REFUSED submit: only a local file form may be submitted');
    process.exit(2);
  }
  rmSync(signalPath, { force: true });

  const profile = readJson<Profile>('data', 'fake_profile.json');
  const mapping = readJson<FieldMapping>('data', 'field_mapping.json');

  const browser = await chromium.launch({ headless });
  const page = await browser.newPage();
  await page.goto(url);

  const statuses = await fillForm(page, profile, mapping, delayMs);
  for (const { status, label } of statuses) {
    console.log(`${status} ${label}`);
  }
  if (submit) {
    console.log(await submitForm(page, CONFIRMATION_TEXT));
  }

  if (waitClose) {
    console.log('WAITING_CLOSE run `node scripts/close_cli.mts` to close the window');
    while (!existsSync(signalPath) && !page.isClosed()) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
    rmSync(signalPath, { force: true });
  }
  await browser.close();
  console.log('CLOSED');
}

main().catch((error: unknown) => {
  // Print only the error type: a message could quote a profile value.
  console.error(`ERROR ${error instanceof Error ? error.name : 'unknown'}`);
  process.exit(1);
});
