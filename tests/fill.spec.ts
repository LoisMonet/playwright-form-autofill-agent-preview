import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fillForm, submitForm, type FieldMapping, type Profile } from '../scripts/fill.mts';

const root = path.resolve(__dirname, '..');
const formUrl = 'file://' + path.join(root, 'forms', 'application_form.html');
const CONFIRMATION_TEXT = 'Application submitted';

function readJson<T>(...parts: string[]): T {
  return JSON.parse(readFileSync(path.join(root, ...parts), 'utf8')) as T;
}

const profile = readJson<Profile>('data', 'fake_profile.json');
const mapping = readJson<FieldMapping>('data', 'field_mapping.json');

test('fills every known field from the profile without submitting', async ({ page }) => {
  await page.goto(formUrl);

  const statuses = await fillForm(page, profile, mapping);
  for (const { status, label } of statuses) {
    console.log(`${status} ${label}`);
  }

  expect(statuses.filter((s) => s.status === 'UNKNOWN')).toEqual([]);
  for (const { label } of statuses) {
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(profile[mapping[label]]);
  }
  await expect(page.getByText(CONFIRMATION_TEXT)).toBeHidden();
});

test('reports an unknown label and leaves its field empty', async ({ page }) => {
  await page.goto(formUrl);
  const { City: _removed, ...mappingWithoutCity } = mapping;

  const statuses = await fillForm(page, profile, mappingWithoutCity);

  expect(statuses).toContainEqual({ label: 'City', status: 'UNKNOWN' });
  await expect(page.getByLabel('City', { exact: true })).toHaveValue('');
  await expect(page.getByText(CONFIRMATION_TEXT)).toBeHidden();
});

test('submits the local form and checks the confirmation', async ({ page }) => {
  await page.goto(formUrl);
  await fillForm(page, profile, mapping);

  expect(await submitForm(page, CONFIRMATION_TEXT)).toBe('SUBMITTED');
});

test('refuses to submit a page that is not a local file', async ({ page }) => {
  await page.goto('about:blank');

  await expect(submitForm(page, CONFIRMATION_TEXT)).rejects.toThrow('Submit refused');
});
