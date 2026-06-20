#!/bin/sh
set -eu

repo="${HWE_REPO:-gcake119/llm-wiki-engine-joplin}"
ref="${HWE_REF:-main}"
archive_url="https://codeload.github.com/${repo}/tar.gz/${ref}"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need curl
need sed
need tar
need node
need pnpm

node -e 'const major = Number(process.versions.node.split(".")[0]); if (major < 20) { console.error("Node.js 20 or newer is required."); process.exit(1); }'

tmp_dir="$(mktemp -d 2>/dev/null || mktemp -d -t hermes-wiki-engine)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT INT TERM

archive_path="$tmp_dir/source.tar.gz"

echo "Installing Hermes Wiki Engine from ${repo}@${ref}..."
curl -fsSL "$archive_url" -o "$archive_path"
tar -xzf "$archive_path" -C "$tmp_dir" --strip-components=1
pnpm add -g "$tmp_dir"

config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/hermes-wiki-engine"
config_file="$config_dir/env"

prompt_env() {
  tty="/dev/tty"
  if [ ! -r "$tty" ]; then
    echo "Installed. No interactive terminal found; create env vars manually before running wiki."
    echo "Run: wiki status"
    return
  fi

  if [ -f "$config_file" ]; then
    printf "Config file exists at %s. Overwrite? [y/N] " "$config_file" >"$tty"
    IFS= read -r overwrite <"$tty"
    case "$overwrite" in
      y|Y|yes|YES) ;;
      *)
        echo "Installed. Existing config kept: $config_file"
        echo "Run: source \"$config_file\" && wiki status"
        return
        ;;
    esac
  fi

  default_state_dir="$HOME/.local/state/hermes-wiki-engine"
  default_api_url="http://127.0.0.1:41184"

  printf "\nConfigure Hermes Wiki Engine environment.\n" >"$tty"
  printf "Press Enter to accept a suggested value shown in brackets.\n\n" >"$tty"

  printf "WIKI_STATE_DIR stores local wiki cache, drafts, audit, and automation artifacts.\n" >"$tty"
  printf "Suggested: %s\n" "$default_state_dir" >"$tty"
  printf "WIKI_STATE_DIR [%s]: " "$default_state_dir" >"$tty"
  IFS= read -r state_dir <"$tty"
  state_dir="${state_dir:-$default_state_dir}"

  printf "\nWIKI_JOPLIN_API_URL is your Joplin Desktop Data API endpoint.\n" >"$tty"
  printf "Suggested: %s\n" "$default_api_url" >"$tty"
  printf "WIKI_JOPLIN_API_URL [%s]: " "$default_api_url" >"$tty"
  IFS= read -r api_url <"$tty"
  api_url="${api_url:-$default_api_url}"

  printf "\nWIKI_JOPLIN_TOKEN is from Joplin Desktop > Web Clipper > Advanced options.\n" >"$tty"
  printf "Suggested: paste your Joplin Data API token.\n" >"$tty"
  printf "WIKI_JOPLIN_TOKEN: " >"$tty"
  old_stty="$(stty -g <"$tty" 2>/dev/null || true)"
  stty -echo <"$tty" 2>/dev/null || true
  IFS= read -r token <"$tty"
  if [ -n "$old_stty" ]; then
    stty "$old_stty" <"$tty" 2>/dev/null || true
  fi
  printf "\n" >"$tty"

  mkdir -p "$config_dir"
  chmod 700 "$config_dir"

  shell_quote() {
    printf "%s" "$1" | sed "s/'/'\\\\''/g; 1s/^/'/; \$s/\$/'/"
  }

  {
    printf "export WIKI_STATE_DIR=%s\n" "$(shell_quote "$state_dir")"
    printf "export WIKI_JOPLIN_API_URL=%s\n" "$(shell_quote "$api_url")"
    printf "export WIKI_JOPLIN_TOKEN=%s\n" "$(shell_quote "$token")"
  } >"$config_file"
  chmod 600 "$config_file"

  echo "Installed. Env file written: $config_file"
  echo "Run: source \"$config_file\" && wiki status"
}

prompt_env
