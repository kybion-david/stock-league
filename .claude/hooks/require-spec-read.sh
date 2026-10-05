#!/usr/bin/env bash
# PreToolUse hook: block Edit/Write/MultiEdit until docs/SPEC.md has been read.
# Reads the hook payload from stdin (JSON with tool_name, transcript_path, etc.)
#
# Uses jq to match an actual Read tool_use event in the transcript, not a
# substring grep — plain-text mentions of the path (CLAUDE.md content, deny
# messages, reasoning) must NOT count as having read the spec.

set -euo pipefail

SPEC_RELATIVE="docs/SPEC.md"

# Read the JSON payload from stdin
payload="$(cat)"

# Extract transcript path from the payload
transcript_path="$(echo "$payload" | jq -r '.transcript_path // empty' 2>/dev/null || true)"

# Fail open: if we can't find the transcript, allow the operation
if [ -z "$transcript_path" ] || [ ! -f "$transcript_path" ]; then
  exit 0
fi

# Fail open: if SPEC.md doesn't exist yet, don't block (avoids bricking the repo)
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
if [ ! -f "$repo_root/$SPEC_RELATIVE" ]; then
  exit 0
fi

# Check for an actual Read tool_use event whose file_path ends in docs/SPEC.md.
# Transcript lines are JSONL; each assistant message nests tool calls under
# .message.content[].  We scan for a Read with the spec path.
if jq -e '
  .message.content[]? |
  select(.type == "tool_use" and .name == "Read" and
         (.input.file_path | test("docs/SPEC\\.md$")))
' "$transcript_path" >/dev/null 2>&1; then
  exit 0
fi

# Spec has not been read — block the operation
echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"You must read docs/SPEC.md before editing files (spec-driven workflow). Run: Read docs/SPEC.md"}}'
exit 0
