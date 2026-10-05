#!/usr/bin/env bash
# PreToolUse hook: block Edit/Write/MultiEdit/NotebookEdit on files in the
# repo's main checkout. All work happens in a linked git worktree (AGENTS.md
# "Session workflow"), so the main checkout stays clean on `main`.
#
# A file is in the main checkout when its git dir equals the common git dir;
# in a linked worktree the git dir is .git/worktrees/<name> instead.
# Fails open on anything unexpected, and for files outside any git repo.

set -uo pipefail

payload="$(cat)"
file_path="$(echo "$payload" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' 2>/dev/null || true)"
[ -z "$file_path" ] && exit 0

# Walk up to the nearest existing directory (new files may be in new dirs)
dir="$(dirname "$file_path")"
while [ ! -d "$dir" ] && [ "$dir" != "/" ]; do
  dir="$(dirname "$dir")"
done

git_dir="$(git -C "$dir" rev-parse --absolute-git-dir 2>/dev/null)" || exit 0
common_dir="$(git -C "$dir" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || exit 0

if [ "$git_dir" != "$common_dir" ]; then
  exit 0  # linked worktree
fi

# Only guard this project's repo, not other repos the agent happens to touch
project_common="$(git -C "${CLAUDE_PROJECT_DIR:-.}" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || exit 0
[ "$common_dir" != "$project_common" ] && exit 0

top="$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null || echo .)"
reason="Don't edit files in the main checkout ($top). Every task gets its own git worktree (AGENTS.md, Session workflow): from the main checkout run 'git fetch origin && git worktree add ../$(basename "$top")-<slug> -b <type>/<slug> origin/main', then work inside that directory."
jq -n --arg r "$reason" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
exit 0
