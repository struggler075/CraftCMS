#!/bin/bash
# CraftCMS — Обновление до новой версии
[ -z "$BASH_VERSION" ] && exec bash "$0" "$@"
set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC}  $*"; }
err()  { echo -e "${RED}${BOLD}  ОШИБКА: $*${NC}"; echo ""; exit 1; }
step() { echo -e "\n${BOLD}${CYAN}━━━ $* ${NC}"; }
info() { echo -e "  ${DIM}→${NC}  $*"; }

clear
echo -e "${BOLD}${CYAN}  CraftCMS — Обновление${NC}"
echo -e "  ${DIM}──────────────────────────────${NC}"
echo ""

[[ $EUID -ne 0 ]] && err "Запусти от root: sudo bash update.sh"
[[ ! -d /opt/craftcms ]] && err "CraftCMS не найдена. Сначала выполни установку: sudo bash install.sh"

INSTALL_DIR="/opt/craftcms"
SRC_DIR="/opt/craftcms-src-update"
GITHUB_REPO="struggler075/CraftCMS"
M2_HOME="/opt/maven"
export PATH="$M2_HOME/bin:$PATH"
JAVA_HOME_PATH=$(dirname "$(dirname "$(readlink -f "$(which java)")")")

echo -ne "  ${BOLD}Введи токен доступа (тот же что при установке):${NC}  "
read -r GITHUB_TOKEN
GITHUB_TOKEN="${GITHUB_TOKEN// /}"
[[ -z "$GITHUB_TOKEN" ]] && err "Токен не может быть пустым"

step "Скачивание новой версии"
rm -rf "$SRC_DIR"
git clone --depth=1 --quiet \
  "https://oauth2:${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git" \
  "$SRC_DIR" 2>/dev/null || err "Не удалось скачать обновление. Проверь токен."
ok "Новая версия скачана"
GITHUB_TOKEN="CLEARED"; unset GITHUB_TOKEN

step "Сборка Backend"
cd "$SRC_DIR/backend"
JAVA_HOME="$JAVA_HOME_PATH" "$M2_HOME/bin/mvn" clean package -DskipTests -q 2>/dev/null || \
  err "Ошибка компиляции. Отправь нам лог для диагностики."
JAR_FILE=$(ls target/craftcms-backend-*.jar | head -1)
systemctl stop craftcms 2>/dev/null || true
cp "$JAR_FILE" "$INSTALL_DIR/craftcms.jar"
chown craftcms:craftcms "$INSTALL_DIR/craftcms.jar"
ok "Backend обновлён"

# Обновляем BridgePlugin если есть
if ls "$SRC_DIR/BridgePlugin/target/"*.jar 1>/dev/null 2>&1; then
  cp "$SRC_DIR/BridgePlugin/target/"*.jar "$INSTALL_DIR/BridgePlugin.jar"
  ok "BridgePlugin.jar обновлён"
fi

step "Сборка Frontend"
cd "$SRC_DIR/frontend"
npm install --silent 2>/dev/null
npm run build 2>/dev/null
rm -rf "$INSTALL_DIR/frontend/"*
cp -r dist/* "$INSTALL_DIR/frontend/"
chown -R craftcms:craftcms "$INSTALL_DIR/frontend"
ok "Frontend обновлён"

step "Перезапуск"
systemctl start craftcms
systemctl reload nginx 2>/dev/null || true
rm -rf "$SRC_DIR"
ok "Сервисы перезапущены"

echo ""
echo -e "${GREEN}${BOLD}  ✓ CraftCMS успешно обновлена!${NC}"
info "Если что-то сломалось: journalctl -u craftcms -n 50 --no-pager"
echo ""
