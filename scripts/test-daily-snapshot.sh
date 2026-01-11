#!/bin/bash

# Script para testear el nuevo sistema de snapshot diario
# Uso: ./scripts/test-daily-snapshot.sh

set -e

echo "🧪 Testing Daily Snapshot System"
echo "================================="
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar que estamos en la raíz del proyecto
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Error: Debes ejecutar este script desde la raíz del proyecto${NC}"
  exit 1
fi

# Cargar variables de entorno
if [ -f ".env.local" ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
  echo -e "${GREEN}✅ Variables de entorno cargadas${NC}"
else
  echo -e "${RED}❌ Error: No se encontró .env.local${NC}"
  exit 1
fi

# Verificar CRON_SECRET
if [ -z "$CRON_SECRET" ]; then
  echo -e "${RED}❌ Error: CRON_SECRET no está configurado en .env.local${NC}"
  exit 1
fi

echo -e "${GREEN}✅ CRON_SECRET configurado${NC}"
echo ""

# Obtener URL base
if [ -z "$NEXT_PUBLIC_APP_URL" ]; then
  BASE_URL="http://localhost:3000"
  echo -e "${YELLOW}⚠️  NEXT_PUBLIC_APP_URL no configurado, usando localhost${NC}"
else
  BASE_URL="$NEXT_PUBLIC_APP_URL"
fi

echo "🌐 Base URL: $BASE_URL"
echo ""

# Test 1: Verificar que el endpoint existe
echo "📝 Test 1: Verificando endpoint..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/sync/acuity/daily-snapshot" \
  -H "Content-Type: application/json" \
  -H "authorization: Bearer $CRON_SECRET")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "400" ]; then
  echo -e "${GREEN}✅ Endpoint accesible (HTTP $HTTP_CODE)${NC}"
else
  echo -e "${RED}❌ Error: Endpoint no accesible (HTTP $HTTP_CODE)${NC}"
  exit 1
fi
echo ""

# Test 2: Ejecutar snapshot diario
echo "📸 Test 2: Ejecutando snapshot diario..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/sync/acuity/daily-snapshot" \
  -H "Content-Type: application/json" \
  -H "authorization: Bearer $CRON_SECRET")

# Verificar si la respuesta contiene "success"
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ Snapshot ejecutado correctamente${NC}"
  
  # Extraer y mostrar detalles
  RECORDS=$(echo "$RESPONSE" | grep -o '"records_saved":[0-9]*' | grep -o '[0-9]*')
  DATE=$(echo "$RESPONSE" | grep -o '"date":"[^"]*"' | cut -d'"' -f4)
  
  echo "   📊 Registros guardados: $RECORDS"
  echo "   📅 Fecha: $DATE"
else
  echo -e "${RED}❌ Error al ejecutar snapshot${NC}"
  echo "   Respuesta: $RESPONSE"
  exit 1
fi
echo ""

# Test 3: Ejecutar cron completo
echo "🔄 Test 3: Ejecutando cron job completo..."
CRON_RESPONSE=$(curl -s -X GET "$BASE_URL/api/cron/sync-acuity-daily?secret=$CRON_SECRET")

if echo "$CRON_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ Cron job ejecutado correctamente${NC}"
  
  # Verificar que dailySnapshot tuvo éxito
  if echo "$CRON_RESPONSE" | grep -q '"dailySnapshot".*"success":true'; then
    echo -e "${GREEN}   ✅ Daily snapshot step: OK${NC}"
  else
    echo -e "${YELLOW}   ⚠️  Daily snapshot step: Failed${NC}"
  fi
  
  # Verificar otros pasos
  if echo "$CRON_RESPONSE" | grep -q '"appointments".*"success":true'; then
    echo -e "${GREEN}   ✅ Appointments sync: OK${NC}"
  else
    echo -e "${YELLOW}   ⚠️  Appointments sync: Failed${NC}"
  fi
  
  if echo "$CRON_RESPONSE" | grep -q '"availability".*"success":true'; then
    echo -e "${GREEN}   ✅ Availability sync: OK${NC}"
  else
    echo -e "${YELLOW}   ⚠️  Availability sync: Failed${NC}"
  fi
else
  echo -e "${RED}❌ Error al ejecutar cron job completo${NC}"
  echo "   Respuesta: $CRON_RESPONSE"
fi
echo ""

# Test 4: Verificar dashboard
echo "🎨 Test 4: Verificando dashboard..."
DASHBOARD_RESPONSE=$(curl -s "$BASE_URL/api/dashboard" \
  -H "Cookie: $(curl -s -c - "$BASE_URL/login" | grep 'Set-Cookie' | cut -d' ' -f2)")

if echo "$DASHBOARD_RESPONSE" | grep -q 'storeOccupation'; then
  echo -e "${GREEN}✅ Dashboard endpoint accesible${NC}"
  
  # Verificar que hay datos
  STORE_COUNT=$(echo "$DASHBOARD_RESPONSE" | grep -o '"storeName"' | wc -l)
  echo "   🏪 Tiendas encontradas: $STORE_COUNT"
else
  echo -e "${YELLOW}⚠️  No se pudo verificar el dashboard (requiere autenticación)${NC}"
  echo "   Verifica manualmente en: $BASE_URL/"
fi
echo ""

# Resumen
echo "================================="
echo -e "${GREEN}✅ Testing completado${NC}"
echo ""
echo "📋 Próximos pasos:"
echo "   1. Verificar el dashboard en: $BASE_URL/"
echo "   2. Revisar los logs en la consola del navegador"
echo "   3. Ejecutar la migración SQL en Supabase (si no lo has hecho)"
echo "   4. Verificar que el cron se ejecute automáticamente mañana a las 7-8 AM"
echo ""
echo "📚 Documentación completa: SOLUCION_OCUPACION_DIA_COMPLETO.md"
