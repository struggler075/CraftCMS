#!/bin/bash
# ==============================================================================
#  CraftCMS — Обновление до новой версии
#  Idempotent · timed-out · service-safe (always restarts on exit)
# ==============================================================================
#
# Usage:
#   sudo bash update.sh [--skip-bridge] [--verbose]
# ==============================================================================

[ -z "$BASH_VERSION" ] && exec bash "$0" "$@"
set -Eeuo pipefail

# ── Flags ─────────────────────────────────────────────────────────────────────
SKIP_BRIDGE=0
VERBOSE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-bridge) SKIP_BRIDGE=1; shift ;;
    --verbose|-v)  VERBOSE=1;     shift ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

# ── Colors ────────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'
  YELLOW='\033[1;33m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
else
  GREEN=''; RED=''; CYAN=''; YELLOW=''; BOLD=''; DIM=''; NC=''
fi

# ── Paths ─────────────────────────────────────────────────────────────────────
INSTALL_DIR="/opt/craftcms"
SRC_DIR="/opt/craftcms-src-update"
LOG_FILE="/var/log/craftcms-update-$(date +%Y%m%d-%H%M%S).log"
GITHUB_REPO="struggler075/CraftCMS"
M2_HOME="/opt/maven"
export PATH="$M2_HOME/bin:$PATH"

# ── Logging ───────────────────────────────────────────────────────────────────
: > "$LOG_FILE"
chmod 600 "$LOG_FILE"
log_file() { local ts; ts=$(date '+%Y-%m-%d %H:%M:%S'); printf '[%s] %s\n' "$ts" "$*" >> "$LOG_FILE"; }
ok()    { echo -e "  ${GREEN}✓${NC}  $*"; log_file "OK   $*"; }
err()   { echo -e "${RED}${BOLD}  ОШИБКА: $*${NC}"; log_file "ERR  $*"; echo -e "${DIM}  Полный лог: ${LOG_FILE}${NC}"; exit 1; }
step()  { echo -e "\n${BOLD}${CYAN}━━━ $* ${NC}"; log_file "STEP $*"; }
info()  { echo -e "  ${DIM}→${NC}  $*"; log_file "INFO $*"; }
warn()  { echo -e "  ${YELLOW}!${NC}  $*"; log_file "WARN $*"; }

# ── Service safety net ────────────────────────────────────────────────────────
# Whatever happens, leave craftcms running. The only window where the service
# is intentionally down is between "systemctl stop" and "systemctl start";
# any error in between must NOT leave the user with a dead site.
SERVICE_WAS_STOPPED=0
restart_service_on_exit() {
  local code=$?
  if [[ $SERVICE_WAS_STOPPED -eq 1 ]]; then
    if ! systemctl is-active --quiet craftcms; then
      warn "Возвращаем craftcms в работу после прерывания..."
      systemctl start craftcms >>"$LOG_FILE" 2>&1 || true
    fi
  fi
  if [[ $code -ne 0 ]]; then
    echo ""
    echo -e "${RED}${BOLD}  Обновление прервано (код $code).${NC}"
    echo -e "${DIM}  Лог:    ${LOG_FILE}${NC}"
    echo -e "${DIM}  Статус: systemctl status craftcms${NC}"
  fi
}
trap restart_service_on_exit EXIT
trap 'log_file "ERROR line=${LINENO} cmd=${BASH_COMMAND}"' ERR

# ── Run a command in foreground, mirror to log ────────────────────────────────
run_logged() {
  local title="$1" timeout_s="$2"; shift 2
  log_file "RUN  (${timeout_s}s) ${title} :: $*"
  if [[ $VERBOSE -eq 1 ]]; then
    timeout --foreground --kill-after=10s "${timeout_s}s" "$@" 2>&1 | tee -a "$LOG_FILE"
    return ${PIPESTATUS[0]}
  else
    info "$title"
    if ! timeout --foreground --kill-after=10s "${timeout_s}s" "$@" >>"$LOG_FILE" 2>&1; then
      return $?
    fi
  fi
}
run_logged_sh() {
  local title="$1" timeout_s="$2" cmd="$3"
  log_file "SH   (${timeout_s}s) ${title} :: ${cmd}"
  if [[ $VERBOSE -eq 1 ]]; then
    timeout --foreground --kill-after=10s "${timeout_s}s" bash -c "$cmd" 2>&1 | tee -a "$LOG_FILE"
    return ${PIPESTATUS[0]}
  else
    info "$title"
    if ! timeout --foreground --kill-after=10s "${timeout_s}s" bash -c "$cmd" >>"$LOG_FILE" 2>&1; then
      return $?
    fi
  fi
}

# ──────────────────────────────────────────────────────────────────────────────
clear
echo -e "${BOLD}${CYAN}  CraftCMS — Обновление${NC}"
echo -e "  ${DIM}──────────────────────────────${NC}"
echo -e "  ${DIM}Лог: ${LOG_FILE}${NC}"
echo ""

[[ $EUID -ne 0 ]] && err "Запусти от root: sudo bash update.sh"
[[ ! -d "$INSTALL_DIR" ]] && err "CraftCMS не найдена в ${INSTALL_DIR}. Сначала: sudo bash install.sh"
[[ ! -x "$M2_HOME/bin/mvn" ]] && err "Maven не найден в ${M2_HOME}. Перезапусти install.sh"

# Sanity: java present
if ! command -v java >/dev/null; then err "java не найдена в PATH. Перезапусти install.sh"; fi
JAVA_HOME_PATH=$(dirname "$(dirname "$(readlink -f "$(which java)")")")
log_file "JAVA_HOME=${JAVA_HOME_PATH}"

# ── Token ─────────────────────────────────────────────────────────────────────
echo -ne "  ${BOLD}Токен GitHub:${NC}  "
read -rs GITHUB_TOKEN; echo ""
GITHUB_TOKEN="${GITHUB_TOKEN//[[:space:]]/}"
[[ -z "$GITHUB_TOKEN" ]] && err "Токен не может быть пустым"

# Verify token
HTTP=$(curl -fsS --max-time 20 -o /dev/null -w '%{http_code}' \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  "https://api.github.com/repos/${GITHUB_REPO}" 2>>"$LOG_FILE" || echo "000")
case "$HTTP" in
  200) ok "Токен валиден" ;;
  401|403) err "Токен неверный или истёк" ;;
  404) err "Репозиторий не найден" ;;
  000) err "Не удалось подключиться к GitHub" ;;
  *) err "GitHub вернул HTTP $HTTP" ;;
esac

# ── Download ──────────────────────────────────────────────────────────────────
step "Скачивание новой версии"
rm -rf "$SRC_DIR"
run_logged_sh "git clone..." 180 "
  GIT_TERMINAL_PROMPT=0 git clone --depth=1 --quiet --no-tags \
    'https://oauth2:${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git' '$SRC_DIR'
" || err "Не удалось скачать репозиторий"
GITHUB_TOKEN=""; unset GITHUB_TOKEN
ok "Репозиторий склонирован"

[[ ! -f "$SRC_DIR/backend/pom.xml"     ]] && err "В репо нет backend/pom.xml"
[[ ! -f "$SRC_DIR/frontend/package.json" ]] && err "В репо нет frontend/package.json"

# ── Build backend ─────────────────────────────────────────────────────────────
step "Сборка Backend"
cd "$SRC_DIR/backend"
run_logged_sh "mvn package (5-10 мин)..." 900 "
  JAVA_HOME='$JAVA_HOME_PATH' '$M2_HOME/bin/mvn' \
    -B -ntp -T 1C clean package -DskipTests
" || {
  echo ""
  echo -e "  ${RED}Последние 25 строк Maven:${NC}"
  tail -25 "$LOG_FILE" | sed 's/^/    /'
  err "Сборка backend упала"
}
# Resolve to an ABSOLUTE path — later we'll `cd /` and the relative path
# `target/...` will no longer exist (caused the "cannot stat" copy failure).
NEW_JAR=$(ls "$SRC_DIR/backend/target/craftcms-backend-"*.jar 2>/dev/null | head -1)
[[ -z "$NEW_JAR" ]] && err "JAR не найден после сборки"
ok "Backend собран ($(du -h "$NEW_JAR" | awk '{print $1}'))"
cd /

# ── Build BridgePlugin (optional) ─────────────────────────────────────────────
BRIDGE_NEW_JAR=""
if [[ $SKIP_BRIDGE -eq 1 ]]; then
  warn "BridgePlugin пропущен (--skip-bridge)"
elif [[ -f "$SRC_DIR/BridgePlugin/pom.xml" ]]; then
  step "Сборка BridgePlugin (опционально, макс 5 мин)"
  cd "$SRC_DIR/BridgePlugin"
  if run_logged_sh "mvn package..." 300 "
    JAVA_HOME='$JAVA_HOME_PATH' '$M2_HOME/bin/mvn' \
      -B -ntp clean package -DskipTests
  "; then
    # Absolute path — same reason as above (we'll cd / before copying).
    # Filter out maven-shade's "original-*.jar" — we need the shaded one.
    BRIDGE_NEW_JAR=$(ls "$SRC_DIR/BridgePlugin/target/"*.jar 2>/dev/null | grep -v 'original' | head -1)
    if [[ -n "$BRIDGE_NEW_JAR" ]]; then
      ok "BridgePlugin собран ($(du -h "$BRIDGE_NEW_JAR" | awk '{print $1}'))"
    else
      warn "Сборка завершилась, но shaded JAR не найден — пропускаем"
      BRIDGE_NEW_JAR=""
    fi
  else
    warn "BridgePlugin не собрался — пропускаем (сайт работает без него)"
  fi
  cd /
fi

# ── Build frontend ────────────────────────────────────────────────────────────
step "Сборка Frontend"
cd "$SRC_DIR/frontend"
export NPM_CONFIG_UNSAFE_PERM=true

if [[ -d node_modules ]]; then rm -rf node_modules; fi

run_logged "npm install..." 600 npm install --no-audit --no-fund || err "npm install упал"
[[ ! -x node_modules/.bin/tsc  ]] && err "tsc отсутствует в node_modules после install"
[[ ! -x node_modules/.bin/vite ]] && err "vite отсутствует в node_modules после install"

run_logged "TypeScript..." 300 ./node_modules/.bin/tsc            || err "tsc упал"
run_logged "vite build..."  300 ./node_modules/.bin/vite build    || err "vite build упал"

[[ ! -f dist/index.html ]] && err "dist/index.html не создан после build"
ok "Frontend собран ($(du -sh dist | awk '{print $1}'))"
# Remember the absolute dist/ path before we cd away from it.
FRONTEND_DIST="$SRC_DIR/frontend/dist"
cd /

# ── Idempotent migrations ─────────────────────────────────────────────────────
#  Anything that must be in place BEFORE the new jar boots — directories,
#  permissions, DB constraints. Each step here is safe to re-run.
step "Миграции (директории, схема БД)"

# 1. site-settings snapshots dir. SiteSettingsBackupService writes here every
#    hour and before every admin save. Created on fresh installs by install.sh,
#    but old prod boxes don't have it yet.
if [[ ! -d "$INSTALL_DIR/backups/site-settings" ]]; then
  mkdir -p "$INSTALL_DIR/backups/site-settings"
  chown -R craftcms:craftcms "$INSTALL_DIR/backups"
  ok "Создана папка снапшотов настроек: $INSTALL_DIR/backups/site-settings"
else
  # Always normalise ownership — past installs may have left it as root.
  chown -R craftcms:craftcms "$INSTALL_DIR/backups" 2>/dev/null || true
  info "Папка снапшотов уже есть"
fi

# 2. site_settings CHECK(id = 1). Hibernate's `ddl-auto: update` does NOT
#    add CHECK constraints to existing tables, so we apply it once manually.
#    The IF NOT EXISTS guard makes this safe to run on every update.sh.
#    If the constraint can't be added because real data violates it (extra
#    rows with id != 1 — which would be the very bug we're fixing), we
#    surface a loud warning and let the operator decide.
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^craftcms-postgres$'; then
  PG_DDL=$(docker exec -i craftcms-postgres psql -U craftcms craftcms -tAc \
    "SELECT 1 FROM pg_constraint WHERE conname='site_settings_singleton_chk'" 2>>"$LOG_FILE" || true)
  if [[ "$PG_DDL" == "1" ]]; then
    info "CHECK constraint site_settings_singleton_chk уже существует"
  else
    # Check first that current data is compliant — easier to read this
    # diagnostic in the log than a raw "violates check" error from ALTER.
    BAD_ROWS=$(docker exec -i craftcms-postgres psql -U craftcms craftcms -tAc \
      "SELECT COUNT(*) FROM site_settings WHERE id <> 1" 2>>"$LOG_FILE" || echo "?")
    if [[ "$BAD_ROWS" != "0" ]]; then
      warn "В site_settings есть ${BAD_ROWS} строк с id<>1 — CHECK не добавляется (нужна ручная очистка)"
      log_file "Skipping CHECK constraint: ${BAD_ROWS} rows with id<>1"
    else
      if docker exec -i craftcms-postgres psql -U craftcms craftcms \
        -c "ALTER TABLE site_settings ADD CONSTRAINT site_settings_singleton_chk CHECK (id = 1);" \
        >>"$LOG_FILE" 2>&1; then
        ok "CHECK constraint site_settings_singleton_chk добавлен"
      else
        warn "Не удалось добавить CHECK constraint — смотри лог"
      fi
    fi
  fi
else
  warn "Контейнер craftcms-postgres не найден — миграции БД пропущены"
fi

# ──────────────────────────────────────────────────────────────────────────────
#  PUBLISH — atomic-ish swap with rollback on service failure
# ──────────────────────────────────────────────────────────────────────────────
step "Установка новой версии"

# Snapshot the live files so we can roll back if the new jar refuses to start.
BACKUP_DIR=$(mktemp -d -t craftcms-backup-XXXXXX)
log_file "Backup dir: ${BACKUP_DIR}"
cp "$INSTALL_DIR/craftcms.jar" "$BACKUP_DIR/craftcms.jar" 2>/dev/null || true
[[ -f "$INSTALL_DIR/BridgePlugin.jar" ]] && cp "$INSTALL_DIR/BridgePlugin.jar" "$BACKUP_DIR/BridgePlugin.jar"
# Frontend backup omitted — it's static files, easy to re-deploy on demand.

systemctl stop craftcms >>"$LOG_FILE" 2>&1 || true
SERVICE_WAS_STOPPED=1
ok "craftcms остановлен"

# Swap backend
cp "$NEW_JAR" "$INSTALL_DIR/craftcms.jar"
chown craftcms:craftcms "$INSTALL_DIR/craftcms.jar"
ok "Backend заменён"

# Swap BridgePlugin (only if we have a new one)
if [[ -n "$BRIDGE_NEW_JAR" ]]; then
  cp "$BRIDGE_NEW_JAR" "$INSTALL_DIR/BridgePlugin.jar"
  chown craftcms:craftcms "$INSTALL_DIR/BridgePlugin.jar"
  ok "BridgePlugin.jar заменён"
fi

# Swap frontend (use the absolute path we stashed earlier — we're in / now)
rm -rf "$INSTALL_DIR/frontend/"*
cp -r "$FRONTEND_DIST/"* "$INSTALL_DIR/frontend/"
chown -R craftcms:craftcms "$INSTALL_DIR/frontend"
ok "Frontend заменён"

# ── Restart and verify ────────────────────────────────────────────────────────
step "Перезапуск"
systemctl start craftcms >>"$LOG_FILE" 2>&1 || err "Не удалось запустить craftcms"
SERVICE_WAS_STOPPED=0   # restart handled, EXIT trap won't double-start

systemctl reload nginx 2>>"$LOG_FILE" || true

# Wait up to 90s for /api/health
info "Ждём готовности Java сервера..."
HEALTH_OK=0
for i in $(seq 1 30); do
  if curl -fsS --max-time 3 "http://127.0.0.1:8080/api/health" >/dev/null 2>&1; then
    HEALTH_OK=1; break
  fi
  if ! systemctl is-active --quiet craftcms; then break; fi
  sleep 3
done

if [[ $HEALTH_OK -eq 1 ]]; then
  ok "Сервис здоров — /api/health отвечает"
else
  # Rollback
  warn "Новая версия не отвечает — откатываемся к предыдущей"
  systemctl stop craftcms >>"$LOG_FILE" 2>&1 || true
  if [[ -f "$BACKUP_DIR/craftcms.jar" ]]; then
    cp "$BACKUP_DIR/craftcms.jar" "$INSTALL_DIR/craftcms.jar"
    chown craftcms:craftcms "$INSTALL_DIR/craftcms.jar"
  fi
  if [[ -f "$BACKUP_DIR/BridgePlugin.jar" ]]; then
    cp "$BACKUP_DIR/BridgePlugin.jar" "$INSTALL_DIR/BridgePlugin.jar"
    chown craftcms:craftcms "$INSTALL_DIR/BridgePlugin.jar"
  fi
  systemctl start craftcms >>"$LOG_FILE" 2>&1 || true
  err "Откат выполнен. Проверь: journalctl -u craftcms -n 100 --no-pager"
fi

# Cleanup
rm -rf "$SRC_DIR" "$BACKUP_DIR"

echo ""
echo -e "${GREEN}${BOLD}  ✓ CraftCMS обновлена!${NC}"
[[ -z "$BRIDGE_NEW_JAR" && $SKIP_BRIDGE -eq 0 ]] && \
  echo -e "  ${YELLOW}BridgePlugin не собрался — сайт работает без него${NC}"
info "Логи сервиса:    journalctl -u craftcms -f"
info "Лог обновления:  ${LOG_FILE}"
echo ""
