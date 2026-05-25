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
[[ -t 1 ]] && clear
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
# When invoked from the Elixir updater agent (non-TTY), the token is passed via
# GITHUB_TOKEN_ENV to avoid interactive stdin reads that block headlessly.
if [[ -n "${GITHUB_TOKEN_ENV:-}" ]]; then
  GITHUB_TOKEN="$GITHUB_TOKEN_ENV"
  unset GITHUB_TOKEN_ENV
  ok "Токен получен из среды"
else
  echo -ne "  ${BOLD}Токен GitHub:${NC}  "
  read -rs GITHUB_TOKEN; echo ""
  GITHUB_TOKEN="${GITHUB_TOKEN//[[:space:]]/}"
  [[ -z "$GITHUB_TOKEN" ]] && err "Токен не может быть пустым"
fi

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

# 1a. Ensure app.modules.trademc exists in application.yml (for existing installs
#     that pre-date the module system). Default: true. Admins set to false to hide.
APP_YML="$INSTALL_DIR/application.yml"
if [[ -f "$APP_YML" ]]; then
  if ! grep -q 'modules:' "$APP_YML" 2>/dev/null; then
    # Insert modules block under app: section
    sed -i '/^  upload:/i\  modules:\n    trademc: true' "$APP_YML" 2>>"$LOG_FILE" \
      && ok "Добавлен блок app.modules в application.yml" \
      || warn "Не удалось добавить app.modules — добавь вручную"
  else
    info "app.modules уже есть в application.yml"
  fi
fi

# 1b-2. Ensure server.address: 0.0.0.0 is present in application.yml.
#       Without this Spring Boot may bind only to the public interface on some
#       JDK/OS combinations — localhost/127.0.0.1 become unreachable, which
#       breaks BridgePlugin and any locally-running tools.
if [[ -f "$APP_YML" ]]; then
  if ! grep -q 'address:' "$APP_YML" 2>/dev/null; then
    sed -i '/^\s*port:/a\  address: 0.0.0.0' "$APP_YML" 2>>"$LOG_FILE" \
      && ok "Добавлен server.address: 0.0.0.0 в application.yml" \
      || warn "Не удалось добавить server.address — добавь вручную"
  else
    info "server.address уже есть в application.yml"
  fi
fi

# 1b. site-settings snapshots dir. SiteSettingsBackupService writes here every
#     hour and before every admin save. Created on fresh installs by install.sh,
#     but old prod boxes don't have it yet.
if [[ ! -d "$INSTALL_DIR/backups/site-settings" ]]; then
  mkdir -p "$INSTALL_DIR/backups/site-settings"
  chown -R craftcms:craftcms "$INSTALL_DIR/backups"
  ok "Создана папка снапшотов настроек: $INSTALL_DIR/backups/site-settings"
else
  # Always normalise ownership — past installs may have left it as root.
  chown -R craftcms:craftcms "$INSTALL_DIR/backups" 2>/dev/null || true
  info "Папка снапшотов уже есть"
fi

# 2. Pre-flight schema sync. Hibernate's ddl-auto: update is unreliable —
#    it silently skips ALTER TABLE ADD COLUMN in various edge cases (locks,
#    existing data, type mismatches). For a SaaS-grade deploy we can't depend
#    on it. This block ensures every column the new JAR expects actually
#    exists BEFORE the JAR boots. All statements are idempotent (ADD COLUMN
#    IF NOT EXISTS). Add new columns here whenever you add fields to entities.
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^craftcms-postgres$'; then
  info "Pre-flight schema sync..."
  docker exec -i craftcms-postgres psql -U craftcms craftcms -v ON_ERROR_STOP=0 <<'SCHEMA' >>"$LOG_FILE" 2>&1
-- payment_settings: TradeMC fields
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS trademc_enabled  boolean DEFAULT false;
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS trademc_shop_id  varchar(255) DEFAULT '';
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS trademc_item_id  varchar(255) DEFAULT '';
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS trademc_shop_key varchar(255) DEFAULT '';

-- site_settings: version + updatedAt (optimistic locking / audit)
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS version    bigint DEFAULT 0 NOT NULL;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- users: GravitLauncher fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS uuid        char(36);
ALTER TABLE users ADD COLUMN IF NOT EXISTS accesstoken char(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS serverid    varchar(41);
ALTER TABLE users ADD COLUMN IF NOT EXISTS hwidid      bigint;

-- products: soft-delete
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted boolean DEFAULT false NOT NULL;

-- site_settings: GitHub license token
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS github_token text;

-- site_settings: drop redundant unique constraint on PK column that Hibernate
-- 6.x sometimes conflicts with on ddl-auto: update, causing row deletion.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_site_settings_singleton'
  ) THEN
    ALTER TABLE site_settings DROP CONSTRAINT uq_site_settings_singleton;
  END IF;
END $$;
SCHEMA
  ok "Схема БД синхронизирована"
fi

# 3. Drop ALL Hibernate-generated enum CHECK constraints.
#    (renumbered from 2)
#    Hibernate's @Enumerated(EnumType.STRING) bakes in a CHECK with the enum
#    values that existed when the table was FIRST CREATED. ddl-auto: update
#    NEVER refreshes them, so adding any new enum value to any entity breaks
#    every INSERT into that table until the constraint is manually dropped.
#    Java enums already validate writes — these DB-level checks are redundant
#    and a deployment hazard. Instead of listing constraints by name (which
#    breaks every time we add a new enum), we auto-detect and drop them all.
#    We preserve non-enum CHECKs like site_settings_singleton_chk by only
#    targeting constraints whose definition contains the IN('VALUE1', ...)
#    pattern that Hibernate generates for @Enumerated columns.
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^craftcms-postgres$'; then
  DROPPED=$(docker exec -i craftcms-postgres psql -U craftcms craftcms -tAc "
    SELECT string_agg(
      'ALTER TABLE ' || nsp.nspname || '.' || rel.relname ||
      ' DROP CONSTRAINT ' || con.conname || ';', E'\n'
    )
    FROM pg_constraint con
    JOIN pg_class     rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE con.contype = 'c'
      AND nsp.nspname = 'public'
      AND pg_get_constraintdef(con.oid) ~ 'ANY'
  " 2>>"$LOG_FILE" || true)

  if [[ -n "$DROPPED" && "$DROPPED" != "" ]]; then
    echo "$DROPPED" | docker exec -i craftcms-postgres psql -U craftcms craftcms >>"$LOG_FILE" 2>&1 \
      && ok "Сброшены Hibernate enum-CHECK constraints" \
      || warn "Частично не удалось сбросить CHECK constraints — смотри лог"
    log_file "Dropped constraints:\n$DROPPED"
  else
    info "Hibernate enum-CHECK constraints не найдены (или уже сброшены)"
  fi
fi

# 4. DROP site_settings_singleton_chk if it still exists on the DB.
#    The @org.hibernate.annotations.Check(constraints = "id = 1") annotation
#    was removed from SiteSettings.java because on some Hibernate 6.x builds
#    ddl-auto: update attempts to re-add the CHECK during startup, which
#    conflicts with the manually-added constraint and can cause the singleton
#    row (id=1) to be dropped — wiping all site settings on every deploy.
#    Since id is already the PRIMARY KEY this constraint is entirely redundant.
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^craftcms-postgres$'; then
  PG_DDL=$(docker exec -i craftcms-postgres psql -U craftcms craftcms -tAc \
    "SELECT 1 FROM pg_constraint WHERE conname='site_settings_singleton_chk'" 2>>"$LOG_FILE" || true)
  if [[ "$PG_DDL" == "1" ]]; then
    if docker exec -i craftcms-postgres psql -U craftcms craftcms \
      -c "ALTER TABLE site_settings DROP CONSTRAINT site_settings_singleton_chk;" \
      >>"$LOG_FILE" 2>&1; then
      ok "CHECK constraint site_settings_singleton_chk удалён (был источником сброса настроек)"
    else
      warn "Не удалось удалить site_settings_singleton_chk — смотри лог"
    fi
  else
    info "site_settings_singleton_chk не существует — ничего удалять не нужно"
  fi
else
  warn "Контейнер craftcms-postgres не найден — миграции БД пропущены"
fi

# 4. Versioned SQL migrations from migrations/*.sql. Each file is idempotent
#    (uses IF NOT EXISTS / OR REPLACE / DO-blocks), so re-running on every
#    deploy is safe and lets ops just drop new SQL files into the repo
#    without touching update.sh. Naming convention: NNN-description.sql,
#    sorted lexicographically so the order is deterministic.
if [[ -d "$SRC_DIR/migrations" ]] && \
   docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^craftcms-postgres$'; then
  MIGRATION_FILES=$(ls "$SRC_DIR/migrations/"*.sql 2>/dev/null | sort)
  if [[ -n "$MIGRATION_FILES" ]]; then
    for sql_file in $MIGRATION_FILES; do
      fname=$(basename "$sql_file")
      log_file "Applying migration: $fname"
      if docker exec -i craftcms-postgres psql -U craftcms craftcms \
           -v ON_ERROR_STOP=1 -q < "$sql_file" >>"$LOG_FILE" 2>&1; then
        ok "Миграция $fname применена"
      else
        # Pull the last few error lines so the operator sees what broke
        # without having to open the log file.
        echo ""
        echo -e "  ${RED}Последние строки из лога:${NC}"
        tail -10 "$LOG_FILE" | sed 's/^/    /'
        err "Миграция $fname упала — деплой остановлен. Полный лог: $LOG_FILE"
      fi
    done
  else
    info "Миграционных SQL-файлов нет"
  fi
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

# Snapshot site_settings BEFORE stopping the service so we can restore them
# after the JAR boots. Hibernate's @Check / @UniqueConstraint on the
# site_settings table caused the singleton row to vanish on some Hibernate 6.x
# builds — the Java fix (removed @Check) is in this commit, but the migration
# also guards against edge cases by unconditionally re-applying all user values
# once the new JAR is confirmed healthy.
SETTINGS_SNAPSHOT=""
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^craftcms-postgres$'; then
  SETTINGS_SNAPSHOT=$(docker exec -i craftcms-postgres psql -U craftcms craftcms -tAc "
    SELECT
      'UPDATE site_settings SET ' ||
      'site_name='         || quote_nullable(site_name)          || ',' ||
      'site_description='  || quote_nullable(site_description)   || ',' ||
      'logo_url='          || quote_nullable(logo_url)           || ',' ||
      'copyright_text='    || quote_nullable(copyright_text)     || ',' ||
      'disclaimer_text='   || quote_nullable(disclaimer_text)    || ',' ||
      'donate_header_image_url=' || quote_nullable(donate_header_image_url) || ',' ||
      'site_url='          || quote_nullable(site_url)           || ',' ||
      'primary_color='     || quote_nullable(primary_color)      || ',' ||
      'bg_color='          || quote_nullable(bg_color)           || ',' ||
      'hero_title='        || quote_nullable(hero_title)         || ',' ||
      'hero_subtitle='     || quote_nullable(hero_subtitle)      || ',' ||
      'footer_columns_json=' || quote_nullable(footer_columns_json) || ',' ||
      'ban_kick_message='  || quote_nullable(ban_kick_message)   || ',' ||
      'bridge_api_key='    || quote_nullable(bridge_api_key)     || ',' ||
      'bridge_allowed_ip=' || quote_nullable(bridge_allowed_ip)  || ',' ||
      'bridge_backend_url='|| quote_nullable(bridge_backend_url) || ',' ||
      'email_verification_required=' || email_verification_required::text ||
      ' WHERE id=1;'
    FROM site_settings WHERE id=1;" 2>>"$LOG_FILE" | tr -d '\r' || true)
  if [[ -n "$SETTINGS_SNAPSHOT" ]]; then
    ok "Сохранён снапшот site_settings"
    log_file "Settings snapshot SQL: $SETTINGS_SNAPSHOT"
  else
    warn "Не удалось сохранить снапшот site_settings (таблица пуста или БД недоступна)"
  fi
fi

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

# Patch index.html <title> from DB for bots (OG tags are injected by
# IndexHtmlPatcher on first settings read after service start). The inline
# <script> in index.html handles browser users via sync XHR, but bots see
# the raw file — so we at least set <title> here before the JAR boots.
INDEX_HTML="$INSTALL_DIR/frontend/index.html"
if [[ -f "$INDEX_HTML" ]] && docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^craftcms-postgres$'; then
  DB_NAME=$(docker exec -i craftcms-postgres psql -U craftcms craftcms -tAc \
    "SELECT COALESCE(site_name,'') FROM site_settings WHERE id=1;" 2>>"$LOG_FILE" | tr -d '[:space:]' || true)
  if [[ -n "$DB_NAME" ]]; then
    sed -i "s|<title>[^<]*</title>|<title>${DB_NAME}</title>|" "$INDEX_HTML" 2>>"$LOG_FILE"
    ok "index.html <title> = '${DB_NAME}'"
  fi
fi

# ── Restart and verify ────────────────────────────────────────────────────────
step "Перезапуск"
systemctl start craftcms >>"$LOG_FILE" 2>&1 || err "Не удалось запустить craftcms"
SERVICE_WAS_STOPPED=0   # restart handled, EXIT trap won't double-start

# Record the deployed commit so the admin Updates page can detect newer commits.
git -C "$SRC_DIR" rev-parse HEAD > "$INSTALL_DIR/version.txt" 2>/dev/null || true

# Ensure nginx has the /updater/ WebSocket proxy block on the correct port (idempotent).
NGINX_SITE="/etc/nginx/sites-available/craftcms"
if [[ -f "$NGINX_SITE" ]]; then
  if ! grep -q 'location /updater/' "$NGINX_SITE"; then
    # Block missing entirely — add it before /api/
    sed -i 's|location /api/ {|location /updater/ {\n        proxy_pass http://127.0.0.1:8089/;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";\n        proxy_set_header Host $host;\n        proxy_read_timeout 600s;\n    }\n\n    location /api/ {|' "$NGINX_SITE" 2>>"$LOG_FILE" \
      && ok "Nginx: добавлен блок /updater/ (агент обновлений)" \
      || warn "Не удалось добавить /updater/ в nginx — добавь вручную"
  else
    # Block exists — fix port if it points to an old value (8081, 8082, etc.)
    if ! grep -q 'proxy_pass http://127.0.0.1:8089/' "$NGINX_SITE"; then
      sed -i 's|proxy_pass http://127\.0\.0\.1:[0-9]\+/;.*# updater\|proxy_pass http://127\.0\.0\.1:808[0-9]/;|proxy_pass http://127.0.0.1:8089/;|g' "$NGINX_SITE" 2>>"$LOG_FILE" || true
      # Simpler fallback: replace any 808x port in the updater block
      sed -i '/location \/updater\//,/}/ s|proxy_pass http://127\.0\.0\.1:[0-9]\+/;|proxy_pass http://127.0.0.1:8089/;|' "$NGINX_SITE" 2>>"$LOG_FILE" \
        && ok "Nginx: обновлён порт /updater/ → 8089" \
        || warn "Не удалось обновить порт /updater/ в nginx"
    else
      info "Nginx: /updater/ уже настроен на порт 8089"
    fi
  fi
fi

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

  # Restore site_settings from pre-update snapshot. This guards against the
  # Hibernate DDL edge case where the singleton row is dropped and re-seeded
  # with defaults (siteName="CraftCMS", colors reset, etc.). Even if the Java
  # fix prevents it from happening again, the restore ensures a clean recovery
  # for the current deployment.
  if [[ -n "$SETTINGS_SNAPSHOT" ]] && \
     docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^craftcms-postgres$'; then
    CURRENT_NAME=$(docker exec -i craftcms-postgres psql -U craftcms craftcms -tAc \
      "SELECT COALESCE(site_name,'') FROM site_settings WHERE id=1;" 2>>"$LOG_FILE" | tr -d '[:space:]' || true)
    SNAPSHOT_NAME=$(echo "$SETTINGS_SNAPSHOT" | grep -oP "site_name='\K[^']+" || true)
    if [[ "$CURRENT_NAME" == "CraftCMS" && -n "$SNAPSHOT_NAME" && "$SNAPSHOT_NAME" != "CraftCMS" ]]; then
      # Row was reset to defaults — restore from snapshot
      if echo "$SETTINGS_SNAPSHOT" | docker exec -i craftcms-postgres psql -U craftcms craftcms >>"$LOG_FILE" 2>&1; then
        ok "site_settings восстановлены из снапшота (было сброшено до дефолтов)"
      else
        warn "Не удалось восстановить site_settings — проверь лог"
      fi
    else
      # Proactively apply snapshot regardless — idempotent, ensures no field was lost
      if echo "$SETTINGS_SNAPSHOT" | docker exec -i craftcms-postgres psql -U craftcms craftcms >>"$LOG_FILE" 2>&1; then
        ok "site_settings синхронизированы из снапшота"
      else
        warn "Не удалось синхронизировать site_settings — проверь лог"
      fi
    fi
  fi
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

# ── Elixir updater agent ─────────────────────────────────────────────────────
# Installs on first run; rebuilds on subsequent runs.
# If we are running INSIDE the agent (called from the WS terminal), we stage
# the new release and schedule a deferred swap so the binary isn't replaced
# under a live process. The swap happens ~20 s after this script exits.
if [[ -d "$SRC_DIR/updater" ]]; then
  step "Агент обновлений (Elixir)"

  # ── install Erlang/Elixir if missing (pre-dates this feature) ────────────
  if ! command -v elixir &>/dev/null; then
    info "Elixir не найден — устанавливаем..."
    run_logged_sh "apt install erlang elixir..." 300 \
      "DEBIAN_FRONTEND=noninteractive apt-get install -y -qq erlang elixir" \
      || { warn "Не удалось установить Elixir — агент обновлений пропускается"; }
  fi

  if ! command -v mix &>/dev/null; then
    warn "mix не найден — агент обновлений пропускается"
  else
    # Bootstrap package manager tools (non-fatal — already present on reinstalls)
    HOME=/root mix local.hex --force --quiet   >>"$LOG_FILE" 2>&1 || true
    HOME=/root mix local.rebar --force --quiet >>"$LOG_FILE" 2>&1 || true

    cd "$SRC_DIR/updater"

    # ── build ──────────────────────────────────────────────────────────────
    UPDATER_OK=0

    if run_logged_sh "mix deps.get..." 180 \
        "HOME=/root MIX_ENV=prod mix deps.get --only prod"; then

      if run_logged_sh "mix release..." 180 \
          "HOME=/root MIX_ENV=prod mix release --overwrite"; then

        if [[ -d "_build/prod/rel/updater" ]]; then
          UPDATER_OK=1
        else
          warn "mix release завершился без ошибок, но директория релиза не создана"
        fi
      else
        warn "mix release упал — агент обновлений не обновлён (смотри лог)"
      fi
    else
      warn "mix deps.get упал — агент обновлений не обновлён (смотри лог)"
    fi

    if [[ $UPDATER_OK -eq 1 ]]; then
      # ── write systemd service (idempotent) ───────────────────────────────
      if [[ ! -f /etc/systemd/system/craftcms-updater.service ]]; then
        cat > /etc/systemd/system/craftcms-updater.service << 'UPDATER_SVC'
[Unit]
Description=CraftCMS Updater — WebSocket update agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/craftcms-updater
Environment=HOME=/root
ExecStart=/opt/craftcms-updater/bin/updater start
Restart=on-failure
RestartSec=10
StandardOutput=append:/opt/craftcms/logs/craftcms-updater.log
StandardError=append:/opt/craftcms/logs/craftcms-updater.log

[Install]
WantedBy=multi-user.target
UPDATER_SVC
        systemctl daemon-reload >>"$LOG_FILE" 2>&1 || true
        systemctl enable craftcms-updater >>"$LOG_FILE" 2>&1 || true
        ok "craftcms-updater.service зарегистрирован"
      fi

      # ── swap release binary ──────────────────────────────────────────────
      if systemctl is-active --quiet craftcms-updater 2>/dev/null; then
        # Running inside the updater agent — stage the new binary.
        # ws_handler.ex schedules a graceful self-restart via systemd-run
        # ~2 s after it sends exit=0 to the browser, so the WebSocket closes
        # cleanly before the service stops. No artificial delay needed here.
        cp -r "_build/prod/rel/updater" /opt/craftcms-updater-new
        ok "Агент обновлений: новая версия готова — перезапустится после завершения"
      else
        # Stopped or first install — swap and start immediately.
        rm -rf /opt/craftcms-updater
        cp -r "_build/prod/rel/updater" /opt/craftcms-updater
        if systemctl start craftcms-updater >>"$LOG_FILE" 2>&1; then
          ok "Агент обновлений запущен (порт 8089)"
        else
          warn "craftcms-updater не запустился — journalctl -u craftcms-updater -n 30"
        fi
      fi
    fi

    cd /
  fi
fi

# Copy maintenance scripts to install dir so they're always up to date.
# IMPORTANT: use cp→mv (atomic rename) instead of plain cp so that bash's
# open file descriptor for the currently-running /opt/craftcms/update.sh
# keeps reading the OLD inode. A plain cp truncates+rewrites the same inode,
# causing bash to read the new file content mid-execution at the wrong offset.
for _s in update.sh install.sh enable-ssl.sh; do
  if [[ -f "$SRC_DIR/$_s" ]]; then
    cp "$SRC_DIR/$_s" "$INSTALL_DIR/$_s.new"
    chmod +x "$INSTALL_DIR/$_s.new"
    mv -f "$INSTALL_DIR/$_s.new" "$INSTALL_DIR/$_s"
    ok "Скрипт обновлён: $INSTALL_DIR/$_s"
  fi
done

# Cleanup
rm -rf "$SRC_DIR" "$BACKUP_DIR"

echo ""
echo -e "${GREEN}${BOLD}  ✓ CraftCMS обновлена!${NC}"
[[ -z "$BRIDGE_NEW_JAR" && $SKIP_BRIDGE -eq 0 ]] && \
  echo -e "  ${YELLOW}BridgePlugin не собрался — сайт работает без него${NC}"
info "Логи сервиса:    journalctl -u craftcms -f"
info "Лог обновления:  ${LOG_FILE}"
echo ""
