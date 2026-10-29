import type { Page } from '@playwright/test';

/** Profile values by key (firstName, email...). Read locally, never printed. */
export type Profile = Record<string, string>;

/** Field label as shown on the form -> profile key. */
export type FieldMapping = Record<string, string>;

/** Result for one field: only the label and a status, never the value. */
export type FieldStatus = { label: string; status: 'OK' | 'UNKNOWN' };

/** Result of a submit attempt, checked on the page rather than assumed. */
export type SubmitStatus = 'SUBMITTED' | 'NOT SUBMITTED';

/**
 * True when the form is a local file. Submitting is only allowed there:
 * on a real site, sending an application cannot be undone.
 */
export function isLocalForm(url: string): boolean {
  return url.startsWith('file://');
}

/**
 * Fills every field of the form whose label is known in the mapping.
 *
 * Never clicks the submit button (see submitForm). Waits delayMs after each
 * filled field, so that a demo shows the fields filled one by one.
 * Returns one status per label, without any profile value, so the output can
 * be shown to an agent (Claude or Copilot) without leaking personal data.
 */
export async function fillForm(
  page: Page,
  profile: Profile,
  mapping: FieldMapping,
  delayMs = 0,
): Promise<FieldStatus[]> {
  const labels = await page.locator('form label').allTextContents();
  const results: FieldStatus[] = [];

  for (const rawLabel of labels) {
    const label = rawLabel.trim();
    const key = mapping[label];
    if (!key || !(key in profile)) {
      results.push({ label, status: 'UNKNOWN' });
      continue;
    }

    const field = page.getByLabel(label, { exact: true });
    const tagName = await field.evaluate((element) => element.tagName.toLowerCase());
    if (tagName === 'select') {
      await field.selectOption(profile[key]);
    } else {
      await field.fill(profile[key]);
    }
    results.push({ label, status: 'OK' });
    if (delayMs > 0) {
      await page.waitForTimeout(delayMs);
    }
  }

  return results;
}

/**
 * Clicks the form's submit button, then checks that the confirmation text
 * appears. Refuses to run on a page that is not a local file.
 */
export async function submitForm(page: Page, confirmationText: string): Promise<SubmitStatus> {
  if (!isLocalForm(page.url())) {
    throw new Error('Submit refused: only a local file form may be submitted');
  }
  await page.locator('form [type="submit"]').click();
  const confirmation = page.getByText(confirmationText);
  try {
    await confirmation.waitFor({ state: 'visible', timeout: 3000 });
    return 'SUBMITTED';
  } catch {
    return 'NOT SUBMITTED';
  }
}
