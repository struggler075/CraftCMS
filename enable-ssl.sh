#!/bin/bash
# ==============================================================================
#  CraftCMS — Подключение HTTPS (Let's Encrypt + Certbot)
#  One-shot script: запускается один раз после install.sh. Идемпотентен —
#  повторный запуск обновит сертификат если он истекает, не сломает то что
#  уже работает.
#
#  Что делает:
#    1. Устанавливает certbot + nginx-плагин (если не стоит)
#    2. Получает бесплатный SSL-сертификат от Let's Encrypt
#    3. Патчит nginx-конфиг: добавляет listen 443 ssl, redirect 80 → 443
#    4. Обновляет siteUrl в БД (http → https) — чтобы ссылки в email'ах
#       и API-ответах шли через HTTPS
#    5. Ставит cron на автообновление сертификата (каждую ночь в 3:00)
#
#  Использование:
#    sudo bash enable-ssl.sh
#    sudo bash enable-ssl.sh --domain mysite.ru --email admin@mysite.ru
#
#  Если домен не указан — скрипт спросит интерактивно.
# ==============================================================================

[ -z "$BASH_VERSION" ] && exec bash "$0" "$@"
set -Eeuo pipefail

# ── Parse CLI args ───────────────────────────────────────────────────────────
DOMAIN=""
EMAIL=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain|-d) DOMAIN="$2"; shift 2 ;;
    --email|-e)  EMAIL="$2";  shift 2 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

# ── Colors ───────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'
  YELLOW='\033[1;33m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
else
  GREEN=''; RED=''; CYAN=''; YELLOW=''; BOLD=''; DIM=''; NC=''
fi

ok()   { echo -e "  ${GREEN}✓${NC}  $*"; }
err()  { echo -e "${RED}${BOLD}  ОШИБКА: $*${NC}"; exit 1; }
info() { echo -e "  ${DIM}→${NC}  $*"; }
warn() { echo -e "  ${YELLOW}!${NC}  $*"; }
step() { echo -e "\n${BOLD}${CYAN}━━━ $* ${NC}"; }

# ── Paths ────────────────────────────────────────────────────────────────────
INSTALL_DIR="/opt/craftcms"
NGINX_CONF="/etc/nginx/sites-available/craftcms"
PG_CONTAINER="craftcms-postgres"
PG_USER="craftcms"
PG_DB="craftcms"
LOG_FILE="/var/log/craftcms-ssl-$(date +%Y%m%d-%H%M%S).log"

: > "$LOG_FILE"
chmod 600 "$LOG_FILE"

# ──────────────────────────────────────────────────────────────────────────────
clear
echo -e "${BOLD}${CYAN}  CraftCMS — Подключение HTTPS${NC}"
echo -e "  ${DIM}──────────────────────────────${NC}"
echo -e "  ${DIM}Лог: ${LOG_FILE}${NC}"
echo ""

# ── Pre-checks ───────────────────────────────────────────────────────────────
step "Проверка окружения"

[[ $EUID -ne 0 ]] && err "Запусти от root: sudo bash enable-ssl.sh"
[[ ! -d "$INSTALL_DIR" ]] && err "CraftCMS не найдена в ${INSTALL_DIR}. Сначала: sudo bash install.sh"
[[ ! -f "$NGINX_CONF" ]] && err "Конфиг nginx не найден: ${NGINX_CONF}"
systemctl is-active --quiet nginx || err "Nginx не запущен. Запусти: systemctl start nginx"

ok "CraftCMS установлена, nginx работает"

# ── Domain input ─────────────────────────────────────────────────────────────
step "Настройка домена"

# Try to detect domain from existing nginx config
if [[ -z "$DOMAIN" ]]; then
  DETECTED=$(grep -oP 'server_name\s+\K[^;]+' "$NGINX_CONF" 2>/dev/null | head -1 | tr -d ' ')
  if [[ -n "$DETECTED" && "$DETECTED" != "_" ]]; then
    echo -ne "  ${BOLD}Домен${NC} [${DETECTED}]: "
    read -r DOMAIN_INPUT
    DOMAIN="${DOMAIN_INPUT:-$DETECTED}"
  else
    echo -ne "  ${BOLD}Домен (без https://):${NC} "
    read -r DOMAIN
  fi
fi
DOMAIN=$(echo "$DOMAIN" | sed 's|https\?://||; s|/||g; s|:.*||')
[[ -z "$DOMAIN" ]] && err "Домен не может быть пустым"

# Validate domain isn't an IP — Let's Encrypt doesn't issue certs for bare IPs
if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  err "Let's Encrypt не выдаёт сертификаты на голые IP-адреса. Нужен домен (например: myserver.ru)"
fi

ok "Домен: $DOMAIN"

# Email for Let's Encrypt notifications
if [[ -z "$EMAIL" ]]; then
  echo -ne "  ${BOLD}Email для уведомлений Let's Encrypt:${NC} "
  read -r EMAIL
fi
EMAIL=$(echo "$EMAIL" | tr -d ' ')
if [[ -z "$EMAIL" || ! "$EMAIL" =~ ^[^@]+@[^@]+\.[^@]+$ ]]; then
  warn "Email не указан или невалиден — будет использован admin@${DOMAIN}"
  EMAIL="admin@${DOMAIN}"
fi

ok "Email: $EMAIL"

# ── DNS check ────────────────────────────────────────────────────────────────
step "Проверка DNS"

# Get this server's public IP
SERVER_IP=$(curl -4 -fsS --max-time 10 https://ifconfig.me 2>/dev/null || \
            curl -4 -fsS --max-time 10 https://api.ipify.org 2>/dev/null || echo "")

if [[ -z "$SERVER_IP" ]]; then
  warn "Не удалось определить публичный IP сервера — пропускаю DNS-проверку"
else
  info "IP этого сервера: ${SERVER_IP}"
  # Resolve domain
  DOMAIN_IP=$(dig +short "$DOMAIN" A 2>/dev/null | head -1 || \
              getent ahosts "$DOMAIN" 2>/dev/null | awk '{print $1}' | head -1 || echo "")

  if [[ -z "$DOMAIN_IP" ]]; then
    err "${DOMAIN} не резолвится. Добавь A-запись: ${DOMAIN} → ${SERVER_IP}"
  elif [[ "$DOMAIN_IP" != "$SERVER_IP" ]]; then
    echo ""
    warn "${DOMAIN} указывает на ${DOMAIN_IP}, а этот сервер — ${SERVER_IP}"
    warn "Let's Encrypt не сможет подтвердить владение доменом."
    echo ""
    echo -ne "  ${BOLD}Продолжить всё равно? (y/N):${NC} "
    read -r FORCE
    [[ "${FORCE,,}" != "y" ]] && { info "Отменено."; exit 0; }
  else
    ok "DNS корректен: ${DOMAIN} → ${SERVER_IP}"
  fi
fi

# ── Install certbot ──────────────────────────────────────────────────────────
step "Установка Certbot"

if command -v certbot >/dev/null 2>&1; then
  ok "Certbot уже установлен ($(certbot --version 2>&1 | head -1))"
else
  info "Устанавливаю certbot + nginx-плагин..."
  DEBIAN_FRONTEND=noninteractive apt-get update -qq >>"$LOG_FILE" 2>&1
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    certbot python3-certbot-nginx >>"$LOG_FILE" 2>&1 \
    || err "Не удалось установить Certbot. Лог: ${LOG_FILE}"
  ok "Certbot установлен"
fi

# ── Patch nginx server_name ──────────────────────────────────────────────────
step "Подготовка Nginx"

# Make sure server_name in nginx config matches the domain. install.sh may
# have set it to an IP or _, which certbot --nginx wouldn't match.
CURRENT_SN=$(grep -oP 'server_name\s+\K[^;]+' "$NGINX_CONF" | head -1 | tr -d ' ')
if [[ "$CURRENT_SN" != "$DOMAIN" ]]; then
  info "Обновляю server_name: ${CURRENT_SN} → ${DOMAIN}"
  sed -i "s|server_name .*;|server_name ${DOMAIN};|g" "$NGINX_CONF"
  nginx -t >>"$LOG_FILE" 2>&1 || err "Конфиг nginx невалиден после патча server_name"
  systemctl reload nginx >>"$LOG_FILE" 2>&1
  ok "server_name обновлён на ${DOMAIN}"
else
  ok "server_name уже ${DOMAIN}"
fi

# Open 443 in firewall
ufw allow 443/tcp >>"$LOG_FILE" 2>&1 || true
ufw allow 'Nginx Full' >>"$LOG_FILE" 2>&1 || true

# ── Obtain certificate ───────────────────────────────────────────────────────
step "Получение SSL-сертификата"

info "Запрашиваю сертификат у Let's Encrypt для ${DOMAIN}..."
info "(HTTP-01 challenge — Let's Encrypt обратится на порт 80 этого сервера)"
echo ""

if certbot --nginx \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --redirect \
    --keep-until-expiring \
    2>&1 | tee -a "$LOG_FILE"; then
  echo ""
  ok "SSL-сертификат получен и установлен"
else
  echo ""
  err "Certbot не смог получить сертификат. Возможные причины:
  1. Домен ${DOMAIN} не указывает на этот сервер
  2. Порт 80 недоступен извне (файрвол, NAT, хостинг)
  3. Rate limit — слишком много запросов (подожди час)
  Полный лог: ${LOG_FILE}"
fi

# ── Verify nginx config ─────────────────────────────────────────────────────
step "Проверка конфигурации"

nginx -t >>"$LOG_FILE" 2>&1 || err "Конфиг nginx невалиден после certbot. Лог: ${LOG_FILE}"
systemctl reload nginx >>"$LOG_FILE" 2>&1
ok "Nginx перезагружен с SSL"

# Verify HTTPS actually responds
HTTPS_CODE=$(curl -4 -fsS --max-time 10 -o /dev/null -w '%{http_code}' \
    "https://${DOMAIN}/" 2>/dev/null || echo "000")
if [[ "$HTTPS_CODE" =~ ^(200|301|302)$ ]]; then
  ok "HTTPS отвечает (HTTP ${HTTPS_CODE})"
else
  warn "HTTPS вернул HTTP ${HTTPS_CODE} — проверь вручную: curl -vI https://${DOMAIN}/"
fi

# Verify HTTP → HTTPS redirect
HTTP_REDIRECT=$(curl -4 -fsS --max-time 10 -o /dev/null -w '%{redirect_url}' \
    "http://${DOMAIN}/" 2>/dev/null || echo "")
if [[ "$HTTP_REDIRECT" == "https://"* ]]; then
  ok "HTTP → HTTPS редирект работает"
else
  warn "HTTP → HTTPS редирект не обнаружен — проверь nginx-конфиг"
fi

# ── Update siteUrl in database ───────────────────────────────────────────────
step "Обновление siteUrl в базе данных"

NEW_URL="https://${DOMAIN}"

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${PG_CONTAINER}\$"; then
  CURRENT_URL=$(docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" "$PG_DB" -tAc \
    "SELECT site_url FROM site_settings WHERE id = 1;" 2>>"$LOG_FILE" || echo "")

  if [[ "$CURRENT_URL" == "$NEW_URL" ]]; then
    ok "siteUrl уже ${NEW_URL}"
  else
    docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" "$PG_DB" -c \
      "UPDATE site_settings SET site_url = '${NEW_URL}' WHERE id = 1;" \
      >>"$LOG_FILE" 2>&1
    ok "siteUrl обновлён: ${CURRENT_URL:-пусто} → ${NEW_URL}"
    info "Email-ссылки теперь будут вести на ${NEW_URL}"
  fi
else
  warn "Контейнер ${PG_CONTAINER} не найден — обнови siteUrl вручную в админке"
fi

# ── Update application.yml CORS ──────────────────────────────────────────────
step "Обновление CORS в application.yml"

APP_YML="${INSTALL_DIR}/application.yml"
if [[ -f "$APP_YML" ]]; then
  if grep -q "https://${DOMAIN}" "$APP_YML" 2>/dev/null; then
    ok "CORS уже содержит https://${DOMAIN}"
  else
    # Add https:// origin if not present (the yml already has http:// from install.sh)
    sed -i "/allowed-origins:/a\\      - https://${DOMAIN}" "$APP_YML" 2>>"$LOG_FILE" || true
    ok "Добавлен https://${DOMAIN} в CORS allowed-origins"
    info "Рестарт craftcms для применения CORS..."
    systemctl restart craftcms >>"$LOG_FILE" 2>&1 || warn "Не удалось рестартнуть craftcms"
  fi
else
  warn "application.yml не найден — CORS не обновлён"
fi

# ── Auto-renewal cron ────────────────────────────────────────────────────────
step "Автообновление сертификата"

if crontab -l 2>/dev/null | grep -q 'certbot renew'; then
  ok "Cron-задача уже есть"
else
  (crontab -l 2>/dev/null | grep -v certbot
   echo "0 3 * * * certbot renew --quiet --deploy-hook 'systemctl reload nginx'"
  ) | crontab -
  ok "Добавлено: каждую ночь в 3:00 проверяется и обновляется сертификат"
fi

# Also enable certbot's systemd timer if available (belt + suspenders)
if systemctl list-unit-files certbot.timer >/dev/null 2>&1; then
  systemctl enable --now certbot.timer >>"$LOG_FILE" 2>&1 || true
  ok "Systemd timer для certbot включён"
fi

# ──────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}  ✓ HTTPS подключён!${NC}"
echo ""
echo -e "  ${BOLD}Сайт:${NC}           https://${DOMAIN}"
echo -e "  ${BOLD}Сертификат:${NC}     Let's Encrypt (автообновление)"
echo -e "  ${BOLD}Редирект:${NC}       http → https (автоматический)"
echo -e "  ${BOLD}siteUrl в БД:${NC}   ${NEW_URL}"
echo ""
echo -e "  ${DIM}Полезные команды:${NC}"
echo -e "  ${DIM}  Статус серта:    certbot certificates${NC}"
echo -e "  ${DIM}  Тест renewal:    certbot renew --dry-run${NC}"
echo -e "  ${DIM}  Nginx конфиг:    cat ${NGINX_CONF}${NC}"
echo -e "  ${DIM}  Лог:             ${LOG_FILE}${NC}"
echo ""
