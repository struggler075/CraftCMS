#!/bin/bash
# ==============================================================================
#  CraftCMS — Enterprise installer
#  Idempotent · timed-out · retried · logged · interruptible
# ==============================================================================
#
# Usage:
#   sudo bash install.sh [options]
#
# Options:
#   --skip-bridge       Не собирать Minecraft BridgePlugin (опционально)
#   --skip-ssl          Не предлагать Let's Encrypt
#   --verbose           Печатать stdout сборок в реальном времени
#   --help              Показать справку
#
# Exit codes:
#   0   успех
#   1   пользовательская ошибка (нет root / нет ОС / отмена)
#   2   сетевая ошибка
#   3   ошибка сборки
#   4   ошибка инфраструктуры (Docker, БД, systemd)
#   5   таймаут
# ==============================================================================

[ -z "$BASH_VERSION" ] && exec bash "$0" "$@"
set -Eeuo pipefail
IFS=$'\n\t'

# ── Versioning ────────────────────────────────────────────────────────────────
SCRIPT_VERSION="2.0.0"
SCRIPT_NAME="CraftCMS Installer v${SCRIPT_VERSION}"

# ── CLI flags ─────────────────────────────────────────────────────────────────
SKIP_BRIDGE=0
SKIP_SSL=0
VERBOSE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-bridge) SKIP_BRIDGE=1; shift ;;
    --skip-ssl)    SKIP_SSL=1;    shift ;;
    --verbose|-v)  VERBOSE=1;     shift ;;
    --help|-h)     sed -n '/^# Usage:/,/^# =====/p' "$0"; exit 0 ;;
    *)             echo "Unknown flag: $1 (use --help)"; exit 1 ;;
  esac
done

# ── Colors ────────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BLUE='\033[0;34m'; CYAN='\033[0;36m'; MAGENTA='\033[0;35m'
  WHITE='\033[1;37m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; MAGENTA=''; WHITE=''; BOLD=''; DIM=''; NC=''
fi

# ── Paths / globals ───────────────────────────────────────────────────────────
INSTALL_DIR="/opt/craftcms"
SRC_DIR="/opt/craftcms-src"
LOG_DIR="/var/log"
LOG_FILE="${LOG_DIR}/craftcms-install-$(date +%Y%m%d-%H%M%S).log"
LOCK_FILE="/var/lock/craftcms-install.lock"
STATE_DIR="/var/lib/craftcms-installer"
mkdir -p "$STATE_DIR" 2>/dev/null || true

BACKEND_PORT=8080
SERVICE_USER="craftcms"
GITHUB_REPO="struggler075/CraftCMS"

# Generate secrets once.
JWT_SECRET=$(head -c 48 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | cut -c1-64)

# PostgreSQL (Docker) parameters
PG_CONTAINER="craftcms-postgres"
PG_VOLUME="craftcms-pgdata"
PG_DB="craftcms"
PG_USER="craftcms"
PG_PORT=5432
PG_IMAGE="postgres:16-alpine"

# Will be populated by user input
GITHUB_TOKEN=""
POSTGRES_PASSWORD=""
SITE_DOMAIN=""
USE_SSL="n"
ADMIN_EMAIL=""

# Will be populated by environment probing
JAVA_HOME_PATH=""
MAVEN_VERSION="3.9.6"
MAVEN_DIR="/opt/maven"
M2_HOME="$MAVEN_DIR"

# Step counter (recomputed once everything is known)
TOTAL_STEPS=15
CURRENT_STEP=0

# ── Logging ───────────────────────────────────────────────────────────────────
# Everything that touches `log_file` is also mirrored to stdout if VERBOSE=1.
# Plaintext output (no ANSI codes) is what lands in the file.
exec 3>>"$LOG_FILE"
log_file() {
  local ts; ts=$(date '+%Y-%m-%d %H:%M:%S')
  printf '[%s] %s\n' "$ts" "$*" >&3
}

print_ok()   { echo -e "  ${GREEN}✓${NC}  $*"; log_file "OK   $*"; }
print_fail() { echo -e "  ${RED}✗${NC}  $*"; log_file "FAIL $*"; }
print_info() { echo -e "  ${CYAN}→${NC}  $*"; log_file "INFO $*"; }
print_warn() { echo -e "  ${YELLOW}!${NC}  $*"; log_file "WARN $*"; }
print_dim()  { echo -e "  ${DIM}$*${NC}"; log_file "DIM  $*"; }

# ── Cleanup / trap ────────────────────────────────────────────────────────────
INSTALL_FINISHED=0
cleanup() {
  local code=$?
  # Wipe in-memory secrets regardless of outcome.
  POSTGRES_PASSWORD="" GITHUB_TOKEN="" JWT_SECRET=""
  unset POSTGRES_PASSWORD GITHUB_TOKEN JWT_SECRET
  rm -f "$LOCK_FILE" 2>/dev/null || true
  if [[ $INSTALL_FINISHED -eq 0 && $code -ne 0 ]]; then
    echo "" >&2
    echo -e "${RED}${BOLD}  Установка прервана (код: $code).${NC}" >&2
    echo -e "${DIM}  Полный лог: ${LOG_FILE}${NC}" >&2
    echo -e "${DIM}  Чтобы попробовать снова — просто запусти скрипт повторно (он идемпотентен).${NC}" >&2
  fi
}
on_error() {
  local lineno=$1 cmd=$2
  log_file "ERROR line=${lineno} cmd=${cmd}"
  echo "" >&2
  echo -e "${RED}${BOLD}  Ошибка на строке ${lineno}:${NC} ${YELLOW}${cmd}${NC}" >&2
  echo -e "${DIM}  Последние 15 строк лога:${NC}" >&2
  tail -15 "$LOG_FILE" 2>/dev/null | sed 's/^/    /' >&2 || true
}
on_interrupt() {
  echo "" >&2
  echo -e "${YELLOW}${BOLD}  Прервано пользователем (Ctrl+C). Состояние частично применено.${NC}" >&2
  exit 130
}
trap 'on_error ${LINENO} "${BASH_COMMAND}"' ERR
trap on_interrupt INT TERM
trap cleanup EXIT

# ── Lock ──────────────────────────────────────────────────────────────────────
acquire_lock() {
  if [[ -e "$LOCK_FILE" ]]; then
    local pid; pid=$(cat "$LOCK_FILE" 2>/dev/null || echo 0)
    if kill -0 "$pid" 2>/dev/null; then
      echo -e "${RED}  Установщик уже запущен (PID $pid). Завершите его перед повторным запуском.${NC}" >&2
      exit 1
    fi
    rm -f "$LOCK_FILE"
  fi
  echo $$ > "$LOCK_FILE"
}

# ── Die ───────────────────────────────────────────────────────────────────────
die() {
  local code="${3:-1}"
  echo ""
  if command -v gum &>/dev/null; then
    gum style --border thick --border-foreground 196 --padding "0 2" --foreground 15 --bold "ОШИБКА: $1"
    [[ -n "${2:-}" ]] && gum style --foreground 11 --padding "0 2" "Что делать: $2"
  else
    echo -e "${RED}${BOLD}  ОШИБКА: $1${NC}"
    [[ -n "${2:-}" ]] && echo -e "${YELLOW}  Что делать: $2${NC}"
  fi
  echo ""
  echo -e "${DIM}  Полный лог: ${LOG_FILE}${NC}"
  echo ""
  log_file "DIE  ($code) $1"
  exit "$code"
}

# ── gum bootstrap ─────────────────────────────────────────────────────────────
ensure_gum() {
  if command -v gum &>/dev/null; then return 0; fi
  echo -e "${DIM}  Установка gum для красивого вывода...${NC}"
  with_retry 3 30 apt_install curl gnupg ca-certificates \
    || die "Не удалось установить базовые утилиты" "Проверь интернет и доступ к apt." 2
  mkdir -p /etc/apt/keyrings
  if ! with_retry 3 10 bash -c "curl -fsSL --max-time 30 https://repo.charm.sh/apt/gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/charm.gpg"; then
    die "Не удалось добавить ключ репозитория gum" "Проверь интернет." 2
  fi
  echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" > /etc/apt/sources.list.d/charm.list
  apt_update_quiet
  with_retry 3 10 apt_install gum || die "Не удалось установить gum" "apt-get install gum вручную." 2
}

# ── gum colors ────────────────────────────────────────────────────────────────
C_PRIMARY=99 C_OK=46 C_ERR=196 C_WARN=214 C_INFO=51 C_MUTED=243 C_TITLE=15

# ── Step header ───────────────────────────────────────────────────────────────
print_step() {
  CURRENT_STEP=$((CURRENT_STEP + 1))
  local msg="$1"
  echo ""
  log_file "STEP ${CURRENT_STEP}/${TOTAL_STEPS} ${msg}"
  if command -v gum &>/dev/null; then
    gum style --border rounded --border-foreground "$C_PRIMARY" \
      --padding "0 2" --margin "0 2" --bold \
      "[$CURRENT_STEP/$TOTAL_STEPS]  $msg"
  else
    echo -e "${BOLD}${CYAN}  [$CURRENT_STEP/$TOTAL_STEPS]  $msg${NC}"
  fi
}

# ── Generic gum wrappers ──────────────────────────────────────────────────────
ask_input() {
  local placeholder="$1" width="${2:-60}" prompt="${3:-› }"
  gum input --placeholder "$placeholder" --prompt "  $prompt" --width "$width"
}
ask_secret() {
  local placeholder="$1" width="${2:-60}" prompt="${3:-› }"
  gum input --password --placeholder "$placeholder" --prompt "  $prompt" --width "$width"
}
ask_confirm() { gum confirm "$1"; }

# ── Retry helper ──────────────────────────────────────────────────────────────
# with_retry <attempts> <delay-seconds> <cmd...>
# Exponential backoff (delay × 2 each time).
with_retry() {
  local attempts=$1 delay=$2; shift 2
  local n=1
  while true; do
    if "$@"; then return 0; fi
    if [[ $n -ge $attempts ]]; then
      log_file "RETRY exhausted after ${attempts} attempts: $*"
      return 1
    fi
    log_file "RETRY attempt ${n}/${attempts} failed, sleeping ${delay}s: $*"
    sleep "$delay"
    delay=$((delay * 2))
    n=$((n + 1))
  done
}

# ── Run with timeout + log capture (foreground / spin / verbose-aware) ────────
# run_timed <timeout-seconds> <gum-title> <cmd...>
# - In verbose mode → mirrors output to stdout via `tee`.
# - Otherwise → silenced via `gum spin`.
# - Always logs to $LOG_FILE.
run_timed() {
  local timeout_s="$1" title="$2"; shift 2
  log_file "RUN  (${timeout_s}s) ${title} :: $*"
  local tmp; tmp=$(mktemp)
  local rc=0
  if [[ $VERBOSE -eq 1 ]]; then
    echo -e "  ${CYAN}⟳${NC}  ${title}"
    if ! timeout --foreground --kill-after=10s "${timeout_s}s" "$@" 2>&1 | tee -a "$LOG_FILE"; then rc=${PIPESTATUS[0]}; fi
  else
    gum spin --spinner dot --title "$title" --show-output -- bash -c '"$@" >"'"$tmp"'" 2>&1' _ "$@" || rc=$?
    cat "$tmp" >>"$LOG_FILE" 2>/dev/null || true
  fi
  rm -f "$tmp"
  if [[ $rc -eq 124 || $rc -eq 137 ]]; then
    log_file "TIMEOUT ${title} after ${timeout_s}s"
    return 124
  fi
  return $rc
}

# Lighter helper: just print spinner around a bash command (with timeout).
# spin_run <timeout-seconds> <title> <bash command-string>
spin_run() {
  local t="$1" title="$2" cmd="$3"
  log_file "SPIN (${t}s) ${title} :: ${cmd}"
  local tmp; tmp=$(mktemp)
  local rc=0
  if [[ $VERBOSE -eq 1 ]]; then
    echo -e "  ${CYAN}⟳${NC}  ${title}"
    timeout --foreground --kill-after=10s "${t}s" bash -c "$cmd" 2>&1 | tee -a "$LOG_FILE" || rc=${PIPESTATUS[0]}
  else
    gum spin --spinner dot --title "$title" -- \
      timeout --foreground --kill-after=10s "${t}s" bash -c "$cmd >$tmp 2>&1" || rc=$?
    cat "$tmp" >>"$LOG_FILE" 2>/dev/null || true
  fi
  rm -f "$tmp"
  if [[ $rc -eq 124 || $rc -eq 137 ]]; then
    log_file "TIMEOUT ${title} after ${t}s"
    return 124
  fi
  return $rc
}

# ── apt helpers ───────────────────────────────────────────────────────────────
apt_update_quiet() {
  DEBIAN_FRONTEND=noninteractive apt-get update -qq >>"$LOG_FILE" 2>&1
}
apt_install() {
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends "$@" >>"$LOG_FILE" 2>&1
}

# ──────────────────────────────────────────────────────────────────────────────
#  EARLY CHECKS — before we touch anything
# ──────────────────────────────────────────────────────────────────────────────

[[ $EUID -ne 0 ]] && die "Скрипт нужно запускать от имени администратора (root)" "sudo bash install.sh" 1

acquire_lock

if [[ ! -f /etc/os-release ]]; then
  die "Не удаётся определить операционную систему" "Установи Ubuntu 22+ или Debian 11+" 1
fi
. /etc/os-release
OS_NAME="${PRETTY_NAME:-$ID}"
case "${ID:-}" in
  ubuntu|debian) ;;
  *) die "Операционная система '${OS_NAME}' не поддерживается" "Установи Ubuntu 22.04+ и попробуй снова." 1 ;;
esac

# Touch log file
: > "$LOG_FILE"
chmod 600 "$LOG_FILE"
log_file "============================================================"
log_file "  ${SCRIPT_NAME}"
log_file "  Started by uid=${EUID} on ${OS_NAME}"
log_file "  Flags: skip-bridge=${SKIP_BRIDGE} skip-ssl=${SKIP_SSL} verbose=${VERBOSE}"
log_file "============================================================"

ensure_gum

# ──────────────────────────────────────────────────────────────────────────────
#  BANNER
# ──────────────────────────────────────────────────────────────────────────────
clear
echo ""
gum style --foreground 213 --bold \
'  ██████╗██████╗  █████╗ ███████╗████████╗ ██████╗███╗   ███╗███████╗
 ██╔════╝██╔══██╗██╔══██╗██╔════╝╚══██╔══╝██╔════╝████╗ ████║██╔════╝
 ██║     ██████╔╝███████║█████╗     ██║   ██║     ██╔████╔██║███████╗
 ██║     ██╔══██╗██╔══██║██╔══╝     ██║   ██║     ██║╚██╔╝██║╚════██║
 ╚██████╗██║  ██║██║  ██║██║        ██║   ╚██████╗██║ ╚═╝ ██║███████║
  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝        ╚═╝    ╚═════╝╚═╝     ╚═╝╚══════╝'
echo ""
gum style --foreground "$C_TITLE" --bold "  ${SCRIPT_NAME}"
gum style --foreground "$C_MUTED"        "  Java 17 · Node 20 · PostgreSQL 16 · Nginx · systemd"
echo ""
gum style --foreground "$C_INFO" "  Лог:           ${LOG_FILE}"
gum style --foreground "$C_INFO" "  Время:         ~5–15 минут"
[[ $VERBOSE -eq 1     ]] && gum style --foreground "$C_WARN" "  Режим:         verbose (полный вывод сборок)"
[[ $SKIP_BRIDGE -eq 1 ]] && gum style --foreground "$C_WARN" "  Skip BridgePlugin: да"
[[ $SKIP_SSL -eq 1    ]] && gum style --foreground "$C_WARN" "  Skip SSL: да"
echo ""
sleep 1

# ══════════════════════════════════════════════════════════════════════════════
print_step "Проверка системы и окружения"
# ══════════════════════════════════════════════════════════════════════════════

print_ok "Права администратора"
print_ok "Операционная система: ${OS_NAME}"

# --- Интернет ---
spin_run 15 "Проверка подключения к интернету..." \
  "curl -fsS --connect-timeout 10 -o /dev/null https://github.com" \
  || die "Нет подключения к интернету" "Проверь настройки сети у хостинг-провайдера." 2
print_ok "Интернет работает"

# --- Свободное место ---
FREE_GB=$(df -BG / | awk 'NR==2 {gsub("G",""); print $4}')
if [[ "$FREE_GB" -lt 5 ]]; then
  die "Мало свободного места: ${FREE_GB}GB (нужно минимум 5GB)" "Освободи место или возьми VPS побольше." 1
fi
print_ok "Свободного места: ${FREE_GB}GB"

# --- RAM ---
TOTAL_RAM_MB=$(free -m | awk 'NR==2{print $2}')
FREE_RAM_MB=$(free -m | awk 'NR==2{print $7}')
if [[ "$TOTAL_RAM_MB" -lt 900 ]]; then
  print_warn "RAM суммарно: ${TOTAL_RAM_MB}MB — мало (рекомендуется 1GB+). Maven может OOM."
  if ! ask_confirm "Продолжить несмотря на это?"; then exit 0; fi
elif [[ "$FREE_RAM_MB" -lt 400 ]]; then
  print_warn "Свободной RAM: ${FREE_RAM_MB}MB — мало. Закрой лишние процессы при сборке."
else
  print_ok "RAM: ${FREE_RAM_MB}MB свободно из ${TOTAL_RAM_MB}MB"
fi

# --- Порты ---
check_port() {
  local p=$1
  if ss -tlnp 2>/dev/null | awk '{print $4}' | grep -qE ":${p}\$"; then return 0; fi
  if netstat -tlnp 2>/dev/null | awk '{print $4}' | grep -qE ":${p}\$"; then return 0; fi
  return 1
}
# Identify the process names holding a port — used to distinguish "our own nginx
# from a previous install" (fine, will be reconfigured later) from
# "Apache or some unrelated server" (needs to be stopped).
port_holders() {
  local p=$1
  ss -tlnp 2>/dev/null | awk -v p=":${p}\$" '$4 ~ p {print $0}' \
    | grep -oE 'users:\(\([^)]+\)' \
    | grep -oE '"[^"]+"' \
    | tr -d '"' \
    | sort -u
}
if check_port 80; then
  HOLDERS=$(port_holders 80 || true)
  log_file "Port 80 holders: ${HOLDERS}"
  # If only nginx is holding it AND our sites-enabled config already exists,
  # this is a reinstall — we'll restart nginx later with the fresh config.
  if [[ "$HOLDERS" == "nginx" && -L /etc/nginx/sites-enabled/craftcms ]]; then
    print_ok "Порт 80 занят нашим nginx (повторная установка) — будет перенастроен на шаге 13"
  else
    if [[ -z "$HOLDERS" ]]; then
      print_warn "Порт 80 занят неизвестным процессом"
    else
      print_warn "Порт 80 занят: ${HOLDERS}"
    fi
    if ask_confirm "Остановить мешающий процесс и продолжить?"; then
      spin_run 15 "Освобождение порта 80..." "
        systemctl stop apache2    2>/dev/null || true
        systemctl disable apache2 2>/dev/null || true
        systemctl stop lighttpd   2>/dev/null || true
        systemctl disable lighttpd 2>/dev/null || true
        # If nginx is holding the port but our config isn't there, this is a
        # stranger nginx — stop it, we'll re-enable our own at step 13.
        systemctl stop nginx      2>/dev/null || true
        sleep 1
      " || true
      if check_port 80; then
        # Last resort — explicit kill, narrowed to TCP listeners only
        fuser -k 80/tcp 2>/dev/null || true
        sleep 1
      fi
      if check_port 80; then die "Порт 80 всё ещё занят" "Останови вручную: ss -tlnp | grep :80" 1; fi
      print_ok "Порт 80 освобождён"
    else
      die "Порт 80 занят" "Останови процесс на порту 80 и запусти скрипт снова" 1
    fi
  fi
fi
if check_port 5432; then
  PG_HOLDERS=$(port_holders 5432 || true)
  log_file "Port 5432 holders: ${PG_HOLDERS}"
  # Our own postgres container forwards 127.0.0.1:5432 → it shows up as "docker-proxy".
  # That's fine on reinstall: we'll recreate the container with the new password later.
  if [[ "$PG_HOLDERS" == "docker-proxy" ]] && docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${PG_CONTAINER}\$"; then
    print_ok "Порт 5432 занят нашим контейнером ${PG_CONTAINER} — будет пересоздан с новым паролем"
  else
    print_warn "Порт 5432 уже занят: ${PG_HOLDERS:-неизвестно} (вероятно локальный PostgreSQL)"
    if ! ask_confirm "Продолжить? (Postgres контейнер не запустится — нужно освободить порт)"; then exit 0; fi
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
print_step "Ввод токена GitHub"
# ══════════════════════════════════════════════════════════════════════════════
echo ""
gum style --foreground "$C_TITLE" --bold "  Токен доступа к репозиторию"
gum style --foreground "$C_MUTED"        "  Получен при покупке, начинается с ghp_ или github_pat_"
echo ""

while true; do
  GITHUB_TOKEN=$(ask_secret "ghp_xxxxxxxxxxxxxxxxxxxx" 70 "token › ") || exit 0
  GITHUB_TOKEN="${GITHUB_TOKEN//[[:space:]]/}"
  if [[ -z "$GITHUB_TOKEN" ]];          then print_fail "Токен не может быть пустым";        continue; fi
  if [[ ${#GITHUB_TOKEN} -lt 20 ]];      then print_fail "Слишком короткий токен";            continue; fi

  rm -f /tmp/cms_http_code
  spin_run 30 "Проверка токена..." "
    curl -fsS --max-time 20 -o /dev/null -w '%{http_code}' \
      -H 'Authorization: token ${GITHUB_TOKEN}' \
      'https://api.github.com/repos/${GITHUB_REPO}' \
      > /tmp/cms_http_code 2>>'$LOG_FILE' || echo '000' > /tmp/cms_http_code
  " || true
  HTTP_CODE=$(cat /tmp/cms_http_code 2>/dev/null || echo "000")
  rm -f /tmp/cms_http_code

  case "$HTTP_CODE" in
    200) print_ok "Токен валиден"; break ;;
    401|403) print_fail "Токен неверный или истёк." ;;
    404) print_fail "Репозиторий не найден. Токен не имеет доступа." ;;
    000) print_fail "Не удалось подключиться к GitHub. Проверь интернет." ;;
    *)   print_fail "Неизвестный ответ от GitHub: HTTP ${HTTP_CODE}" ;;
  esac
done

# ══════════════════════════════════════════════════════════════════════════════
print_step "Ввод настроек сайта и БД"
# ══════════════════════════════════════════════════════════════════════════════
echo ""
gum style --foreground "$C_TITLE" --bold "  Домен или IP сервера"
gum style --foreground "$C_MUTED"        "  Домен: myserver.ru    или    IP: 123.45.67.89"
echo ""

while true; do
  SITE_DOMAIN=$(ask_input "myserver.ru или 123.45.67.89" 50 "domain › ") || exit 0
  SITE_DOMAIN="${SITE_DOMAIN//[[:space:]]/}"
  SITE_DOMAIN="${SITE_DOMAIN,,}"
  SITE_DOMAIN="${SITE_DOMAIN#http://}"; SITE_DOMAIN="${SITE_DOMAIN#https://}"
  SITE_DOMAIN="${SITE_DOMAIN%/}"
  if [[ -z "$SITE_DOMAIN" ]]; then print_fail "Поле не может быть пустым"; continue; fi
  if [[ ! "$SITE_DOMAIN" =~ ^([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+|[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+)$ ]]; then
    print_fail "Невалидный домен или IP"; continue
  fi
  break
done

# SSL только для домена и если не отключено
if [[ $SKIP_SSL -eq 0 && ! "$SITE_DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo ""
  gum style --foreground "$C_TITLE" --bold "  SSL-сертификат"
  gum style --foreground "$C_WARN"         "  Важно: домен должен УЖЕ указывать на этот сервер!"
  echo ""
  if ask_confirm "Установить SSL через Let's Encrypt?"; then
    USE_SSL="y"
    echo ""
    ADMIN_EMAIL=$(ask_input "your@email.com" 40 "email › ") || ADMIN_EMAIL=""
    [[ -z "$ADMIN_EMAIL" ]] && ADMIN_EMAIL="admin@${SITE_DOMAIN}"
  fi
fi

# Postgres password
echo ""
gum style --foreground "$C_TITLE" --bold "  Пароль базы данных PostgreSQL"
gum style --foreground "$C_MUTED"        "  Enter → сгенерировать автоматически (рекомендуется)"
echo ""

while true; do
  POSTGRES_PASSWORD=$(ask_secret "Enter — сгенерировать" 60 "password › ") || POSTGRES_PASSWORD=""
  if [[ -z "$POSTGRES_PASSWORD" ]]; then
    POSTGRES_PASSWORD=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | cut -c1-32)
    print_ok "Сгенерирован пароль (${#POSTGRES_PASSWORD} символов)"
    break
  fi
  if [[ ${#POSTGRES_PASSWORD} -lt 8 ]]; then
    print_fail "Пароль слишком короткий (минимум 8 символов)"
    POSTGRES_PASSWORD=""; continue
  fi
  if [[ "$POSTGRES_PASSWORD" =~ [\'\"\$\`\\] ]]; then
    print_fail "В пароле есть символы, ломающие YAML: ' \" \$ \` \\"
    POSTGRES_PASSWORD=""; continue
  fi
  break
done

# Подтверждение
echo ""
gum style --foreground "$C_TITLE" --bold "  Итог:"
print_info "Адрес сайта:        ${SITE_DOMAIN}"
print_info "SSL:                $([ "$USE_SSL" = "y" ] && echo "Let's Encrypt (https)" || echo "нет (http)")"
print_info "База данных:        PostgreSQL 16 в Docker (127.0.0.1:${PG_PORT})"
print_info "BridgePlugin:       $([ "$SKIP_BRIDGE" -eq 1 ] && echo "пропустить" || echo "собрать если получится")"
echo ""

if ! ask_confirm "Всё верно? Начинаем установку?"; then
  print_dim "Установка отменена пользователем."
  exit 0
fi

# ══════════════════════════════════════════════════════════════════════════════
print_step "Установка системных утилит"
# ══════════════════════════════════════════════════════════════════════════════

spin_run 120 "Обновление списка пакетов..." "apt-get update -qq" \
  || die "apt-get update упал" "Проверь интернет / sources.list" 2
print_ok "Список пакетов обновлён"

spin_run 300 "Установка git, curl, nginx, ufw..." "
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
    git wget unzip nginx software-properties-common \
    apt-transport-https ufw ca-certificates gnupg lsb-release
" || die "Не удалось установить базовые пакеты" "Проверь apt и интернет" 2
print_ok "Базовые пакеты установлены"

# ══════════════════════════════════════════════════════════════════════════════
print_step "Скачивание исходников с GitHub"
# ══════════════════════════════════════════════════════════════════════════════

rm -rf "$SRC_DIR"
spin_run 180 "Клонирование репозитория..." "
  GIT_TERMINAL_PROMPT=0 git clone --depth=1 --quiet --no-tags \
    'https://oauth2:${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git' '$SRC_DIR'
" || die "Не удалось скачать репозиторий" "Проверь токен и интернет" 2
print_ok "Репозиторий склонирован"

# Структура
[[ ! -f "$SRC_DIR/backend/pom.xml"      ]] && die "В репо нет backend/pom.xml" "Обратись в поддержку" 3
[[ ! -f "$SRC_DIR/frontend/package.json"  ]] && die "В репо нет frontend/package.json" "Обратись в поддержку" 3
print_ok "Структура репозитория валидна"

# Очищаем токен из переменной — больше не нужен
GITHUB_TOKEN=""
unset GITHUB_TOKEN

# ══════════════════════════════════════════════════════════════════════════════
print_step "Установка Java 17"
# ══════════════════════════════════════════════════════════════════════════════

if java -version 2>&1 | grep -qE '"(17|21|22|23|24)'; then
  print_ok "Java 17+ уже установлена ($(java -version 2>&1 | head -1))"
else
  spin_run 600 "Установка OpenJDK 17 (~2 мин)..." "
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq openjdk-17-jdk
  " || die "Не удалось установить Java" "apt-get install openjdk-17-jdk вручную" 2
  print_ok "Java 17 установлена"
fi

JAVA_HOME_PATH=$(dirname "$(dirname "$(readlink -f "$(which java)")")")
print_info "JAVA_HOME: ${JAVA_HOME_PATH}"

# ══════════════════════════════════════════════════════════════════════════════
print_step "Установка Maven"
# ══════════════════════════════════════════════════════════════════════════════

if [[ -x "$MAVEN_DIR/bin/mvn" ]]; then
  print_ok "Maven уже установлен ($("$MAVEN_DIR/bin/mvn" -v 2>/dev/null | head -1))"
else
  spin_run 180 "Скачивание Maven ${MAVEN_VERSION}..." "
    wget -q --tries=3 --timeout=60 \
      'https://archive.apache.org/dist/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz' \
      -O /tmp/maven.tar.gz
  " || die "Не удалось скачать Maven" "Проверь интернет" 2

  spin_run 60 "Распаковка Maven..." "
    tar -xzf /tmp/maven.tar.gz -C /opt/
    mv '/opt/apache-maven-${MAVEN_VERSION}' '$MAVEN_DIR'
    rm -f /tmp/maven.tar.gz
  " || die "Не удалось распаковать Maven" "Проверь /opt" 4

  cat > /etc/profile.d/maven.sh << 'MAVEN_PROFILE'
export M2_HOME=/opt/maven
export MAVEN_HOME=/opt/maven
export PATH=$M2_HOME/bin:$PATH
MAVEN_PROFILE
  chmod +x /etc/profile.d/maven.sh
  print_ok "Maven установлен"
fi
export M2_HOME PATH="$M2_HOME/bin:$PATH"

# ══════════════════════════════════════════════════════════════════════════════
print_step "Установка Node.js 20"
# ══════════════════════════════════════════════════════════════════════════════

if node --version 2>/dev/null | grep -qE 'v(2[0-9]|[3-9][0-9])\.'; then
  print_ok "Node.js уже установлен ($(node --version))"
else
  spin_run 60 "Добавление репозитория NodeSource..." "
    curl -fsSL --max-time 30 https://deb.nodesource.com/setup_20.x | bash -
  " || die "Не удалось добавить репозиторий Node.js" "Проверь интернет" 2

  spin_run 180 "Установка Node.js 20..." "
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs
  " || die "Не удалось установить Node.js" "apt-get install nodejs вручную" 2
  print_ok "Node.js установлен ($(node --version))"
fi

# ══════════════════════════════════════════════════════════════════════════════
print_step "Установка Erlang / Elixir (агент обновлений)"
# ══════════════════════════════════════════════════════════════════════════════

ELIXIR_OK=0
if command -v elixir &>/dev/null && elixir --version 2>/dev/null | grep -qE 'Elixir [1-9]'; then
  print_ok "Elixir уже установлен ($(elixir --version 2>/dev/null | head -1))"
  ELIXIR_OK=1
else
  spin_run 300 "Установка erlang + elixir..." "
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq erlang elixir
  " && ELIXIR_OK=1 || print_warn "Не удалось установить Erlang/Elixir — агент обновлений будет пропущен"

  if [[ $ELIXIR_OK -eq 1 ]]; then
    print_ok "Elixir установлен ($(elixir --version 2>/dev/null | head -1))"
  fi
fi

if [[ $ELIXIR_OK -eq 1 ]]; then
  # Bootstrap Mix package manager tools — needed before mix deps.get / mix release.
  # Non-fatal: on reinstall they are already present.
  spin_run 60 "Инициализация hex + rebar3..." "
    HOME=/root mix local.hex --force --quiet
    HOME=/root mix local.rebar --force --quiet
  " || print_warn "hex/rebar bootstrap не удался (продолжаем — mix может уже иметь их)"
fi

# ══════════════════════════════════════════════════════════════════════════════
print_step "Установка Docker и PostgreSQL"
# ══════════════════════════════════════════════════════════════════════════════

if command -v docker &>/dev/null && docker info &>/dev/null; then
  print_ok "Docker уже установлен ($(docker --version | awk '{print $3}' | tr -d ,))"
else
  spin_run 300 "Установка Docker Engine..." "
    curl -fsSL --max-time 30 https://get.docker.com | sh
  " || die "Не удалось установить Docker" "https://docs.docker.com/engine/install/" 2
  systemctl enable --now docker >>"$LOG_FILE" 2>&1 || true

  # Проверим что демон отвечает
  for i in 1 2 3 4 5; do
    if docker info >/dev/null 2>&1; then break; fi
    sleep 2
  done
  docker info >/dev/null 2>&1 || die "Docker daemon не отвечает" "systemctl status docker" 4
  print_ok "Docker установлен и запущен"
fi

# Pre-pull image with timeout (отдельно — медленный шаг)
spin_run 300 "Скачивание образа ${PG_IMAGE}..." "docker pull '$PG_IMAGE'" \
  || die "Не удалось скачать образ PostgreSQL" "Проверь Docker Hub" 2
print_ok "Образ ${PG_IMAGE} готов"

# Recreate container (но volume сохраняем)
if docker ps -a --format '{{.Names}}' | grep -q "^${PG_CONTAINER}\$"; then
  print_warn "Контейнер ${PG_CONTAINER} уже существует — пересоздаём с новым паролем"
  docker rm -f "$PG_CONTAINER" >>"$LOG_FILE" 2>&1 || true
fi
docker volume create "$PG_VOLUME" >>"$LOG_FILE" 2>&1 || true

# Запуск Postgres
PG_RUN_OUT=$(mktemp)
if ! timeout 60s docker run -d \
  --name "$PG_CONTAINER" \
  --restart unless-stopped \
  --health-cmd="pg_isready -U $PG_USER -d $PG_DB" \
  --health-interval=10s --health-timeout=3s --health-retries=5 \
  -e POSTGRES_USER="$PG_USER" \
  -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  -e POSTGRES_DB="$PG_DB" \
  -p 127.0.0.1:${PG_PORT}:5432 \
  -v "$PG_VOLUME":/var/lib/postgresql/data \
  "$PG_IMAGE" >"$PG_RUN_OUT" 2>&1; then
  cat "$PG_RUN_OUT" >>"$LOG_FILE"; rm -f "$PG_RUN_OUT"
  die "Не удалось запустить PostgreSQL контейнер" "docker logs $PG_CONTAINER" 4
fi
rm -f "$PG_RUN_OUT"
print_ok "PostgreSQL контейнер запущен"

# Wait for readiness
print_info "Ждём готовности PostgreSQL..."
PG_WAIT=0 PG_MAX_WAIT=120
while ! docker exec "$PG_CONTAINER" pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; do
  sleep 2; PG_WAIT=$((PG_WAIT + 2))
  printf "\r  ${CYAN}⟳${NC}  ${PG_WAIT}с / ${PG_MAX_WAIT}с"
  if [[ $PG_WAIT -ge $PG_MAX_WAIT ]]; then
    echo ""
    docker logs --tail=30 "$PG_CONTAINER" >>"$LOG_FILE" 2>&1 || true
    die "PostgreSQL не запустился за ${PG_MAX_WAIT}с" "docker logs $PG_CONTAINER" 4
  fi
done
echo ""
print_ok "PostgreSQL готов"

# Smoke test
if ! timeout 10s docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -c 'SELECT 1' >>"$LOG_FILE" 2>&1; then
  die "PostgreSQL не отвечает на psql" "docker logs $PG_CONTAINER" 4
fi
print_ok "Smoke-test БД пройден"

# ══════════════════════════════════════════════════════════════════════════════
print_step "Сборка серверной части (Backend)"
# ══════════════════════════════════════════════════════════════════════════════

mkdir -p "$INSTALL_DIR"/{uploads,logs,frontend,backups/site-settings}
cd "$SRC_DIR/backend"

# Тёплый прогрев репозитория — отдельно, чтобы понимать что именно тормозит.
spin_run 600 "Скачивание Maven-зависимостей backend (1-я установка ~3-5 мин)..." "
  JAVA_HOME='$JAVA_HOME_PATH' '$M2_HOME/bin/mvn' \
    -B -ntp -T 1C dependency:go-offline -DskipTests -fn
" || print_warn "dependency:go-offline вернул ошибку — продолжаем"

# Сама сборка
spin_run 600 "Компиляция Backend (5-10 мин)..." "
  JAVA_HOME='$JAVA_HOME_PATH' '$M2_HOME/bin/mvn' \
    -B -ntp -T 1C clean package -DskipTests
" || {
  echo ""
  print_fail "Ошибка сборки backend. Последние строки лога:"
  tail -25 "$LOG_FILE" | sed 's/^/    /'
  die "Сборка backend упала" "Полный лог: ${LOG_FILE}" 3
}

JAR_FILE=$(ls target/craftcms-backend-*.jar 2>/dev/null | head -1)
[[ -z "$JAR_FILE" ]] && die "JAR не найден после сборки" "tail -50 ${LOG_FILE}" 3
cp "$JAR_FILE" "$INSTALL_DIR/craftcms.jar"
print_ok "Backend собран и скопирован ($(du -h "$INSTALL_DIR/craftcms.jar" | awk '{print $1}'))"
cd /

# ══════════════════════════════════════════════════════════════════════════════
print_step "Сборка BridgePlugin (опционально)"
# ══════════════════════════════════════════════════════════════════════════════

BRIDGE_BUILT=0
if [[ $SKIP_BRIDGE -eq 1 ]]; then
  print_warn "Пропущено по флагу --skip-bridge"
elif [[ ! -f "$SRC_DIR/BridgePlugin/pom.xml" ]]; then
  print_warn "BridgePlugin не найден в репозитории — пропускаем"
else
  cd "$SRC_DIR/BridgePlugin"
  print_info "BridgePlugin зависит от hub.spigotmc.org — иногда медленно/недоступно"
  print_info "Ждём максимум 5 минут, потом продолжаем установку без плагина"

  if spin_run 300 "Сборка BridgePlugin (макс 5 мин)..." "
    JAVA_HOME='$JAVA_HOME_PATH' '$M2_HOME/bin/mvn' \
      -B -ntp clean package -DskipTests
  "; then
    BRIDGE_JAR=$(ls target/*.jar 2>/dev/null | grep -v 'original' | head -1)
    if [[ -n "$BRIDGE_JAR" ]]; then
      cp "$BRIDGE_JAR" "$INSTALL_DIR/BridgePlugin.jar"
      BRIDGE_BUILT=1
      print_ok "BridgePlugin собран"
    else
      print_warn "Сборка завершилась, но JAR не найден — пропускаем"
    fi
  else
    rc=$?
    if [[ $rc -eq 124 ]]; then
      print_warn "BridgePlugin: таймаут 5 мин (Spigot SNAPSHOT-репо недоступен). Пропускаем."
      print_dim "Собери позже вручную: cd ${SRC_DIR}/BridgePlugin && mvn package"
    else
      print_warn "BridgePlugin не собрался (код $rc). Это не критично — сайт работает без него."
    fi
  fi
  cd /
fi

# ══════════════════════════════════════════════════════════════════════════════
print_step "Конфиг бэкенда (Postgres, prod-профиль)"
# ══════════════════════════════════════════════════════════════════════════════

cat > "$INSTALL_DIR/application.yml" << APPYML
server:
  port: ${BACKEND_PORT}

spring:
  application:
    name: craftcms-backend
  profiles:
    active: prod
  datasource:
    url: jdbc:postgresql://127.0.0.1:${PG_PORT}/${PG_DB}
    driver-class-name: org.postgresql.Driver
    username: ${PG_USER}
    password: '${POSTGRES_PASSWORD}'
    hikari:
      maximum-pool-size: 10
      minimum-idle: 2
      connection-timeout: 10000
      idle-timeout: 600000
      max-lifetime: 1800000
  h2:
    console:
      enabled: false
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: false
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
        jdbc:
          lob:
            non_contextual_creation: true
  jackson:
    serialization:
      write-dates-as-timestamps: false
    time-zone: UTC

app:
  jwt:
    secret: ${JWT_SECRET}
    expiration: 86400000
  cors:
    allowed-origins:
      - http://${SITE_DOMAIN}
      - https://${SITE_DOMAIN}
  upload:
    path: ${INSTALL_DIR}/uploads
  modules:
    trademc: true

bridge:
  template-jar: ${INSTALL_DIR}/BridgePlugin.jar

logging:
  level:
    com.craftcms: INFO
    org.springframework.security: WARN
  file:
    name: ${INSTALL_DIR}/logs/craftcms.log
APPYML
chmod 600 "$INSTALL_DIR/application.yml"
print_ok "application.yml записан (chmod 600)"

# ══════════════════════════════════════════════════════════════════════════════
print_step "Сборка агента обновлений (Elixir updater)"
# ══════════════════════════════════════════════════════════════════════════════

UPDATER_BUILT=0
if [[ $ELIXIR_OK -eq 0 ]]; then
  print_warn "Elixir не установлен — агент обновлений пропущен"
elif [[ ! -d "$SRC_DIR/updater" ]]; then
  print_warn "updater/ не найден в репозитории — пропускаем"
else
  cd "$SRC_DIR/updater"
  log_file "Building Elixir updater in $(pwd)"

  # mix deps.get — foreground so output is visible in the log
  echo ""
  echo -e "  ${CYAN}⟳${NC}  mix deps.get (загрузка зависимостей)..."
  set +e
  HOME=/root MIX_ENV=prod mix deps.get --only prod 2>&1 | tee -a "$LOG_FILE"
  DEPS_RC=${PIPESTATUS[0]}
  set -e

  if [[ $DEPS_RC -ne 0 ]]; then
    print_warn "mix deps.get упал (код ${DEPS_RC}) — агент обновлений не собран"
  else
    # mix release — foreground
    echo -e "  ${CYAN}⟳${NC}  mix release (сборка релиза)..."
    set +e
    HOME=/root MIX_ENV=prod mix release --overwrite 2>&1 | tee -a "$LOG_FILE"
    REL_RC=${PIPESTATUS[0]}
    set -e

    if [[ $REL_RC -ne 0 ]] || [[ ! -d "_build/prod/rel/updater" ]]; then
      print_warn "mix release упал (код ${REL_RC}) — агент обновлений не собран"
    else
      rm -rf /opt/craftcms-updater
      cp -r "_build/prod/rel/updater" /opt/craftcms-updater
      print_ok "Elixir updater собран → /opt/craftcms-updater ($(du -sh /opt/craftcms-updater | awk '{print $1}'))"
      UPDATER_BUILT=1
    fi
  fi
  cd /
fi

# ══════════════════════════════════════════════════════════════════════════════
print_step "Сборка визуальной части (Frontend)"
# ══════════════════════════════════════════════════════════════════════════════

cd "$SRC_DIR/frontend"

# When npm is invoked as root it drops privileges to "nobody" before running
# package.json scripts. Because node_modules/.bin/tsc was created under root,
# the nobody user can't execute it → "tsc: Permission denied".
# unsafe-perm tells npm to keep running scripts as the current (root) user.
export NPM_CONFIG_UNSAFE_PERM=true
export npm_config_unsafe_perm=true

print_info "npm $(npm --version 2>/dev/null), node $(node --version 2>/dev/null)"

# Wipe any half-baked install from a previous attempt. node_modules built under
# a different uid/permission setup can leave behind .bin entries that are
# unreadable by the script runner — easier to start fresh.
if [[ -d node_modules ]]; then
  print_info "Удаляем старый node_modules (свежая установка)..."
  rm -rf node_modules
fi

# Run npm directly in the foreground with tee — no gum spin, no silencing.
# This guarantees we always SEE what npm is doing and that any failure mode
# (deprecated flag silent-exit, hang, EACCES, etc.) is visible immediately
# instead of being swallowed by the spinner wrapper.
run_npm_visible() {
  local title="$1"; shift
  echo ""
  echo -e "  ${CYAN}⟳${NC}  ${title}"
  log_file "FG npm :: $*"
  set +e
  "$@" 2>&1 | tee -a "$LOG_FILE"
  local rc=${PIPESTATUS[0]}
  set -e
  return $rc
}

# npm install — with retry on network failure
attempt=0
while true; do
  attempt=$((attempt + 1))
  if run_npm_visible "npm install (попытка ${attempt}/3)..." \
    npm install --no-audit --no-fund; then
    break
  fi
  if [[ $attempt -ge 3 ]]; then
    die "npm install падает 3 раза подряд" "Проверь интернет и npm registry, лог: ${LOG_FILE}" 2
  fi
  print_warn "npm install упал — чистим и пробуем снова"
  rm -rf node_modules package-lock.json 2>/dev/null || true
  sleep 5
done

# Verify the build toolchain actually landed on disk before invoking it.
if [[ ! -x node_modules/.bin/tsc ]]; then
  die "node_modules/.bin/tsc не появился после npm install" \
      "Запусти вручную: cd ${SRC_DIR}/frontend && npm install --verbose" 3
fi
if [[ ! -x node_modules/.bin/vite ]]; then
  die "node_modules/.bin/vite не появился после npm install" \
      "Запусти вручную: cd ${SRC_DIR}/frontend && npm install --verbose" 3
fi
print_ok "npm зависимости установлены (tsc + vite на месте)"

# Run build in the foreground too — we need to see ALL output if anything
# misbehaves. Also bypass the package.json "build" script and invoke the
# binaries directly: that sidesteps any npm script-runner quirks (e.g. uid
# downgrading despite NPM_CONFIG_UNSAFE_PERM, deprecated-flag silent-exit).
echo ""
echo -e "  ${CYAN}⟳${NC}  TypeScript компиляция..."
log_file "FG tsc"
set +e
./node_modules/.bin/tsc 2>&1 | tee -a "$LOG_FILE"
TSC_RC=${PIPESTATUS[0]}
set -e
if [[ $TSC_RC -ne 0 ]]; then
  die "TypeScript компиляция упала (exit $TSC_RC)" "Лог: ${LOG_FILE}" 3
fi

echo ""
echo -e "  ${CYAN}⟳${NC}  Vite production build..."
log_file "FG vite build"
set +e
./node_modules/.bin/vite build 2>&1 | tee -a "$LOG_FILE"
VITE_RC=${PIPESTATUS[0]}
set -e
if [[ $VITE_RC -ne 0 ]]; then
  die "Vite build упал (exit $VITE_RC)" "Лог: ${LOG_FILE}" 3
fi

if [[ ! -f dist/index.html ]]; then
  print_fail "vite build вернул 0, но dist/index.html не создан"
  print_dim "Содержимое frontend/: $(ls -1A 2>/dev/null | tr '\n' ' ')"
  print_dim "Содержимое dist/: $(ls -1A dist/ 2>/dev/null | tr '\n' ' ' || echo 'отсутствует')"
  die "Сборка frontend не дала output" "Лог: ${LOG_FILE}" 3
fi
print_ok "Frontend собран ($(du -sh dist | awk '{print $1}'))"

rm -rf "$INSTALL_DIR/frontend/"*
cp -r dist/* "$INSTALL_DIR/frontend/"
print_ok "Файлы скопированы в ${INSTALL_DIR}/frontend"
cd /

# ══════════════════════════════════════════════════════════════════════════════
print_step "Настройка прав, пользователя и systemd"
# ══════════════════════════════════════════════════════════════════════════════

if ! id "$SERVICE_USER" &>/dev/null; then
  useradd -r -s /bin/false -d "$INSTALL_DIR" "$SERVICE_USER"
  print_ok "Системный пользователь '${SERVICE_USER}' создан"
else
  print_ok "Системный пользователь '${SERVICE_USER}' уже существует"
fi

chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
chmod 755 "$INSTALL_DIR"
chmod -R 755 "$INSTALL_DIR/frontend"
chmod 755 "$INSTALL_DIR/uploads"
chmod 750 "$INSTALL_DIR/logs"
chmod 600 "$INSTALL_DIR/application.yml"
print_ok "Права выставлены"

cat > /etc/systemd/system/craftcms.service << SYSTEMD
[Unit]
Description=CraftCMS — Minecraft Server Website
Documentation=https://github.com/${GITHUB_REPO}
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}

ExecStart=${JAVA_HOME_PATH}/bin/java \\
  -Xms256m -Xmx512m \\
  -XX:+UseG1GC \\
  -XX:+ExitOnOutOfMemoryError \\
  -Dspring.config.location=${INSTALL_DIR}/application.yml \\
  -jar ${INSTALL_DIR}/craftcms.jar

Restart=on-failure
RestartSec=15
StartLimitInterval=300
StartLimitBurst=5
StandardOutput=append:${INSTALL_DIR}/logs/craftcms.log
StandardError=append:${INSTALL_DIR}/logs/craftcms-error.log
LimitNOFILE=65536

# Hardening
NoNewPrivileges=yes
ProtectSystem=full
ProtectHome=yes
PrivateTmp=yes
ProtectKernelTunables=yes
ProtectControlGroups=yes
ReadWritePaths=${INSTALL_DIR}

[Install]
WantedBy=multi-user.target
SYSTEMD

cat > /etc/systemd/system/craftcms-updater.service << UPDATER_SYSTEMD
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
StandardOutput=append:${INSTALL_DIR}/logs/craftcms-updater.log
StandardError=append:${INSTALL_DIR}/logs/craftcms-updater.log

[Install]
WantedBy=multi-user.target
UPDATER_SYSTEMD

systemctl daemon-reload
systemctl enable craftcms >>"$LOG_FILE" 2>&1
if [[ $UPDATER_BUILT -eq 1 ]]; then
  systemctl enable craftcms-updater >>"$LOG_FILE" 2>&1
fi
print_ok "systemd units зарегистрированы"

# ══════════════════════════════════════════════════════════════════════════════
print_step "Настройка Nginx, файрвола и запуск"
# ══════════════════════════════════════════════════════════════════════════════

rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

cat > /etc/nginx/sites-available/craftcms << NGINXCONF
server {
    listen 80;
    listen [::]:80;
    server_name ${SITE_DOMAIN};

    access_log ${INSTALL_DIR}/logs/nginx-access.log;
    error_log  ${INSTALL_DIR}/logs/nginx-error.log warn;

    client_max_body_size 50M;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location /updater/ {
        proxy_pass http://127.0.0.1:8089/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 600s;
        proxy_connect_timeout 10s;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        expires 7d;
    }

    location /skin/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location / {
        root ${INSTALL_DIR}/frontend;
        index index.html;
        try_files \$uri \$uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2|woff|ttf)\$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }
}
NGINXCONF

ln -sf /etc/nginx/sites-available/craftcms /etc/nginx/sites-enabled/craftcms
nginx -t >>"$LOG_FILE" 2>&1 || die "Конфиг nginx невалиден" "nginx -t" 4
print_ok "Nginx настроен"

spin_run 30 "Настройка файрвола..." "
  ufw allow OpenSSH       >>$LOG_FILE 2>&1 || true
  ufw allow 'Nginx Full'  >>$LOG_FILE 2>&1 || true
  status=\$(ufw status 2>/dev/null | head -1)
  if [[ \"\$status\" == *inactive* ]]; then
    ufw --force enable >>$LOG_FILE 2>&1 || true
  fi
" || true
print_ok "Файрвол настроен"

spin_run 30 "Перезапуск Nginx..." "
  systemctl enable nginx  >>$LOG_FILE 2>&1
  systemctl restart nginx >>$LOG_FILE 2>&1
" || die "Не удалось перезапустить Nginx" "systemctl status nginx" 4
print_ok "Nginx запущен"

spin_run 15 "Запуск CraftCMS (Java)..." "systemctl start craftcms" \
  || die "Не удалось запустить craftcms.service" "journalctl -u craftcms -n 50" 4
print_ok "CraftCMS запускается..."

if [[ $UPDATER_BUILT -eq 1 ]]; then
  spin_run 15 "Запуск агента обновлений..." "systemctl start craftcms-updater" \
    && print_ok "craftcms-updater запущен (порт 8089)" \
    || print_warn "craftcms-updater не запустился — journalctl -u craftcms-updater -n 30"
fi

# Record installed commit so the admin Updates page knows the current version.
git -C "$SRC_DIR" rev-parse HEAD > "$INSTALL_DIR/version.txt" 2>/dev/null || true

# Health check
echo ""
print_info "Ждём готовности Java (20-60 сек на холодный старт)..."
HEALTH_WAIT=0 HEALTH_MAX_WAIT=120
HEALTH_OK=0
while [[ $HEALTH_WAIT -lt $HEALTH_MAX_WAIT ]]; do
  if curl -fsS --max-time 3 "http://127.0.0.1:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
    HEALTH_OK=1; break
  fi
  # Если сервис упал — даже не ждём дальше
  if ! systemctl is-active --quiet craftcms; then
    echo ""
    print_fail "Сервис craftcms упал во время старта"
    journalctl -u craftcms -n 30 --no-pager >>"$LOG_FILE" 2>&1 || true
    die "Сервис не запустился" "journalctl -u craftcms -n 50" 4
  fi
  sleep 3; HEALTH_WAIT=$((HEALTH_WAIT + 3))
  printf "\r  ${CYAN}⟳${NC}  Ждём... %ds / %ds" "$HEALTH_WAIT" "$HEALTH_MAX_WAIT"
done
echo ""
if [[ $HEALTH_OK -eq 1 ]]; then
  print_ok "Сервер отвечает на /api/health"
else
  print_warn "Сервер не ответил за ${HEALTH_MAX_WAIT}с — проверь: journalctl -u craftcms -f"
fi

# SSL — после старта сервиса (Let's Encrypt валидирует через HTTP-01)
if [[ "$USE_SSL" == "y" ]]; then
  echo ""
  spin_run 120 "Установка Certbot..." "
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot python3-certbot-nginx
  " || print_warn "Не удалось установить Certbot — SSL пропущен"

  if command -v certbot >/dev/null; then
    if spin_run 180 "Получение SSL сертификата для ${SITE_DOMAIN}..." "
      certbot --nginx -d '$SITE_DOMAIN' \
        --non-interactive --agree-tos \
        --email '${ADMIN_EMAIL:-admin@${SITE_DOMAIN}}' \
        --redirect
    "; then
      print_ok "SSL сертификат установлен"
      # cron renew
      (crontab -l 2>/dev/null | grep -v certbot; echo "0 3 * * * certbot renew --quiet") | crontab -
      print_ok "Автообновление SSL добавлено (каждую ночь в 3:00)"
    else
      print_warn "Certbot не смог получить сертификат"
      print_dim "Убедись что ${SITE_DOMAIN} указывает на этот сервер, затем: certbot --nginx -d ${SITE_DOMAIN}"
    fi
  fi
fi

# Copy maintenance scripts to install dir
for _s in update.sh install.sh enable-ssl.sh; do
  if [[ -f "$SRC_DIR/$_s" ]]; then
    cp "$SRC_DIR/$_s" "$INSTALL_DIR/$_s"
    chmod +x "$INSTALL_DIR/$_s"
    print_ok "Скрипт скопирован: ${INSTALL_DIR}/${_s}"
  fi
done

# Cleanup
rm -rf "$SRC_DIR"

# ──────────────────────────────────────────────────────────────────────────────
#  ИТОГ
# ──────────────────────────────────────────────────────────────────────────────
INSTALL_FINISHED=1
PROTO="http"
[[ "$USE_SSL" == "y" ]] && PROTO="https"

echo ""
echo ""
gum style --border double --border-foreground "$C_OK" \
  --padding "1 4" --margin "0 2" --align center --bold \
  --foreground "$C_TITLE" \
  "✓   CraftCMS установлена!"
echo ""

gum style --foreground "$C_TITLE" --bold "  ДОСТУП"
gum style --foreground "$C_MUTED"        "  ──────────────────────────────────────────"
gum style "  Сайт:    $(gum style --foreground "$C_INFO" --bold "${PROTO}://${SITE_DOMAIN}")"
gum style "  Админка: $(gum style --foreground "$C_INFO" --bold "${PROTO}://${SITE_DOMAIN}/admin")"
echo ""

gum style --foreground "$C_TITLE" --bold "  ВХОД"
gum style --foreground "$C_MUTED"        "  ──────────────────────────────────────────"
gum style "  Логин:   $(gum style --foreground "$C_WARN" --bold 'admin')"
gum style "  Пароль:  $(gum style --foreground "$C_WARN" --bold 'Admin123!')"
echo ""
gum style --foreground "$C_ERR" --bold "  ⚠  СРАЗУ ПОСЛЕ ВХОДА СМЕНИ ПАРОЛЬ!"
echo ""

gum style --foreground "$C_TITLE" --bold "  УПРАВЛЕНИЕ"
gum style --foreground "$C_MUTED"        "  ──────────────────────────────────────────"
gum style "  Статус сайта:    $(gum style --foreground "$C_INFO" 'systemctl status craftcms')"
gum style "  Перезапуск:      $(gum style --foreground "$C_INFO" 'systemctl restart craftcms')"
gum style "  Логи сайта:      $(gum style --foreground "$C_INFO" 'journalctl -u craftcms -f')"
gum style "  Статус БД:       $(gum style --foreground "$C_INFO" "docker ps -f name=${PG_CONTAINER}")"
gum style "  Логи БД:         $(gum style --foreground "$C_INFO" "docker logs -f ${PG_CONTAINER}")"
gum style "  Дамп БД:         $(gum style --foreground "$C_INFO" "docker exec ${PG_CONTAINER} pg_dump -U ${PG_USER} ${PG_DB}")"
gum style "  Обновить сайт:   $(gum style --foreground "$C_INFO" 'bash update.sh')"
echo ""

gum style --foreground "$C_TITLE" --bold "  ФАЙЛЫ"
gum style --foreground "$C_MUTED"        "  ──────────────────────────────────────────"
gum style --foreground "$C_MUTED" "  ${INSTALL_DIR}/                  основная директория"
gum style --foreground "$C_MUTED" "  ${INSTALL_DIR}/uploads/          загруженные файлы"
gum style --foreground "$C_MUTED" "  ${INSTALL_DIR}/logs/             логи приложения"
gum style --foreground "$C_MUTED" "  ${INSTALL_DIR}/application.yml   конфиг (с паролем БД, chmod 600)"
gum style --foreground "$C_MUTED" "  ${LOG_FILE}                      лог установщика"
gum style --foreground "$C_MUTED" "  docker volume ${PG_VOLUME}       данные PostgreSQL"
echo ""

if [[ $BRIDGE_BUILT -eq 0 && $SKIP_BRIDGE -eq 0 ]]; then
  gum style --foreground "$C_WARN" --bold "  BridgePlugin не собран"
  gum style --foreground "$C_MUTED" "  Сайт работает без него. Если нужен — собери позже:"
  gum style --foreground "$C_INFO"  "    bash update.sh"
  echo ""
fi

gum style --foreground "$C_MUTED" "  Если что-то не работает — пришли вывод:"
gum style --foreground "$C_INFO"  "    journalctl -u craftcms -n 50 --no-pager"
gum style --foreground "$C_MUTED" "  и лог установщика: ${LOG_FILE}"
echo ""
echo ""
