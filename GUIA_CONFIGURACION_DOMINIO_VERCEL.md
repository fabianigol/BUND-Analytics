# Guía: Configurar Dominio Personalizado en Vercel con IONOS

Esta guía te explica paso a paso cómo conectar tu dominio personalizado de IONOS a tu proyecto desplegado en Vercel.

## 📋 Requisitos Previos

- Tener un proyecto desplegado en Vercel
- Tener acceso a tu cuenta de IONOS
- Tener acceso al dominio que quieres usar (ej: `tudominio.com` o `www.tudominio.com`)

---

## 🔧 Paso 1: Configurar el Dominio en Vercel

### 1.1. Acceder a la Configuración del Proyecto

1. Ve a [vercel.com](https://vercel.com) e inicia sesión
2. Selecciona tu proyecto **BUND-Analytics** (o el nombre que tenga)
3. Ve a la pestaña **Settings** (Configuración)
4. En el menú lateral, haz clic en **Domains** (Dominios)

### 1.2. Agregar el Dominio

1. En el campo de texto, escribe tu dominio:
   - Si quieres usar el dominio raíz: `tudominio.com`
   - Si quieres usar subdominio: `www.tudominio.com`
   - Puedes agregar ambos si quieres que funcionen

2. Haz clic en **Add** (Agregar)

### 1.3. Ver las Instrucciones de DNS

Vercel te mostrará las instrucciones específicas de DNS que necesitas configurar. **Guarda esta información** porque la necesitarás en IONOS.

Normalmente verás algo como:

**Para dominio raíz (tudominio.com):**
- Tipo: `A`
- Nombre: `@` o `tudominio.com`
- Valor: Una dirección IP (ej: `76.76.21.21`)

**Para subdominio www (www.tudominio.com):**
- Tipo: `CNAME`
- Nombre: `www`
- Valor: `cname.vercel-dns.com.` (o similar)

---

## 🌐 Paso 2: Configurar DNS en IONOS

### 2.1. Acceder al Panel de IONOS

1. Ve a [ionos.es](https://ionos.es) e inicia sesión
2. Ve a **Dominios** en el menú principal
3. Selecciona el dominio que quieres configurar

### 2.2. Acceder a la Configuración DNS

1. Busca la sección **DNS** o **Zona DNS**
2. Haz clic en **Gestionar zona DNS** o **Editar registros DNS**

### 2.3. Configurar los Registros DNS

Necesitas crear o modificar los siguientes registros según lo que Vercel te haya indicado:

#### Para Dominio Raíz (tudominio.com):

1. **Busca o crea un registro de tipo A:**
   - **Nombre/Host:** `@` o deja en blanco (depende de IONOS)
   - **Tipo:** `A`
   - **Valor/Destino:** La dirección IP que Vercel te proporcionó (ej: `76.76.21.21`)
   - **TTL:** `3600` (o el valor por defecto)

2. **Guarda el registro**

#### Para Subdominio www (www.tudominio.com):

1. **Crea un registro de tipo CNAME:**
   - **Nombre/Host:** `www`
   - **Tipo:** `CNAME`
   - **Valor/Destino:** El valor CNAME que Vercel te proporcionó (ej: `cname.vercel-dns.com.`)
   - **TTL:** `3600` (o el valor por defecto)

2. **Guarda el registro**

### 2.4. Eliminar Registros Conflictivos (si existen)

- Si ya existe un registro A o CNAME para `www` que apunta a otro lugar, elimínalo o modifícalo
- Asegúrate de no tener registros duplicados

---

## ⏱️ Paso 3: Esperar la Propagación DNS

1. **Los cambios DNS pueden tardar entre 5 minutos y 48 horas** en propagarse
2. Normalmente en IONOS tarda entre 15 minutos y 2 horas
3. Puedes verificar el estado en Vercel:
   - Ve a **Settings > Domains** en tu proyecto
   - Verás el estado del dominio:
     - 🟡 **Pending** (Pendiente) - Esperando propagación DNS
     - 🟢 **Valid** (Válido) - Dominio configurado correctamente
     - 🔴 **Invalid** (Inválido) - Hay un error en la configuración

---

## ✅ Paso 4: Verificar la Configuración

### 4.1. Verificar en Vercel

1. En la página de **Domains** de Vercel, verifica que el estado sea **Valid**
2. Si hay errores, Vercel te mostrará qué está mal

### 4.2. Verificar con Herramientas Online

Puedes verificar que los DNS están configurados correctamente usando:

- **DNS Checker:** [dnschecker.org](https://dnschecker.org)
  - Ingresa tu dominio y verifica que el registro A o CNAME apunte a los valores de Vercel

- **Dig Command** (si tienes acceso a terminal):
  ```bash
  dig tudominio.com
  dig www.tudominio.com
  ```

### 4.3. Probar el Dominio

Una vez que el estado en Vercel sea **Valid**:
1. Abre tu navegador
2. Visita `https://tudominio.com` o `https://www.tudominio.com`
3. Deberías ver tu aplicación funcionando

---

## 🔒 Paso 5: Configurar SSL/HTTPS (Automático)

Vercel configura automáticamente el certificado SSL (HTTPS) para tu dominio personalizado:
- **No necesitas hacer nada adicional**
- El certificado se genera automáticamente cuando el dominio se valida
- Puede tardar unos minutos adicionales después de que el DNS esté configurado

---

## 🐛 Solución de Problemas Comunes

### Problema: El dominio muestra "Invalid" en Vercel

**Soluciones:**
1. Verifica que los valores DNS en IONOS coincidan exactamente con los de Vercel
2. Asegúrate de que no hay espacios extra o puntos al final
3. Espera más tiempo (hasta 48 horas)
4. Verifica que no hay registros DNS conflictivos

### Problema: El dominio no carga después de 24 horas

**Soluciones:**
1. Verifica los registros DNS con una herramienta como dnschecker.org
2. Asegúrate de que el TTL no esté configurado muy alto (usa 3600 o menos)
3. Contacta con el soporte de IONOS si los cambios no se están aplicando

### Problema: Solo funciona www o solo el dominio raíz

**Solución:**
- Configura ambos registros (A para raíz y CNAME para www)
- O configura una redirección en Vercel:
  - Ve a **Settings > Domains**
  - Configura redirecciones según tus preferencias

### Problema: Error de certificado SSL

**Soluciones:**
1. Espera unos minutos más (Vercel genera el certificado automáticamente)
2. Verifica que el dominio esté marcado como "Valid" en Vercel
3. Si persiste, contacta con el soporte de Vercel

---

## 📝 Notas Importantes

1. **No elimines el dominio de Vercel** una vez configurado, o perderás la configuración
2. **Los cambios DNS pueden tardar**, sé paciente
3. **Vercel maneja HTTPS automáticamente**, no necesitas configurar nada adicional
4. **Puedes tener múltiples dominios** apuntando al mismo proyecto
5. **IONOS puede tener una interfaz diferente** según tu plan, pero los conceptos son los mismos

---

## 🔗 Enlaces Útiles

- [Documentación de Vercel sobre dominios](https://vercel.com/docs/concepts/projects/domains)
- [Soporte de IONOS](https://www.ionos.es/ayuda)
- [Verificador DNS](https://dnschecker.org)

---

## ✅ Checklist Final

- [ ] Dominio agregado en Vercel
- [ ] Registros DNS configurados en IONOS
- [ ] Estado del dominio en Vercel es "Valid"
- [ ] El sitio carga correctamente en el dominio personalizado
- [ ] HTTPS funciona (certificado SSL activo)
- [ ] Tanto el dominio raíz como www funcionan (si los configuraste ambos)

---

**¡Listo!** Una vez completados estos pasos, tu dominio personalizado debería estar funcionando con tu aplicación en Vercel.
