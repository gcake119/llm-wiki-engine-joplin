#!/bin/sh
set -eu

label="${HWE_AUTOMATION_LABEL:-com.hermes.wiki-automate}"
target_user="${HWE_AUTOMATION_USER:-hermes}"
hour="${HWE_AUTOMATION_HOUR:-3}"
minute="${HWE_AUTOMATION_MINUTE:-30}"
load_job="${HWE_AUTOMATION_LOAD:-1}"

if [ "$(id -u)" -ne 0 ]; then
  printf 'Run this installer with sudo because it writes /Library/LaunchDaemons.\n' >&2
  exit 1
fi

case "$label" in
  ''|*[!A-Za-z0-9._-]*)
    printf 'HWE_AUTOMATION_LABEL must use only letters, numbers, dots, underscores, and hyphens.\n' >&2
    exit 1
    ;;
esac

case "$hour" in
  ''|*[!0-9]*)
    printf 'HWE_AUTOMATION_HOUR must be an integer from 0 to 23.\n' >&2
    exit 1
    ;;
esac

case "$minute" in
  ''|*[!0-9]*)
    printf 'HWE_AUTOMATION_MINUTE must be an integer from 0 to 59.\n' >&2
    exit 1
    ;;
esac

if [ "$hour" -lt 0 ] || [ "$hour" -gt 23 ]; then
  printf 'HWE_AUTOMATION_HOUR must be an integer from 0 to 23.\n' >&2
  exit 1
fi

if [ "$minute" -lt 0 ] || [ "$minute" -gt 59 ]; then
  printf 'HWE_AUTOMATION_MINUTE must be an integer from 0 to 59.\n' >&2
  exit 1
fi

if ! id "$target_user" >/dev/null 2>&1; then
  printf 'User not found: %s\n' "$target_user" >&2
  exit 1
fi

target_home="/Users/$target_user"
detected_home="$(dscl . -read "/Users/$target_user" NFSHomeDirectory 2>/dev/null | awk '{print $2}' || true)"
if [ -n "$detected_home" ]; then
  target_home="$detected_home"
fi

default_wrapper_path="/Users/$target_user/bin/wiki-automate-once"
wrapper_path="$target_home/bin/wiki-automate-once"
log_dir="$target_home/logs"
out_log="$log_dir/wiki-automate.out.log"
err_log="$log_dir/wiki-automate.err.log"
plist_path="/Library/LaunchDaemons/$label.plist"

xml_escape() {
  printf '%s' "$1" | sed \
    -e 's/&/\&amp;/g' \
    -e 's/</\&lt;/g' \
    -e 's/>/\&gt;/g' \
    -e 's/"/\&quot;/g'
}

label_xml="$(xml_escape "$label")"
target_user_xml="$(xml_escape "$target_user")"
wrapper_path_xml="$(xml_escape "$wrapper_path")"
out_log_xml="$(xml_escape "$out_log")"
err_log_xml="$(xml_escape "$err_log")"

install -d -m 755 "$target_home/bin" "$log_dir"
chown "$target_user":staff "$target_home/bin" "$log_dir"

cat > "$wrapper_path" <<EOF
#!/bin/zsh
export PATH=$target_home/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
source $target_home/.config/hermes-knowledge/env
$target_home/.local/bin/wiki automate once
EOF

chmod 755 "$wrapper_path"
chown "$target_user":staff "$wrapper_path"

cat > "$plist_path" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>$label_xml</string>
    <key>UserName</key>
    <string>$target_user_xml</string>
    <key>ProgramArguments</key>
    <array>
      <string>$wrapper_path_xml</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
      <key>Hour</key>
      <integer>$hour</integer>
      <key>Minute</key>
      <integer>$minute</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>$out_log_xml</string>
    <key>StandardErrorPath</key>
    <string>$err_log_xml</string>
  </dict>
</plist>
EOF

chown root:wheel "$plist_path"
chmod 644 "$plist_path"
plutil -lint "$plist_path"

if [ "$load_job" = "1" ]; then
  launchctl bootout "system/$label" >/dev/null 2>&1 || true
  launchctl bootstrap system "$plist_path"
fi

printf 'Installed wrapper: %s\n' "$wrapper_path"
printf 'Default wrapper path: %s\n' "$default_wrapper_path"
printf 'Installed LaunchDaemon: %s\n' "$plist_path"
printf 'Check launchd: sudo launchctl print system/%s\n' "$label"
printf 'Run now: sudo launchctl kickstart -k system/%s\n' "$label"
printf "Check wiki status: sudo -iu %s zsh -lc 'source \"\$HOME/.config/hermes-knowledge/env\" && \"\$HOME/.local/bin/wiki\" automate status'\n" "$target_user"
