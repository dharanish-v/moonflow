# Shared by the hooks in this folder. Sourced, not run.

root=$(git rev-parse --show-toplevel)
app="$root/apps/moonflow-pwa-react"

# Reinstall the app's dependencies when package-lock.json differs between two
# commits, so pre-push never runs the gate against stale node_modules.
sync_deps() {
  old=$1
  new=$2
  [ -n "$old" ] && [ -n "$new" ] || return 0
  if [ -n "$(git diff --name-only "$old" "$new" -- apps/moonflow-pwa-react/package-lock.json)" ]; then
    echo "package-lock.json changed: running npm ci"
    (cd "$app" && npm ci --silent) || echo "npm ci failed: run it yourself in apps/moonflow-pwa-react" >&2
  fi
}
