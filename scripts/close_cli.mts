import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Asks scripts/fill_cli.mts to close its browser window.
 *
 * Creates the empty close signal file that fill_cli.mts polls. A second
 * command cannot close the window directly: the window belongs to the
 * fill_cli.mts process, and this one is a separate process.
 *
 * Usage: node scripts/close_cli.mts [--signal <path>]
 *   --signal <path>  close signal file (default: tmp/close-request)
 */

const root = path.resolve(import.meta.dirname, '..');
const index = process.argv.indexOf('--signal');
const signalPath = path.resolve(root, index === -1 ? 'tmp/close-request' : process.argv[index + 1]);

mkdirSync(path.dirname(signalPath), { recursive: true });
writeFileSync(signalPath, '');
console.log('CLOSE_REQUESTED');
