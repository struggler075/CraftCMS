#!/bin/bash
# ==============================================================================
#  CraftCMS — Установщик
#  Достаточно запустить этот файл — больше ничего делать не нужно.
# ==============================================================================

# Если что-то пойдёт не так — скрипт остановится и скажет что именно
set -euo pipefail

# ── Цвета для красивого вывода ─────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # сброс цвета

# ── Вспомогательные функции вывода ─────────────────────────────────────────
print_ok()    { echo -e "  ${GREEN}✓${NC}  $*"; }
print_fail()  { echo -e "  ${RED}✗${NC}  $*"; }
print_info()  { echo -e "  ${CYAN}→${NC}  $*"; }
print_warn()  { echo -e "  ${YELLOW}!${NC}  $*"; }

print_step() {
  local num="$1"; local total="$2"; local msg="$3"
  echo ""
  echo -e "${BOLD}${BLUE}┌─────────────────────────────────────────────────────────┐${NC}"
  echo -e "${BOLD}${BLUE}│  Шаг ${num} из ${total}: ${msg}$(printf '%*s' $((47 - ${#msg} - ${#num} - ${#total})) '')│${NC}"
  echo -e "${BOLD}${BLUE}└─────────────────────────────────────────────────────────┘${NC}"
}

print_box() {
  local msg="$1"
  local len=${#msg}
  local border=$(printf '─%.0s' $(seq 1 $((len + 4))))
  echo ""
  echo -e "${BOLD}${MAGENTA}  ┌${border}┐${NC}"
  echo -e "${BOLD}${MAGENTA}  │  ${WHITE}${msg}${MAGENTA}  │${NC}"
  echo -e "${BOLD}${MAGENTA}  └${border}┘${NC}"
  echo ""
}

# Спиннер — показывает что скрипт работает (а не завис)
SPIN_PID=""
spin_start() {
  local msg="$1"
  printf "  ${CYAN}⟳${NC}  ${msg}"
  (
    i=0
    chars="⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
    while true; do
      printf "\r  ${CYAN}${chars:$((i % 10)):1}${NC}  ${msg}"
      sleep 0.1
      ((i++)) || true
    done
  ) &
  SPIN_PID=$!
  disown $SPIN_PID 2>/dev/null || true
}

spin_stop() {
  local msg="$1"
  if [[ -n "$SPIN_PID" ]]; then
    kill "$SPIN_PID" 2>/dev/null || true
    wait "$SPIN_PID" 2>/dev/null || true
    SPIN_PID=""
  fi
  printf "\r"
  print_ok "$msg"
}

# Функция для критической ошибки — объясняет что делать
die() {
  echo ""
  echo -e "${RED}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}${BOLD}  ОШИБКА: $1${NC}"
  echo -e "${RED}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  if [[ -n "${2:-}" ]]; then
    echo ""
    echo -e "${YELLOW}  Что делать:${NC}"
    echo -e "${YELLOW}  $2${NC}"
  fi
  echo ""
  echo -e "${DIM}  Если не можешь разобраться — напиши нам, мы поможем.${NC}"
  echo ""
  exit 1
}

# ──────────────────────────────────────────────────────────────────────────────
#  БАННЕР
# ──────────────────────────────────────────────────────────────────────────────
clear
echo ""
echo -e "${BOLD}${MAGENTA}"
echo "  ██████╗██████╗  █████╗ ███████╗████████╗ ██████╗███╗   ███╗███████╗"
echo " ██╔════╝██╔══██╗██╔══██╗██╔════╝╚══██╔══╝██╔════╝████╗ ████║██╔════╝"
echo " ██║     ██████╔╝███████║█████╗     ██║   ██║     ██╔████╔██║███████╗ "
echo " ██║     ██╔══██╗██╔══██║██╔══╝     ██║   ██║     ██║╚██╔╝██║╚════██║"
echo " ╚██████╗██║  ██║██║  ██║██║        ██║   ╚██████╗██║ ╚═╝ ██║███████║"
echo "  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝        ╚═╝    ╚═════╝╚═╝     ╚═╝╚══════╝"
echo -e "${NC}"
echo -e "  ${BOLD}${WHITE}Автоматический установщик${NC}  ${DIM}— ты вводишь токен, мы делаем всё остальное${NC}"
echo -e "  ${DIM}──────────────────────────────────────────────────────────────────${NC}"
echo ""
echo -e "  ${CYAN}Этот скрипт сам установит всё необходимое:${NC}"
echo -e "  ${DIM}  Java 17, Node.js, Maven, Nginx, сайт, и запустит всё автоматически${NC}"
echo ""
echo -e "  ${YELLOW}Время установки: ~5–15 минут (зависит от скорости сервера)${NC}"
echo ""

# Пауза чтобы пользователь прочитал
sleep 2

# ──────────────────────────────────────────────────────────────────────────────
#  ШАГИ: всего 12
# ──────────────────────────────────────────────────────────────────────────────
TOTAL_STEPS=12

# ══════════════════════════════════════════════════════════════════════════════
print_step "1" "$TOTAL_STEPS" "Проверка системы"
# ══════════════════════════════════════════════════════════════════════════════

# --- Проверка: запущен ли от root ---
if [[ $EUID -ne 0 ]]; then
  die \
    "Скрипт нужно запускать от имени администратора (root)" \
    "Напиши команду:  sudo bash install.sh"
fi
print_ok "Права администратора есть"

# --- Проверка ОС ---
if [[ ! -f /etc/os-release ]]; then
  die "Не удаётся определить операционную систему" \
      "Убедись что у тебя Ubuntu 20/22/24 или Debian 11/12"
fi
. /etc/os-release
OS_NAME="${PRETTY_NAME:-$ID}"

case "${ID:-}" in
  ubuntu|debian)
    print_ok "Операционная система: ${OS_NAME}"
    ;;
  *)
    die \
      "Операционная система '${OS_NAME}' не поддерживается" \
      "Установи Ubuntu 22.04 и попробуй снова. Это самый популярный выбор для VPS."
    ;;
esac

# --- Проверка интернета ---
spin_start "Проверка подключения к интернету"
if ! curl -s --connect-timeout 10 https://github.com > /dev/null 2>&1; then
  spin_stop "нет интернета" || true
  die \
    "Нет подключения к интернету" \
    "Проверь настройки сети у своего хостинг-провайдера. Интернет обязателен для установки."
fi
spin_stop "Интернет есть, всё отлично"

# --- Проверка свободного места на диске ---
FREE_GB=$(df -BG / | awk 'NR==2 {gsub("G",""); print $4}')
if [[ "$FREE_GB" -lt 3 ]]; then
  die \
    "Мало свободного места на диске: ${FREE_GB}GB (нужно минимум 3GB)" \
    "Освободи место на диске или возьми VPS с большим диском."
fi
print_ok "Свободного места на диске: ${FREE_GB}GB"

# --- Проверка оперативной памяти ---
FREE_RAM_MB=$(free -m | awk 'NR==2{print $7}')
if [[ "$FREE_RAM_MB" -lt 400 ]]; then
  print_warn "Мало оперативной памяти: ${FREE_RAM_MB}MB. Рекомендуется минимум 1GB."
  print_warn "Установка продолжится, но сайт может работать медленно."
  sleep 3
else
  print_ok "Оперативная память: ${FREE_RAM_MB}MB свободно"
fi

# --- Проверка порта 80 ---
if ss -tlnp 2>/dev/null | grep -q ':80 ' || netstat -tlnp 2>/dev/null | grep -q ':80 '; then
  print_warn "Порт 80 уже занят каким-то другим процессом"
  print_warn "Скрипт попробует освободить его автоматически..."
  systemctl stop apache2 2>/dev/null || true
  systemctl stop lighttpd 2>/dev/null || true
fi

# ══════════════════════════════════════════════════════════════════════════════
print_step "2" "$TOTAL_STEPS" "Ввод токена доступа"
# ══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "  ${BOLD}${WHITE}Что такое токен?${NC}"
echo -e "  ${DIM}Это твой личный ключ доступа к файлам сайта.${NC}"
echo -e "  ${DIM}Ты получил его при покупке CraftCMS.${NC}"
echo -e "  ${DIM}Выглядит примерно так: ghp_xxxxxxxxxxxxxxxxxxxx${NC}"
echo ""
echo -e "  ${YELLOW}Токен вводится один раз. После установки он нигде не сохраняется.${NC}"
echo ""

GITHUB_TOKEN=""
GITHUB_REPO="struggler075/CMSMinecraft"

while true; do
  echo -ne "  ${BOLD}${MAGENTA}Введи токен доступа и нажми Enter:${NC}  "
  read -r GITHUB_TOKEN

  # Убираем пробелы если случайно скопировал с пробелом
  GITHUB_TOKEN="${GITHUB_TOKEN// /}"

  if [[ -z "$GITHUB_TOKEN" ]]; then
    print_fail "Токен не может быть пустым. Попробуй ещё раз."
    continue
  fi

  if [[ ${#GITHUB_TOKEN} -lt 10 ]]; then
    print_fail "Слишком короткий токен. Проверь что скопировал его полностью."
    continue
  fi

  # Проверяем токен — пробуем получить доступ к репозиторию
  echo ""
  spin_start "Проверка токена на GitHub"
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: token ${GITHUB_TOKEN}" \
    "https://api.github.com/repos/${GITHUB_REPO}" 2>/dev/null || echo "000")

  if [[ "$HTTP_CODE" == "200" ]]; then
    spin_stop "Токен действителен — доступ разрешён"
    break
  elif [[ "$HTTP_CODE" == "401" || "$HTTP_CODE" == "403" ]]; then
    print_fail "Токен неверный или истёк."
    echo ""
    echo -e "  ${YELLOW}Возможные причины:${NC}"
    echo -e "  ${DIM}  — Ты ввёл токен с опечаткой (попробуй скопировать заново)${NC}"
    echo -e "  ${DIM}  — Срок действия токена истёк (напиши нам, выдадим новый)${NC}"
    echo ""
  elif [[ "$HTTP_CODE" == "404" ]]; then
    print_fail "Репозиторий не найден. Токен не имеет доступа к CraftCMS."
    echo -e "  ${YELLOW}Напиши нам — проверим права токена.${NC}"
    echo ""
  elif [[ "$HTTP_CODE" == "000" ]]; then
    print_fail "Не удалось подключиться к GitHub. Проверь интернет и попробуй снова."
    echo ""
  else
    print_fail "Неизвестная ошибка (код: ${HTTP_CODE}). Попробуй снова."
    echo ""
  fi
done

# ══════════════════════════════════════════════════════════════════════════════
print_step "3" "$TOTAL_STEPS" "Ввод настроек сайта"
# ══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "  ${BOLD}${WHITE}Домен или IP-адрес сервера${NC}"
echo -e "  ${DIM}Это адрес по которому будет открываться твой сайт.${NC}"
echo ""
echo -e "  ${DIM}  Если купил домен (например myserver.ru) — вводи его.${NC}"
echo -e "  ${DIM}  Если нет домена — вводи IP-адрес сервера (например 123.45.67.89).${NC}"
echo -e "  ${DIM}  IP-адрес обычно дают при покупке VPS.${NC}"
echo ""

while true; do
  echo -ne "  ${BOLD}${MAGENTA}Домен или IP:${NC}  "
  read -r SITE_DOMAIN
  SITE_DOMAIN="${SITE_DOMAIN// /}"
  SITE_DOMAIN="${SITE_DOMAIN,,}" # нижний регистр
  SITE_DOMAIN="${SITE_DOMAIN#http://}"
  SITE_DOMAIN="${SITE_DOMAIN#https://}"
  SITE_DOMAIN="${SITE_DOMAIN%/}"

  if [[ -z "$SITE_DOMAIN" ]]; then
    print_fail "Нельзя оставить это поле пустым."
    continue
  fi
  break
done

# Предложить SSL только если не IP
USE_SSL="n"
if ! [[ "$SITE_DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo ""
  echo -e "  ${BOLD}${WHITE}SSL-сертификат (замок в браузере)${NC}"
  echo -e "  ${DIM}Делает сайт защищённым (https://). Бесплатно через Let's Encrypt.${NC}"
  echo -e "  ${YELLOW}  Важно: домен должен уже указывать на этот сервер!${NC}"
  echo -e "  ${DIM}  Если не уверен — выбери 'n', SSL можно добавить потом.${NC}"
  echo ""
  echo -ne "  ${BOLD}${MAGENTA}Установить SSL? [y/N]:${NC}  "
  read -r _ssl
  [[ "${_ssl,,}" == "y" ]] && USE_SSL="y"
fi

if [[ "$USE_SSL" == "y" ]]; then
  echo ""
  echo -e "  ${DIM}Email нужен только для уведомлений от Let's Encrypt (например, когда сертификат скоро истечёт).${NC}"
  echo -ne "  ${BOLD}${MAGENTA}Твой email:${NC}  "
  read -r ADMIN_EMAIL
  [[ -z "$ADMIN_EMAIL" ]] && ADMIN_EMAIL="admin@${SITE_DOMAIN}"
fi

echo ""
echo -e "  ${BOLD}Итог:${NC}"
print_info "Адрес сайта:  ${SITE_DOMAIN}"
print_info "SSL:          $([ "$USE_SSL" = "y" ] && echo "да (https)" || echo "нет (http)")"
echo ""
echo -ne "  ${BOLD}${MAGENTA}Всё верно? Начинаем установку? [Y/n]:${NC}  "
read -r _confirm
if [[ "${_confirm,,}" == "n" ]]; then
  echo ""
  echo -e "  Установка отменена. Запусти скрипт снова когда будешь готов."
  echo ""
  exit 0
fi

# ──────────────────────────────────────────────────────────────────────────────
# Все настройки готовы — начинаем тихую установку
# ──────────────────────────────────────────────────────────────────────────────

INSTALL_DIR="/opt/craftcms"
SRC_DIR="/opt/craftcms-src"
BACKEND_PORT=8080
SERVICE_USER="craftcms"
JWT_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9!@#$%' | head -c 64)

# ══════════════════════════════════════════════════════════════════════════════
print_step "4" "$TOTAL_STEPS" "Установка базовых утилит"
# ══════════════════════════════════════════════════════════════════════════════

spin_start "Обновление списка пакетов"
apt-get update -qq 2>&1 >/dev/null
spin_stop "Список пакетов обновлён"

spin_start "Установка git, curl, nginx и других утилит"
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  git curl wget gnupg2 ca-certificates unzip nginx \
  software-properties-common apt-transport-https \
  ufw 2>&1 >/dev/null
spin_stop "Базовые утилиты установлены"

# ══════════════════════════════════════════════════════════════════════════════
print_step "5" "$TOTAL_STEPS" "Скачивание файлов сайта с GitHub"
# ══════════════════════════════════════════════════════════════════════════════

echo ""
print_info "Это может занять 1–2 минуты — скачиваем все файлы сайта..."
echo ""

# Удаляем старую версию если есть
rm -rf "$SRC_DIR"

spin_start "Клонирование репозитория"
if ! git clone \
  --depth=1 \
  --quiet \
  "https://oauth2:${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git" \
  "$SRC_DIR" 2>&1 >/tmp/craftcms_git.log; then

  GIT_ERR=$(cat /tmp/craftcms_git.log 2>/dev/null | head -3)
  die \
    "Не удалось скачать файлы с GitHub" \
    "Проверь токен и попробуй снова. Ошибка: ${GIT_ERR}"
fi
spin_stop "Файлы сайта успешно скачаны"

# Проверяем что скачалось то что нужно
[[ ! -f "$SRC_DIR/backend/pom.xml" ]] && \
  die "Скачанные файлы повреждены — не найден backend" "Запусти скрипт снова."
[[ ! -f "$SRC_DIR/frontend/package.json" ]] && \
  die "Скачанные файлы повреждены — не найден frontend" "Запусти скрипт снова."

print_ok "Структура файлов проверена — всё в порядке"

# Очищаем токен из памяти — больше не нужен
GITHUB_TOKEN="CLEARED"
unset GITHUB_TOKEN

# ══════════════════════════════════════════════════════════════════════════════
print_step "6" "$TOTAL_STEPS" "Установка Java 17"
# ══════════════════════════════════════════════════════════════════════════════

echo ""
print_info "Java — это движок на котором работает сервер сайта."
print_info "Без неё сайт не запустится."
echo ""

JAVA_OK=false
if java -version 2>&1 | grep -qE '"17|"21|"22|"23'; then
  print_ok "Java 17+ уже установлена — пропускаем"
  JAVA_OK=true
fi

if [[ "$JAVA_OK" == "false" ]]; then
  spin_start "Установка Java 17 (OpenJDK)  — это займёт ~2 минуты"
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq openjdk-17-jdk 2>&1 >/dev/null || \
    die "Не удалось установить Java 17" \
        "Попробуй вручную: apt-get install openjdk-17-jdk"
  spin_stop "Java 17 установлена"
fi

JAVA_HOME_PATH=$(dirname "$(dirname "$(readlink -f "$(which java)")")")
print_info "Путь к Java: $JAVA_HOME_PATH"

# ══════════════════════════════════════════════════════════════════════════════
print_step "7" "$TOTAL_STEPS" "Установка Maven (сборщик Java)"
# ══════════════════════════════════════════════════════════════════════════════

echo ""
print_info "Maven скачивает зависимости и собирает JAR-файл сервера."
echo ""

MAVEN_VERSION="3.9.6"
MAVEN_DIR="/opt/maven"

if [[ -f "$MAVEN_DIR/bin/mvn" ]]; then
  print_ok "Maven уже установлен — пропускаем"
else
  spin_start "Скачивание Maven ${MAVEN_VERSION}"
  wget -q "https://archive.apache.org/dist/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz" \
    -O /tmp/maven.tar.gz 2>/dev/null || \
    die "Не удалось скачать Maven" "Проверь интернет и попробуй снова."
  spin_stop "Maven скачан"

  spin_start "Распаковка Maven"
  tar -xzf /tmp/maven.tar.gz -C /opt/ 2>/dev/null
  mv "/opt/apache-maven-${MAVEN_VERSION}" "$MAVEN_DIR"
  rm -f /tmp/maven.tar.gz
  spin_stop "Maven распакован"

  # Добавляем Maven в PATH для всей системы
  cat > /etc/profile.d/maven.sh << 'MAVEN_PROFILE'
export M2_HOME=/opt/maven
export MAVEN_HOME=/opt/maven
export PATH=$M2_HOME/bin:$PATH
MAVEN_PROFILE
  chmod +x /etc/profile.d/maven.sh
fi

export M2_HOME="$MAVEN_DIR"
export PATH="$M2_HOME/bin:$PATH"
print_ok "Maven готов: $($M2_HOME/bin/mvn -v 2>/dev/null | head -1)"

# ══════════════════════════════════════════════════════════════════════════════
print_step "8" "$TOTAL_STEPS" "Установка Node.js 20"
# ══════════════════════════════════════════════════════════════════════════════

echo ""
print_info "Node.js нужен чтобы собрать визуальную часть сайта (фронтенд)."
echo ""

if node --version 2>/dev/null | grep -qE 'v(2[0-9]|[3-9][0-9])\.'; then
  print_ok "Node.js $(node --version) уже установлен — пропускаем"
else
  spin_start "Добавление репозитория NodeSource"
  curl -fsSL https://deb.nodesource.com/setup_20.x 2>/dev/null | bash - 2>&1 >/dev/null || \
    die "Не удалось добавить репозиторий Node.js" "Проверь интернет."
  spin_stop "Репозиторий NodeSource добавлен"

  spin_start "Установка Node.js 20  — ~1 минута"
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs 2>&1 >/dev/null || \
    die "Не удалось установить Node.js" "Попробуй вручную: apt-get install nodejs"
  spin_stop "Node.js $(node --version) установлен"
fi

# ══════════════════════════════════════════════════════════════════════════════
print_step "9" "$TOTAL_STEPS" "Сборка серверной части (Backend)"
# ══════════════════════════════════════════════════════════════════════════════

echo ""
print_info "Сейчас Maven скачает нужные библиотеки и скомпилирует сервер."
print_info "При первом запуске это может занять 5–10 минут — это нормально!"
print_info "Просто подожди, не закрывай консоль."
echo ""

mkdir -p "$INSTALL_DIR"/{data,uploads,logs,frontend}

cd "$SRC_DIR/backend"

spin_start "Компиляция Backend (5–10 мин при первом запуске)"
JAVA_HOME="$JAVA_HOME_PATH" \
  "$M2_HOME/bin/mvn" clean package -DskipTests -q \
  2>&1 | tee /tmp/craftcms_mvn.log >/dev/null || {
  echo ""
  echo -e "${RED}  Ошибка сборки. Последние строки лога:${NC}"
  tail -20 /tmp/craftcms_mvn.log | sed 's/^/    /'
  die \
    "Не удалось скомпилировать серверную часть" \
    "Сохрани файл /tmp/craftcms_mvn.log и отправь нам — мы разберёмся."
}
spin_stop "Backend успешно собран"

JAR_FILE=$(ls target/craftcms-backend-*.jar 2>/dev/null | head -1)
[[ -z "$JAR_FILE" ]] && \
  die "JAR-файл не найден после сборки" "Отправь нам лог /tmp/craftcms_mvn.log"

cp "$JAR_FILE" "$INSTALL_DIR/craftcms.jar"
print_ok "Файл сервера скопирован в $INSTALL_DIR/craftcms.jar"

cd /

# Копируем BridgePlugin если есть
if ls "$SRC_DIR/BridgePlugin/target/"*.jar 1>/dev/null 2>&1; then
  cp "$SRC_DIR/BridgePlugin/target/"*.jar "$INSTALL_DIR/BridgePlugin.jar"
  print_ok "BridgePlugin.jar скопирован"
fi

# Генерируем конфиг бэкенда
cat > "$INSTALL_DIR/application.yml" << APPYML
server:
  port: ${BACKEND_PORT}

spring:
  application:
    name: craftcms-backend
  datasource:
    url: jdbc:h2:file:${INSTALL_DIR}/data/craftcms;DB_CLOSE_ON_EXIT=FALSE
    driver-class-name: org.h2.Driver
    username: sa
    password: craftcms_db_$(cat /dev/urandom | tr -dc 'a-z0-9' | head -c 12)
  h2:
    console:
      enabled: false
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: false
    properties:
      hibernate:
        dialect: org.hibernate.dialect.H2Dialect
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
print_ok "Конфигурация сервера записана"

# ══════════════════════════════════════════════════════════════════════════════
print_step "10" "$TOTAL_STEPS" "Сборка визуальной части (Frontend)"
# ══════════════════════════════════════════════════════════════════════════════

echo ""
print_info "Собираем то что видит пользователь — страницы сайта, магазин, донат и т.д."
echo ""

cd "$SRC_DIR/frontend"

spin_start "Установка npm-зависимостей"
npm install --silent 2>/dev/null || \
  die "Ошибка npm install" "Проверь интернет и попробуй снова."
spin_stop "Зависимости установлены"

spin_start "Сборка сайта (npm run build)"
npm run build 2>&1 >/tmp/craftcms_npm.log || {
  echo ""
  echo -e "${RED}  Ошибка сборки фронтенда. Последние строки:${NC}"
  tail -10 /tmp/craftcms_npm.log | sed 's/^/    /'
  die "Не удалось собрать визуальную часть сайта" \
      "Отправь нам лог /tmp/craftcms_npm.log — разберёмся вместе."
}
spin_stop "Визуальная часть собрана"

spin_start "Копирование файлов сайта"
rm -rf "$INSTALL_DIR/frontend/"*
cp -r dist/* "$INSTALL_DIR/frontend/"
spin_stop "Файлы скопированы"

cd /

# ══════════════════════════════════════════════════════════════════════════════
print_step "11" "$TOTAL_STEPS" "Настройка автозапуска и прав"
# ══════════════════════════════════════════════════════════════════════════════

# Создаём системного пользователя для безопасности
if ! id "$SERVICE_USER" &>/dev/null; then
  useradd -r -s /bin/false -d "$INSTALL_DIR" "$SERVICE_USER" 2>/dev/null
  print_ok "Системный пользователь '$SERVICE_USER' создан"
else
  print_ok "Системный пользователь '$SERVICE_USER' уже существует"
fi

# Выставляем права
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
chmod -R 750 "$INSTALL_DIR"
chmod -R 755 "$INSTALL_DIR/frontend"
chmod 600 "$INSTALL_DIR/application.yml"
print_ok "Права доступа выставлены"

# Systemd сервис — автозапуск при перезагрузке сервера
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
print_ok "Автозапуск настроен — сайт будет запускаться после перезагрузки сервера"

# ══════════════════════════════════════════════════════════════════════════════
print_step "12" "$TOTAL_STEPS" "Настройка Nginx и запуск"
# ══════════════════════════════════════════════════════════════════════════════

# Убираем дефолтный сайт nginx
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# Конфиг nginx
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

    # Заголовки безопасности
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # API — передаём на Java сервер
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

    # Загруженные файлы (скины, картинки товаров)
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

    # Визуальная часть сайта
    location / {
        root ${INSTALL_DIR}/frontend;
        index index.html;
        try_files \$uri \$uri/ /index.html;

        # Кешируем статику (картинки, шрифты, CSS)
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2|woff|ttf)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }
}
NGINXCONF

ln -sf /etc/nginx/sites-available/craftcms /etc/nginx/sites-enabled/craftcms

nginx -t 2>/dev/null || die "Ошибка в конфигурации Nginx" "Запусти: nginx -t для диагностики"
print_ok "Nginx настроен"

# Настройка файрвола
spin_start "Настройка файрвола (открываем порты 80 и 443)"
ufw allow OpenSSH   2>/dev/null >/dev/null || true
ufw allow 'Nginx Full' 2>/dev/null >/dev/null || true
# Включаем файрвол только если он ещё не включён (чтобы не потерять SSH)
UFW_STATUS=$(ufw status 2>/dev/null | head -1)
if [[ "$UFW_STATUS" == *"inactive"* ]]; then
  ufw --force enable 2>/dev/null >/dev/null || true
fi
spin_stop "Файрвол настроен"

# Запуск сервисов
spin_start "Запуск Nginx"
systemctl enable nginx 2>/dev/null
systemctl restart nginx 2>/dev/null
spin_stop "Nginx запущен"

spin_start "Запуск CraftCMS (Java сервер)"
systemctl start craftcms 2>/dev/null
spin_stop "CraftCMS запускается..."

# SSL через Let's Encrypt
if [[ "$USE_SSL" == "y" ]]; then
  echo ""
  spin_start "Установка Certbot (SSL)"
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot python3-certbot-nginx 2>&1 >/dev/null
  spin_stop "Certbot установлен"

  spin_start "Получение SSL-сертификата для ${SITE_DOMAIN}"
  certbot --nginx -d "$SITE_DOMAIN" \
    --non-interactive --agree-tos \
    --email "${ADMIN_EMAIL:-admin@${SITE_DOMAIN}}" \
    --redirect 2>&1 >/tmp/certbot.log && \
    spin_stop "SSL-сертификат установлен — сайт будет работать по https://" || {
    print_warn "SSL не удалось настроить автоматически."
    print_warn "Убедись что домен ${SITE_DOMAIN} указывает на этот сервер и попробуй:"
    print_warn "  certbot --nginx -d ${SITE_DOMAIN}"
  }

  # Автообновление сертификата
  (crontab -l 2>/dev/null | grep -v certbot; echo "0 3 * * * certbot renew --quiet") | crontab -
  print_ok "Автообновление SSL добавлено (каждую ночь в 3:00)"
fi

# Ждём запуска Spring Boot (он стартует ~20–30 секунд)
echo ""
print_info "Ждём запуска Java сервера (обычно 20–40 секунд)..."
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

# ── Чистим исходники — они больше не нужны ───────────────────────────────────
rm -rf "$SRC_DIR"

# ──────────────────────────────────────────────────────────────────────────────
#  ИТОГОВАЯ СВОДКА
# ──────────────────────────────────────────────────────────────────────────────
PROTO="http"
[[ "$USE_SSL" == "y" ]] && PROTO="https"

echo ""
echo ""
echo -e "${BOLD}${GREEN}"
echo "  ╔══════════════════════════════════════════════════════════════════╗"
echo "  ║                                                                  ║"
echo "  ║          ✓  CraftCMS УСПЕШНО УСТАНОВЛЕНА!                       ║"
echo "  ║                                                                  ║"
echo "  ╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BOLD}${WHITE}  ┌── ТВОЙ САЙТ ────────────────────────────────────────────────────┐${NC}"
echo -e "${BOLD}${CYAN}  │                                                                  │${NC}"
echo -e "${BOLD}${CYAN}  │  Сайт:      ${PROTO}://${SITE_DOMAIN}$(printf '%*s' $((39 - ${#SITE_DOMAIN} - ${#PROTO})) '')│${NC}"
echo -e "${BOLD}${CYAN}  │  Админка:   ${PROTO}://${SITE_DOMAIN}/admin$(printf '%*s' $((33 - ${#SITE_DOMAIN} - ${#PROTO})) '')│${NC}"
echo -e "${BOLD}${CYAN}  │                                                                  │${NC}"
echo -e "${BOLD}${WHITE}  ├── ДАННЫЕ ДЛЯ ВХОДА ────────────────────────────────────────────┤${NC}"
echo -e "${BOLD}${CYAN}  │                                                                  │${NC}"
echo -e "${BOLD}${YELLOW}  │  Логин:     admin                                               │${NC}"
echo -e "${BOLD}${YELLOW}  │  Пароль:    Admin123!                                           │${NC}"
echo -e "${BOLD}${RED}  │                                                                  │${NC}"
echo -e "${BOLD}${RED}  │  !! СРАЗУ ПОСЛЕ ВХОДА СМЕНИ ПАРОЛЬ В ПРОФИЛЕ !!                │${NC}"
echo -e "${BOLD}${CYAN}  │                                                                  │${NC}"
echo -e "${BOLD}${WHITE}  └──────────────────────────────────────────────────────────────────┘${NC}"

echo ""
echo -e "${BOLD}${WHITE}  ┌── УПРАВЛЕНИЕ САЙТОМ ───────────────────────────────────────────┐${NC}"
echo -e "  ${DIM}│                                                                  │${NC}"
echo -e "  │  Статус сайта:    ${CYAN}systemctl status craftcms${NC}$(printf '%*s' 17 '')│"
echo -e "  │  Перезапустить:   ${CYAN}systemctl restart craftcms${NC}$(printf '%*s' 16 '')│"
echo -e "  │  Остановить:      ${CYAN}systemctl stop craftcms${NC}$(printf '%*s' 19 '')│"
echo -e "  │  Логи (live):     ${CYAN}journalctl -u craftcms -f${NC}$(printf '%*s' 17 '')│"
echo -e "  │  Обновить сайт:   ${CYAN}bash update.sh${NC}$(printf '%*s' 27 '')│"
echo -e "  ${DIM}│                                                                  │${NC}"
echo -e "${BOLD}${WHITE}  └──────────────────────────────────────────────────────────────────┘${NC}"

echo ""
echo -e "${BOLD}${WHITE}  ┌── ФАЙЛЫ НА СЕРВЕРЕ ────────────────────────────────────────────┐${NC}"
echo -e "  │  Все файлы:       ${DIM}${INSTALL_DIR}/${NC}$(printf '%*s' $((32 - ${#INSTALL_DIR})) '')│"
echo -e "  │  База данных:     ${DIM}${INSTALL_DIR}/data/${NC}$(printf '%*s' $((27 - ${#INSTALL_DIR})) '')│"
echo -e "  │  Загрузки:        ${DIM}${INSTALL_DIR}/uploads/${NC}$(printf '%*s' $((24 - ${#INSTALL_DIR})) '')│"
echo -e "  │  Логи:            ${DIM}${INSTALL_DIR}/logs/${NC}$(printf '%*s' $((27 - ${#INSTALL_DIR})) '')│"
echo -e "  │  Конфиг:          ${DIM}${INSTALL_DIR}/application.yml${NC}$(printf '%*s' $((16 - ${#INSTALL_DIR})) '')│"
echo -e "${BOLD}${WHITE}  └──────────────────────────────────────────────────────────────────┘${NC}"

echo ""
echo -e "  ${DIM}Если что-то не работает — напиши нам, приложи вывод команды:${NC}"
echo -e "  ${CYAN}  journalctl -u craftcms -n 50 --no-pager${NC}"
echo ""
echo ""
