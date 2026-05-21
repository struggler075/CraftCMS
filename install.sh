#!/bin/bash
# ==============================================================================
#  CraftCMS — Установщик (с gum TUI)
# ==============================================================================

[ -z "$BASH_VERSION" ] && exec bash "$0" "$@"
set -euo pipefail

trap 'echo ""; echo -e "\033[0;31m  СКРИПТ АВАРИЙНО ЗАВЕРШИЛСЯ на строке $LINENO\033[0m"; echo -e "\033[0;33m  Отправь нам эту строку — мы разберёмся что пошло не так.\033[0m"; echo ""' ERR

# ── Цвета для аварийных сообщений до установки gum ────────────────────────────
RED='\033[0;31m';   GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m';  CYAN='\033[0;36m';  MAGENTA='\033[0;35m'
WHITE='\033[1;37m'; BOLD='\033[1m';     DIM='\033[2m';     NC='\033[0m'

# ── Простые функции вывода (используются всё время) ──────────────────────────
print_ok()   { echo -e "  ${GREEN}✓${NC}  $*"; }
print_fail() { echo -e "  ${RED}✗${NC}  $*"; }
print_info() { echo -e "  ${CYAN}→${NC}  $*"; }
print_warn() { echo -e "  ${YELLOW}!${NC}  $*"; }

die() {
  echo ""
  if command -v gum &>/dev/null; then
    gum style --border thick --border-foreground 196 \
      --padding "0 2" --foreground 15 --bold \
      "ОШИБКА: $1"
    [[ -n "${2:-}" ]] && gum style --foreground 11 --padding "0 2" "Что делать: $2"
  else
    echo -e "${RED}${BOLD}  ОШИБКА: $1${NC}"
    [[ -n "${2:-}" ]] && echo -e "${YELLOW}  Что делать: $2${NC}"
  fi
  echo ""
  echo -e "${DIM}  Если не можешь разобраться — напиши нам, мы поможем.${NC}"
  echo ""
  exit 1
}

# ── Ранняя проверка root ──────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && die \
  "Скрипт нужно запускать от имени администратора (root)" \
  "Напиши команду:  sudo bash install.sh"

# ── Установка gum ─────────────────────────────────────────────────────────────
if ! command -v gum &>/dev/null; then
  echo -e "${DIM}  Подготовка установщика (устанавливаем gum для красивого вывода)...${NC}"

  # Сначала ставим базовые утилиты что бы установить gum
  apt-get install -y -qq curl gnupg ca-certificates 2>/dev/null >/dev/null || \
    die "Не удалось установить базовые утилиты" "Проверь интернет и доступ к apt."

  mkdir -p /etc/apt/keyrings
  curl -fsSL https://repo.charm.sh/apt/gpg.key 2>/dev/null | \
    gpg --dearmor --yes -o /etc/apt/keyrings/charm.gpg 2>/dev/null || \
    die "Не удалось добавить ключ репозитория gum" "Проверь интернет."
  echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" \
    > /etc/apt/sources.list.d/charm.list
  apt-get update -qq 2>/dev/null >/dev/null
  apt-get install -y -qq gum 2>/dev/null >/dev/null || \
    die "Не удалось установить gum" "Попробуй вручную: apt-get install gum"
fi

# ── Стили gum (числовые цвета ANSI) ───────────────────────────────────────────
C_PRIMARY=99      # фиолетовый
C_OK=46           # ярко-зелёный
C_ERR=196         # ярко-красный
C_WARN=214        # оранжевый
C_INFO=51         # циан
C_MUTED=243       # серый
C_TITLE=15        # белый

# ── print_step через gum ──────────────────────────────────────────────────────
print_step() {
  local num="$1"; local total="$2"; local msg="$3"
  echo ""
  gum style \
    --border rounded --border-foreground "$C_PRIMARY" \
    --padding "0 2" --margin "0 2" --bold \
    "[$num/$total]  $msg"
}

# ── ВВОД (gum input) ──────────────────────────────────────────────────────────
ask_input() {
  # ask_input <placeholder> [width] [prompt]
  local placeholder="$1"
  local width="${2:-60}"
  local prompt="${3:-› }"
  gum input \
    --placeholder "$placeholder" \
    --prompt "  $prompt" \
    --width "$width"
}

# ── ПОДТВЕРЖДЕНИЕ (gum confirm) ───────────────────────────────────────────────
ask_confirm() {
  # ask_confirm <message> -> exit code (0 = yes, 1 = no)
  # Никаких --selected.* флагов — в старых версиях gum их нет и confirm молча падает
  gum confirm "$1"
}

# ── SPIN-обёртка (gum spin с фолбэком) ────────────────────────────────────────
run_spin() {
  # run_spin <title> -- <cmd> ...
  local title="$1"; shift
  [[ "${1:-}" == "--" ]] && shift
  gum spin --spinner dot --title "$title" -- "$@"
}

# ──────────────────────────────────────────────────────────────────────────────
#  БАННЕР
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
gum style --foreground "$C_TITLE" --bold "  Автоматический установщик"
gum style --foreground "$C_MUTED"        "  ты вводишь токен — мы делаем всё остальное"
echo ""
gum style --foreground "$C_INFO" "  Java 17, Node.js, Maven, Nginx, Docker + PostgreSQL — всё ставится автоматически"
gum style --foreground "$C_WARN" "  Время установки: ~5–15 минут"
echo ""
sleep 1

TOTAL_STEPS=13

# ══════════════════════════════════════════════════════════════════════════════
print_step "1" "$TOTAL_STEPS" "Проверка системы"
# ══════════════════════════════════════════════════════════════════════════════

print_ok "Права администратора есть"

# --- ОС ---
if [[ ! -f /etc/os-release ]]; then
  die "Не удаётся определить операционную систему" \
      "Убедись что у тебя Ubuntu 20/22/24 или Debian 11/12"
fi
. /etc/os-release
OS_NAME="${PRETTY_NAME:-$ID}"

case "${ID:-}" in
  ubuntu|debian) print_ok "Операционная система: ${OS_NAME}" ;;
  *) die "Операционная система '${OS_NAME}' не поддерживается" \
         "Установи Ubuntu 22.04 и попробуй снова." ;;
esac

# --- Интернет ---
run_spin "Проверка подключения к интернету..." -- \
  curl -s --connect-timeout 10 -o /dev/null https://github.com || \
  die "Нет подключения к интернету" \
      "Проверь настройки сети у своего хостинг-провайдера."
print_ok "Интернет есть"

# --- Свободное место ---
FREE_GB=$(df -BG / | awk 'NR==2 {gsub("G",""); print $4}')
if [[ "$FREE_GB" -lt 3 ]]; then
  die "Мало свободного места на диске: ${FREE_GB}GB (нужно минимум 3GB)" \
      "Освободи место или возьми VPS с большим диском."
fi
print_ok "Свободного места: ${FREE_GB}GB"

# --- RAM ---
FREE_RAM_MB=$(free -m | awk 'NR==2{print $7}')
if [[ "$FREE_RAM_MB" -lt 400 ]]; then
  print_warn "Мало оперативной памяти: ${FREE_RAM_MB}MB. Рекомендуется минимум 1GB."
  sleep 2
else
  print_ok "Оперативная память: ${FREE_RAM_MB}MB свободно"
fi

# --- Порт 80 ---
if ss -tlnp 2>/dev/null | grep -q ':80 ' || netstat -tlnp 2>/dev/null | grep -q ':80 '; then
  echo ""
  print_warn "Порт 80 уже занят (скорее всего Apache или другой веб-сервер)."
  echo ""
  if ! ask_confirm "Остановить мешающий процесс и продолжить?"; then
    echo ""
    gum style --foreground "$C_MUTED" "  Установка отменена."
    gum style --foreground "$C_MUTED" "  Останови вручную то что занимает порт 80, затем запусти скрипт снова."
    echo ""
    exit 0
  fi
  run_spin "Освобождение порта 80..." -- bash -c "
    systemctl stop apache2    2>/dev/null || true
    systemctl disable apache2 2>/dev/null || true
    systemctl stop lighttpd   2>/dev/null || true
    systemctl disable lighttpd 2>/dev/null || true
    fuser -k 80/tcp 2>/dev/null || true
    sleep 1
  "
  print_ok "Порт 80 освобождён"
fi

# ══════════════════════════════════════════════════════════════════════════════
print_step "2" "$TOTAL_STEPS" "Ввод токена доступа"
# ══════════════════════════════════════════════════════════════════════════════

echo ""
gum style --foreground "$C_TITLE" --bold "  Что такое токен?"
gum style --foreground "$C_MUTED"        "  Это твой личный ключ доступа к файлам сайта."
gum style --foreground "$C_MUTED"        "  Ты получил его при покупке CraftCMS."
gum style --foreground "$C_MUTED"        "  Выглядит примерно так: ghp_xxxxxxxxxxxxxxxxxxxx"
echo ""
gum style --foreground "$C_WARN" "  Токен вводится один раз. После установки он нигде не сохраняется."
echo ""

GITHUB_TOKEN=""
GITHUB_REPO="struggler075/CraftCMS"

while true; do
  GITHUB_TOKEN=$(ask_input "ghp_xxxxxxxxxxxxxxxxxxxx" 70 "token › ") || exit 0
  GITHUB_TOKEN="${GITHUB_TOKEN// /}"

  if [[ -z "$GITHUB_TOKEN" ]]; then
    print_fail "Токен не может быть пустым. Попробуй ещё раз."
    continue
  fi
  if [[ ${#GITHUB_TOKEN} -lt 10 ]]; then
    print_fail "Слишком короткий токен. Проверь что скопировал его полностью."
    continue
  fi

  # Проверка токена — пишем результат в файл, так как gum spin прячет stdout
  rm -f /tmp/cms_http_code
  run_spin "Проверка токена на GitHub..." -- bash -c "
    curl -s -o /dev/null -w '%{http_code}' \
      -H 'Authorization: token ${GITHUB_TOKEN}' \
      'https://api.github.com/repos/${GITHUB_REPO}' \
      > /tmp/cms_http_code 2>/dev/null || echo '000' > /tmp/cms_http_code
  " || true
  HTTP_CODE=$(cat /tmp/cms_http_code 2>/dev/null || echo "000")
  rm -f /tmp/cms_http_code

  case "$HTTP_CODE" in
    200) print_ok "Токен действителен — доступ разрешён"; break ;;
    401|403)
      print_fail "Токен неверный или истёк."
      gum style --foreground "$C_MUTED" "    — Возможно опечатка (попробуй скопировать заново)"
      gum style --foreground "$C_MUTED" "    — Срок действия истёк (напиши нам, выдадим новый)"
      ;;
    404) print_fail "Репозиторий не найден. Токен не имеет доступа." ;;
    000) print_fail "Не удалось подключиться к GitHub. Проверь интернет." ;;
    *)   print_fail "Неизвестная ошибка (код: ${HTTP_CODE}). Попробуй снова." ;;
  esac
done

# ══════════════════════════════════════════════════════════════════════════════
print_step "3" "$TOTAL_STEPS" "Ввод настроек сайта"
# ══════════════════════════════════════════════════════════════════════════════

echo ""
gum style --foreground "$C_TITLE" --bold "  Домен или IP-адрес сервера"
gum style --foreground "$C_MUTED"        "  Если купил домен — вводи его (например: myserver.ru)"
gum style --foreground "$C_MUTED"        "  Если нет домена — вводи IP-адрес (например: 123.45.67.89)"
echo ""

while true; do
  SITE_DOMAIN=$(ask_input "myserver.ru или 123.45.67.89" 50 "domain › ") || exit 0
  SITE_DOMAIN="${SITE_DOMAIN// /}"
  SITE_DOMAIN="${SITE_DOMAIN,,}"
  SITE_DOMAIN="${SITE_DOMAIN#http://}"
  SITE_DOMAIN="${SITE_DOMAIN#https://}"
  SITE_DOMAIN="${SITE_DOMAIN%/}"
  if [[ -z "$SITE_DOMAIN" ]]; then
    print_fail "Нельзя оставить это поле пустым."
    continue
  fi
  break
done

# SSL только для домена
USE_SSL="n"
ADMIN_EMAIL=""
if ! [[ "$SITE_DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo ""
  gum style --foreground "$C_TITLE" --bold "  SSL-сертификат (замок в браузере)"
  gum style --foreground "$C_MUTED"        "  Сделает сайт защищённым (https://). Бесплатно через Let's Encrypt."
  gum style --foreground "$C_WARN"         "  Важно: домен должен уже указывать на этот сервер!"
  echo ""
  if ask_confirm "Установить SSL?"; then
    USE_SSL="y"
    echo ""
    gum style --foreground "$C_MUTED" "  Email для уведомлений от Let's Encrypt (когда сертификат истекает):"
    ADMIN_EMAIL=$(ask_input "your@email.com" 40 "email › ") || ADMIN_EMAIL=""
    [[ -z "$ADMIN_EMAIL" ]] && ADMIN_EMAIL="admin@${SITE_DOMAIN}"
  fi
fi

echo ""
gum style --foreground "$C_TITLE" --bold "  Пароль базы данных PostgreSQL"
gum style --foreground "$C_MUTED"        "  Будет использован только для подключения сайта к БД."
gum style --foreground "$C_MUTED"        "  Оставь поле пустым — сгенерируем сильный пароль автоматически."
echo ""

POSTGRES_PASSWORD=""
while true; do
  POSTGRES_PASSWORD=$(ask_input "Enter — сгенерировать автоматически" 60 "password › ") || POSTGRES_PASSWORD=""
  if [[ -z "$POSTGRES_PASSWORD" ]]; then
    POSTGRES_PASSWORD=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | cut -c1-32)
    print_ok "Сгенерирован пароль PostgreSQL длиной ${#POSTGRES_PASSWORD} символов"
    break
  fi
  if [[ ${#POSTGRES_PASSWORD} -lt 8 ]]; then
    print_fail "Пароль слишком короткий — минимум 8 символов. Попробуй снова."
    POSTGRES_PASSWORD=""
    continue
  fi
  # Запрещаем символы, ломающие YAML/cli-параметры без cюдой quoting
  if [[ "$POSTGRES_PASSWORD" =~ [\'\"\$\`\\] ]]; then
    print_fail "В пароле есть символы, которые могут испортить конфиг: ' \" \$ \` \\"
    print_fail "Используй буквы, цифры и обычные знаки препинания."
    POSTGRES_PASSWORD=""
    continue
  fi
  break
done

echo ""
gum style --foreground "$C_TITLE" --bold "  Итог:"
print_info "Адрес сайта:  ${SITE_DOMAIN}"
print_info "SSL:          $([ "$USE_SSL" = "y" ] && echo "да (https)" || echo "нет (http)")"
print_info "База данных:  PostgreSQL в Docker (порт 127.0.0.1:5432)"
echo ""

if ! ask_confirm "Всё верно? Начинаем установку?"; then
  echo ""
  gum style --foreground "$C_MUTED" "  Установка отменена. Запусти скрипт снова когда будешь готов."
  echo ""
  exit 0
fi

# ──────────────────────────────────────────────────────────────────────────────
INSTALL_DIR="/opt/craftcms"
SRC_DIR="/opt/craftcms-src"
BACKEND_PORT=8080
SERVICE_USER="craftcms"
JWT_SECRET=$(head -c 48 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | cut -c1-64)

# PostgreSQL (Docker) parameters
PG_CONTAINER="craftcms-postgres"
PG_VOLUME="craftcms-pgdata"
PG_DB="craftcms"
PG_USER="craftcms"
PG_PORT=5432
PG_IMAGE="postgres:16-alpine"

# ══════════════════════════════════════════════════════════════════════════════
print_step "4" "$TOTAL_STEPS" "Установка базовых утилит"
# ══════════════════════════════════════════════════════════════════════════════

run_spin "Обновление списка пакетов..." -- bash -c "apt-get update -qq 2>&1 >/dev/null"
print_ok "Список пакетов обновлён"

run_spin "Установка git, curl, nginx и других утилит..." -- bash -c "
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    git wget unzip nginx software-properties-common \
    apt-transport-https ufw 2>&1 >/dev/null
"
print_ok "Базовые утилиты установлены"

# ══════════════════════════════════════════════════════════════════════════════
print_step "5" "$TOTAL_STEPS" "Скачивание файлов сайта с GitHub"
# ══════════════════════════════════════════════════════════════════════════════

rm -rf "$SRC_DIR"

run_spin "Клонирование репозитория..." -- bash -c "
  git clone --depth=1 --quiet \
    'https://oauth2:${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git' \
    '$SRC_DIR' 2>/tmp/craftcms_git.log
" || {
  GIT_ERR=$(head -3 /tmp/craftcms_git.log 2>/dev/null)
  die "Не удалось скачать файлы с GitHub" \
      "Проверь токен и попробуй снова. Ошибка: ${GIT_ERR}"
}
print_ok "Файлы сайта успешно скачаны"

[[ ! -f "$SRC_DIR/backend/pom.xml" ]] && \
  die "Скачанные файлы повреждены — не найден backend" "Запусти скрипт снова."
[[ ! -f "$SRC_DIR/frontend/package.json" ]] && \
  die "Скачанные файлы повреждены — не найден frontend" "Запусти скрипт снова."
print_ok "Структура файлов проверена"

GITHUB_TOKEN="CLEARED"
unset GITHUB_TOKEN

# ══════════════════════════════════════════════════════════════════════════════
print_step "6" "$TOTAL_STEPS" "Установка Java 17"
# ══════════════════════════════════════════════════════════════════════════════

if java -version 2>&1 | grep -qE '"17|"21|"22|"23'; then
  print_ok "Java 17+ уже установлена — пропускаем"
else
  run_spin "Установка Java 17 (OpenJDK)... это ~2 минуты" -- bash -c "
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq openjdk-17-jdk 2>&1 >/dev/null
  " || die "Не удалось установить Java 17" "Попробуй вручную: apt-get install openjdk-17-jdk"
  print_ok "Java 17 установлена"
fi

JAVA_HOME_PATH=$(dirname "$(dirname "$(readlink -f "$(which java)")")")
print_info "Путь к Java: $JAVA_HOME_PATH"

# ══════════════════════════════════════════════════════════════════════════════
print_step "7" "$TOTAL_STEPS" "Установка Maven"
# ══════════════════════════════════════════════════════════════════════════════

MAVEN_VERSION="3.9.6"
MAVEN_DIR="/opt/maven"

if [[ -f "$MAVEN_DIR/bin/mvn" ]]; then
  print_ok "Maven уже установлен — пропускаем"
else
  run_spin "Скачивание Maven ${MAVEN_VERSION}..." -- \
    wget -q "https://archive.apache.org/dist/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz" \
    -O /tmp/maven.tar.gz || die "Не удалось скачать Maven" "Проверь интернет."
  print_ok "Maven скачан"

  run_spin "Распаковка Maven..." -- bash -c "
    tar -xzf /tmp/maven.tar.gz -C /opt/ 2>/dev/null
    mv '/opt/apache-maven-${MAVEN_VERSION}' '$MAVEN_DIR'
    rm -f /tmp/maven.tar.gz
  "
  print_ok "Maven распакован"

  cat > /etc/profile.d/maven.sh << 'MAVEN_PROFILE'
export M2_HOME=/opt/maven
export MAVEN_HOME=/opt/maven
export PATH=$M2_HOME/bin:$PATH
MAVEN_PROFILE
  chmod +x /etc/profile.d/maven.sh
fi

export M2_HOME="$MAVEN_DIR"
export PATH="$M2_HOME/bin:$PATH"
print_ok "Maven готов"

# ══════════════════════════════════════════════════════════════════════════════
print_step "8" "$TOTAL_STEPS" "Установка Node.js 20"
# ══════════════════════════════════════════════════════════════════════════════

if node --version 2>/dev/null | grep -qE 'v(2[0-9]|[3-9][0-9])\.'; then
  print_ok "Node.js $(node --version) уже установлен — пропускаем"
else
  run_spin "Добавление репозитория NodeSource..." -- bash -c "
    curl -fsSL https://deb.nodesource.com/setup_20.x 2>/dev/null | bash - 2>&1 >/dev/null
  " || die "Не удалось добавить репозиторий Node.js" "Проверь интернет."
  print_ok "Репозиторий NodeSource добавлен"

  run_spin "Установка Node.js 20... ~1 минута" -- bash -c "
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs 2>&1 >/dev/null
  " || die "Не удалось установить Node.js" "Попробуй вручную: apt-get install nodejs"
  print_ok "Node.js $(node --version) установлен"
fi

# ══════════════════════════════════════════════════════════════════════════════
print_step "9" "$TOTAL_STEPS" "Установка Docker и PostgreSQL"
# ══════════════════════════════════════════════════════════════════════════════

# --- Docker engine ---
if command -v docker &>/dev/null && docker info &>/dev/null; then
  print_ok "Docker уже установлен — пропускаем"
else
  run_spin "Установка Docker (~2-3 минуты)..." -- bash -c "
    curl -fsSL https://get.docker.com 2>/dev/null | sh 2>&1 >/tmp/craftcms_docker.log
  " || {
    tail -10 /tmp/craftcms_docker.log 2>/dev/null | sed 's/^/    /'
    die "Не удалось установить Docker" "Установи вручную: https://docs.docker.com/engine/install/"
  }
  systemctl enable --now docker 2>/dev/null >/dev/null || true
  print_ok "Docker установлен и запущен"
fi

# --- Если контейнер уже есть от прошлой установки — переиспользуем volume,
#     но пересоздаём контейнер с актуальным паролем ---
if docker ps -a --format '{{.Names}}' | grep -q "^${PG_CONTAINER}$"; then
  print_warn "Контейнер ${PG_CONTAINER} уже существует — пересоздаём с новым паролем"
  docker rm -f "$PG_CONTAINER" >/dev/null 2>&1 || true
fi

# Volume сохраняем — данные между переустановками не теряем
docker volume create "$PG_VOLUME" >/dev/null 2>&1 || true

# --- Запуск Postgres контейнера, биндим ТОЛЬКО на localhost ---
run_spin "Запуск PostgreSQL в Docker (порт 127.0.0.1:${PG_PORT})..." -- bash -c "
  docker run -d \
    --name '$PG_CONTAINER' \
    --restart unless-stopped \
    -e POSTGRES_USER='$PG_USER' \
    -e POSTGRES_PASSWORD='$POSTGRES_PASSWORD' \
    -e POSTGRES_DB='$PG_DB' \
    -p 127.0.0.1:${PG_PORT}:5432 \
    -v '$PG_VOLUME':/var/lib/postgresql/data \
    '$PG_IMAGE' \
    >/tmp/craftcms_pg.log 2>&1
" || {
  tail -10 /tmp/craftcms_pg.log 2>/dev/null | sed 's/^/    /'
  die "Не удалось запустить PostgreSQL" "Проверь логи: docker logs $PG_CONTAINER"
}
print_ok "PostgreSQL контейнер запущен"

# --- Ждём готовности БД (pg_isready внутри контейнера) ---
print_info "Ждём готовности PostgreSQL..."
PG_WAIT=0
PG_MAX_WAIT=60
while ! docker exec "$PG_CONTAINER" pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; do
  sleep 2
  PG_WAIT=$((PG_WAIT + 2))
  printf "\r  ${CYAN}⟳${NC}  Готовность БД... ${PG_WAIT}с / ${PG_MAX_WAIT}с"
  if [[ $PG_WAIT -ge $PG_MAX_WAIT ]]; then
    echo ""
    die "PostgreSQL не успел запуститься за ${PG_MAX_WAIT} секунд" \
        "Проверь: docker logs $PG_CONTAINER"
  fi
done
echo ""
print_ok "PostgreSQL готов к работе"

# ══════════════════════════════════════════════════════════════════════════════
print_step "10" "$TOTAL_STEPS" "Сборка серверной части (Backend)"
# ══════════════════════════════════════════════════════════════════════════════

echo ""
print_info "Maven скачает библиотеки и скомпилирует сервер."
print_info "При первом запуске это занимает 5–10 минут — это нормально."
echo ""

mkdir -p "$INSTALL_DIR"/{uploads,logs,frontend}
cd "$SRC_DIR/backend"

run_spin "Компиляция Backend (5–10 мин)..." -- bash -c "
  JAVA_HOME='$JAVA_HOME_PATH' '$M2_HOME/bin/mvn' clean package -DskipTests -q \
    2>&1 | tee /tmp/craftcms_mvn.log >/dev/null
" || {
  echo ""
  gum style --foreground "$C_ERR" "  Ошибка сборки. Последние строки лога:"
  tail -20 /tmp/craftcms_mvn.log | sed 's/^/    /'
  die "Не удалось скомпилировать серверную часть" \
      "Сохрани /tmp/craftcms_mvn.log и отправь нам."
}
print_ok "Backend успешно собран"

JAR_FILE=$(ls target/craftcms-backend-*.jar 2>/dev/null | head -1)
[[ -z "$JAR_FILE" ]] && die "JAR-файл не найден после сборки" "Отправь /tmp/craftcms_mvn.log"

cp "$JAR_FILE" "$INSTALL_DIR/craftcms.jar"
print_ok "Файл сервера скопирован"
cd /

# Собираем BridgePlugin если есть
if [[ -f "$SRC_DIR/BridgePlugin/pom.xml" ]]; then
  cd "$SRC_DIR/BridgePlugin"
  if run_spin "Сборка BridgePlugin..." -- bash -c "
    JAVA_HOME='$JAVA_HOME_PATH' '$M2_HOME/bin/mvn' clean package -DskipTests -q \
      2>&1 | tee /tmp/craftcms_bridge.log >/dev/null
  "; then
    BRIDGE_JAR=$(ls target/*.jar 2>/dev/null | grep -v 'original' | head -1)
    if [[ -n "$BRIDGE_JAR" ]]; then
      cp "$BRIDGE_JAR" "$INSTALL_DIR/BridgePlugin.jar"
      print_ok "BridgePlugin.jar собран и скопирован"
    fi
  else
    print_warn "BridgePlugin не собрался — пропускаем (не критично)"
  fi
  cd /
fi

# Конфиг бэкенда — production-профиль с PostgreSQL
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
print_ok "Конфигурация сервера записана (PostgreSQL, профиль prod)"

# ══════════════════════════════════════════════════════════════════════════════
print_step "11" "$TOTAL_STEPS" "Сборка визуальной части (Frontend)"
# ══════════════════════════════════════════════════════════════════════════════

cd "$SRC_DIR/frontend"

run_spin "Установка npm-зависимостей..." -- bash -c "npm install --silent 2>/dev/null" || \
  die "Ошибка npm install" "Проверь интернет и попробуй снова."
print_ok "Зависимости установлены"

run_spin "Сборка сайта (npm run build)..." -- bash -c "
  npm run build 2>&1 >/tmp/craftcms_npm.log
" || {
  echo ""
  gum style --foreground "$C_ERR" "  Ошибка сборки фронтенда. Последние строки:"
  tail -10 /tmp/craftcms_npm.log | sed 's/^/    /'
  die "Не удалось собрать визуальную часть сайта" "Отправь /tmp/craftcms_npm.log"
}
print_ok "Визуальная часть собрана"

run_spin "Копирование файлов сайта..." -- bash -c "
  rm -rf '$INSTALL_DIR/frontend/'*
  cp -r dist/* '$INSTALL_DIR/frontend/'
"
print_ok "Файлы скопированы"
cd /

# ══════════════════════════════════════════════════════════════════════════════
print_step "12" "$TOTAL_STEPS" "Настройка автозапуска и прав"
# ══════════════════════════════════════════════════════════════════════════════

if ! id "$SERVICE_USER" &>/dev/null; then
  useradd -r -s /bin/false -d "$INSTALL_DIR" "$SERVICE_USER" 2>/dev/null
  print_ok "Системный пользователь '$SERVICE_USER' создан"
else
  print_ok "Системный пользователь '$SERVICE_USER' уже существует"
fi

chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
# Корень должен быть проходимым для nginx (www-data)
chmod 755 "$INSTALL_DIR"
# Что читает nginx — должно быть доступно
chmod -R 755 "$INSTALL_DIR/frontend"
chmod 755 "$INSTALL_DIR/uploads"
# Приватная директория с логами — только craftcms
chmod 750 "$INSTALL_DIR/logs"
# Конфиг с секретами (JWT, пароль БД)
chmod 600 "$INSTALL_DIR/application.yml"
print_ok "Права доступа выставлены"

cat > /etc/systemd/system/craftcms.service << SYSTEMD
[Unit]
Description=CraftCMS — Minecraft Server Website
Documentation=https://github.com/${GITHUB_REPO}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}

ExecStart=${JAVA_HOME_PATH}/bin/java \\
  -Xms256m -Xmx512m \\
  -XX:+UseG1GC \\
  -Dspring.config.location=${INSTALL_DIR}/application.yml \\
  -jar ${INSTALL_DIR}/craftcms.jar

Restart=on-failure
RestartSec=15
StandardOutput=append:${INSTALL_DIR}/logs/craftcms.log
StandardError=append:${INSTALL_DIR}/logs/craftcms-error.log
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable craftcms 2>/dev/null
print_ok "Автозапуск настроен"

# ══════════════════════════════════════════════════════════════════════════════
print_step "13" "$TOTAL_STEPS" "Настройка Nginx и запуск"
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

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2|woff|ttf)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }
}
NGINXCONF

ln -sf /etc/nginx/sites-available/craftcms /etc/nginx/sites-enabled/craftcms

nginx -t 2>/dev/null || die "Ошибка в конфигурации Nginx" "Запусти: nginx -t"
print_ok "Nginx настроен"

run_spin "Настройка файрвола (порты 80 и 443)..." -- bash -c "
  ufw allow OpenSSH 2>/dev/null >/dev/null || true
  ufw allow 'Nginx Full' 2>/dev/null >/dev/null || true
  status=\$(ufw status 2>/dev/null | head -1)
  if [[ \"\$status\" == *inactive* ]]; then
    ufw --force enable 2>/dev/null >/dev/null || true
  fi
"
print_ok "Файрвол настроен"

run_spin "Запуск Nginx..." -- bash -c "
  systemctl enable nginx 2>/dev/null
  systemctl restart nginx 2>/dev/null
"
print_ok "Nginx запущен"

run_spin "Запуск CraftCMS (Java сервер)..." -- \
  systemctl start craftcms
print_ok "CraftCMS запускается..."

# SSL
if [[ "$USE_SSL" == "y" ]]; then
  echo ""
  run_spin "Установка Certbot (SSL)..." -- bash -c "
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot python3-certbot-nginx 2>&1 >/dev/null
  "
  print_ok "Certbot установлен"

  if run_spin "Получение SSL-сертификата для ${SITE_DOMAIN}..." -- bash -c "
    certbot --nginx -d '$SITE_DOMAIN' \
      --non-interactive --agree-tos \
      --email '${ADMIN_EMAIL:-admin@${SITE_DOMAIN}}' \
      --redirect 2>&1 >/tmp/certbot.log
  "; then
    print_ok "SSL-сертификат установлен — сайт будет работать по https://"
  else
    print_warn "SSL не удалось настроить автоматически."
    print_warn "Убедись что домен ${SITE_DOMAIN} указывает на этот сервер."
  fi

  (crontab -l 2>/dev/null | grep -v certbot; echo "0 3 * * * certbot renew --quiet") | crontab -
  print_ok "Автообновление SSL добавлено (каждую ночь в 3:00)"
fi

# Ждём Spring Boot
echo ""
print_info "Ждём запуска Java сервера (20–40 секунд)..."
MAX_WAIT=90
WAITED=0
while ! curl -s "http://127.0.0.1:${BACKEND_PORT}/api/health" >/dev/null 2>&1; do
  sleep 3
  WAITED=$((WAITED + 3))
  printf "\r  ${CYAN}⟳${NC}  Ждём... ${WAITED}с / ${MAX_WAIT}с"
  if [[ $WAITED -ge $MAX_WAIT ]]; then
    echo ""
    print_warn "Сервер не ответил за ${MAX_WAIT}с — возможно нужно больше времени."
    print_warn "Проверь статус через 1 минуту: systemctl status craftcms"
    break
  fi
done
[[ $WAITED -lt $MAX_WAIT ]] && { printf "\r"; print_ok "Сервер запущен и отвечает!"; }

rm -rf "$SRC_DIR"

# Wipe DB password from this shell's memory — it now lives only in
# /opt/craftcms/application.yml (chmod 600) and in the Docker container env.
POSTGRES_PASSWORD="CLEARED"
unset POSTGRES_PASSWORD

# ──────────────────────────────────────────────────────────────────────────────
#  ИТОГОВАЯ СВОДКА (через gum)
# ──────────────────────────────────────────────────────────────────────────────
PROTO="http"
[[ "$USE_SSL" == "y" ]] && PROTO="https"

echo ""
echo ""
gum style \
  --border double --border-foreground "$C_OK" \
  --padding "1 4" --margin "0 2" --align center --bold \
  --foreground "$C_TITLE" \
  "✓   CraftCMS успешно установлена!"
echo ""

gum style --foreground "$C_TITLE" --bold "  ДОСТУП"
gum style --foreground "$C_MUTED"        "  ──────────────────────────────────────────"
gum style "  Сайт:    $(gum style --foreground "$C_INFO" --bold "${PROTO}://${SITE_DOMAIN}")"
gum style "  Админка: $(gum style --foreground "$C_INFO" --bold "${PROTO}://${SITE_DOMAIN}/admin")"
echo ""

gum style --foreground "$C_TITLE" --bold "  ДАННЫЕ ДЛЯ ВХОДА"
gum style --foreground "$C_MUTED"        "  ──────────────────────────────────────────"
gum style "  Логин:   $(gum style --foreground "$C_WARN" --bold 'admin')"
gum style "  Пароль:  $(gum style --foreground "$C_WARN" --bold 'Admin123!')"
echo ""
gum style --foreground "$C_ERR" --bold "  ⚠  СРАЗУ ПОСЛЕ ВХОДА СМЕНИ ПАРОЛЬ В ПРОФИЛЕ!"
echo ""

gum style --foreground "$C_TITLE" --bold "  УПРАВЛЕНИЕ"
gum style --foreground "$C_MUTED"        "  ──────────────────────────────────────────"
gum style "  Статус сайта:    $(gum style --foreground "$C_INFO" 'systemctl status craftcms')"
gum style "  Перезапуск:      $(gum style --foreground "$C_INFO" 'systemctl restart craftcms')"
gum style "  Остановить:      $(gum style --foreground "$C_INFO" 'systemctl stop craftcms')"
gum style "  Логи сайта:      $(gum style --foreground "$C_INFO" 'journalctl -u craftcms -f')"
gum style "  Статус БД:       $(gum style --foreground "$C_INFO" "docker ps -f name=${PG_CONTAINER}")"
gum style "  Логи БД:         $(gum style --foreground "$C_INFO" "docker logs -f ${PG_CONTAINER}")"
gum style "  Дамп БД:         $(gum style --foreground "$C_INFO" "docker exec ${PG_CONTAINER} pg_dump -U ${PG_USER} ${PG_DB}")"
gum style "  Обновить сайт:   $(gum style --foreground "$C_INFO" 'bash update.sh')"
echo ""

gum style --foreground "$C_TITLE" --bold "  ФАЙЛЫ"
gum style --foreground "$C_MUTED"        "  ──────────────────────────────────────────"
gum style --foreground "$C_MUTED" "  ${INSTALL_DIR}/                  (основная директория)"
gum style --foreground "$C_MUTED" "  ${INSTALL_DIR}/uploads/          (загруженные файлы)"
gum style --foreground "$C_MUTED" "  ${INSTALL_DIR}/logs/             (логи работы)"
gum style --foreground "$C_MUTED" "  ${INSTALL_DIR}/application.yml   (конфиг — содержит пароль БД, chmod 600)"
gum style --foreground "$C_MUTED" "  docker volume ${PG_VOLUME}       (данные PostgreSQL)"
echo ""

gum style --foreground "$C_MUTED" "  Если что-то не работает — пришли нам вывод:"
gum style --foreground "$C_INFO"  "    journalctl -u craftcms -n 50 --no-pager"
echo ""
echo ""
