# IMPORTANTE: Versión de Node.js

Este proyecto requiere **Node.js 20 LTS** para funcionar correctamente.

## Problema conocido
Node.js 22 tiene incompatibilidades con Next.js 16 que causan errores de módulos faltantes.

## Solución

### Opción 1: Usar nvm (recomendado)
Si tienes nvm instalado, ejecuta una vez:
```bash
nvm use --delete-prefix v20.19.6 --silent
```

Luego, cada vez que trabajes en el proyecto:
```bash
nvm use 20
npm run dev
```

### Opción 2: El script de dev ya está configurado
El script `npm run dev` intentará usar Node.js 20 automáticamente si nvm está disponible.

### Opción 3: Instalar Node.js 20 manualmente
Si no usas nvm, instala Node.js 20 LTS desde https://nodejs.org/

## Verificar versión
```bash
node --version
```
Debe mostrar: `v20.x.x`

