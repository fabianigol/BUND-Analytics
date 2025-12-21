#!/bin/bash
# Script para iniciar el servidor de desarrollo con Node.js 20

# Desactivar variables problemáticas
unset npm_config_prefix

# Intentar usar Node.js 20 con nvm
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  source "$HOME/.nvm/nvm.sh"
  # Intentar usar Node.js 20, ignorar errores si falla
  nvm use 20 > /dev/null 2>&1 || nvm use --delete-prefix v20.19.6 --silent > /dev/null 2>&1 || true
fi

# Verificar versión de Node.js
NODE_VERSION=$(node --version 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" != "20" ]; then
  echo "⚠️  ADVERTENCIA: Se está usando Node.js v$(node --version)"
  echo "   Este proyecto requiere Node.js 20 LTS"
  echo "   Ejecuta: nvm use --delete-prefix v20.19.6 --silent"
  echo "   O instala Node.js 20 desde https://nodejs.org/"
  echo ""
fi

# Crear directorio de logs si no existe
LOG_DIR="$(dirname "$0")/../logs"
mkdir -p "$LOG_DIR"

# Nombre del archivo de log con timestamp
LOG_FILE="$LOG_DIR/dev-$(date +%Y%m%d-%H%M%S).log"

echo "📝 Los logs se guardarán en: $LOG_FILE"
echo "   También se mostrarán en esta terminal"
echo ""

# Ejecutar Next.js y guardar logs (tee muestra en terminal Y guarda en archivo)
exec next dev --webpack "$@" 2>&1 | tee "$LOG_FILE"

