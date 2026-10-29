// Diagnostic preToolUse hook for the Copilot harness.
//
// Node.js version of the official example "Create your first Copilot hook":
// https://code.visualstudio.com/docs/agent-customization/hooks
// Node is already required by this project, so the hook adds no dependency.
//
// Reads the event JSON on stdin, appends one line to tool-use.log (next to this
// script) with the tool name and the NAMES of its argument fields, never their
// values, then prints {} (no permission decision: the tool still goes through
// the normal approval checks).
//
// Fail-open on purpose: a command preToolUse hook that crashes makes Copilot deny
// the tool call (https://docs.github.com/en/copilot/reference/hooks-reference).
// A logging problem must never block the agent, so any error is reported on
// stderr and the hook still prints {}.

import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

const LOG_PATH = path.join(import.meta.dirname, 'tool-use.log');

/** Field names of toolArgs, which may be an object or a JSON string. */
function argumentNames(toolArgs) {
  let args = toolArgs;
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args);
    } catch {
      return ['<non-JSON string>'];
    }
  }
  if (args !== null && typeof args === 'object' && !Array.isArray(args)) {
    return Object.keys(args).sort();
  }
  return [`<${args === null ? 'null' : typeof args}>`];
}

function main() {
  const event = JSON.parse(readFileSync(0, 'utf8'));
  if (typeof event.toolName !== 'string') {
    throw new TypeError('Expected a Copilot preToolUse event with toolName.');
  }
  const entry = {
    time: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    toolName: event.toolName,
    argumentNames: argumentNames(event.toolArgs),
    eventFields: Object.keys(event).sort(),
  };
  appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n', 'utf8');
}

try {
  main();
} catch (error) {
  console.error(`log_tool_use: not logged (${error?.name ?? 'unknown'})`);
}
process.stdout.write('{}');
