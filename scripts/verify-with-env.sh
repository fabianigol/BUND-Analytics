#!/bin/bash

# Cargar variables de entorno y ejecutar verificación
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

npx tsx scripts/verify-historical-data.ts

