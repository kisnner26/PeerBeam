# Entrega de PeerBeam v0.1

> Registro histórico de la entrega inicial. Los cambios y validaciones del hardening posterior están en [HARDENING.md](HARDENING.md); sus garantías sustituyen las descripciones originales de códigos y caducidad de este registro.

Proyecto local: `D:\LocalDrop\peerbeam`. Implementación terminada y validada en Windows con Node 22.14.0. No se publicó un repositorio remoto ni se desplegó un servicio público.

## 1. Arquitectura final

Monorepo npm workspaces, TypeScript strict. React + Vite + Tailwind en el navegador; Node + WebSocket en signaling; Zod en ambos límites de protocolo. Estado React normal, sin Zustand. `PeerConnectionManager` encapsula WebRTC y `TransferManager` encapsula consentimiento, envío, recepción, cancelación y finalización.

**Los archivos viajan por RTCDataChannel entre navegadores.** `apps/signaling-server` solamente crea sesiones y transmite SDP/ICE. El flujo de archivos de PeerBeam nunca envía bytes ni metadatos de archivos al servidor de signaling. No hay almacenamiento ni subida alternativa. STUN opcional descubre direcciones, no retransmite archivos; TURN no está implementado. Un cliente ajeno podría introducir texto arbitrario en un campo SDP permitido: la validación de schemas no demuestra que ese texto sea SDP auténtico.

## 2. Carpetas

```text
apps/web/src/components        UI de sesión, consentimiento, progreso y diagnóstico
apps/web/src/connection        SignalingClient, PeerConnectionManager y useSession
apps/web/src/transfer          TransferManager, estados, backpressure y useTransfer
apps/signaling-server/src      Servidor y SessionManager
packages/protocol/src          Schemas y tipos de signaling y archivos
packages/shared/src            Alfabeto y normalización de códigos
docs/adr                       Decisión arquitectónica
.github                        CI, plantillas de issues y pull requests
```

README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG y licencia MIT están incluidos. Hay 20 propuestas de issues en `INITIAL_ISSUES.md`, agrupadas por categoría; no se crearon issues remotos.

## 3. Funcionalidades implementadas

- Crear y unirse con código aleatorio de seis caracteres; copiar código.
- Dos peers como máximo; códigos sin colisiones; sesiones en memoria; expiración y limpieza de sockets.
- Negociación WebRTC, ICE en cola y cierre de recursos al salir o fallar.
- Elegir o arrastrar un archivo; aceptar o rechazar explícitamente.
- Chunks progresivos, backpressure, progreso, bytes, velocidad media y cancelación.
- Reconstrucción de Blob, confirmación del receptor y descarga.
- Errores comprensibles para sesión, red, archivo y protocolo.
- Diseño oscuro responsive y panel desplegable de conexión.

## 4. Decisiones importantes

Una transferencia activa por conexión; límite de 128 MiB porque el receptor conserva el archivo en RAM. Chunks de hasta 64 KiB, ajustados al límite SCTP negociado. Por encima de 1 MiB en cola, el emisor espera a 256 KiB mediante `bufferedamountlow`. No se declara completado al emisor hasta recibir confirmación del receptor.

Los códigos que esperan expiran a los 10 minutos. Dos peers que responden al heartbeat mantienen activa la sesión: signaling no puede saber si se está transfiriendo un archivo. Consentimiento pendiente expira a los 120 segundos y una transferencia sin actividad a los 30 segundos.

Los nombres se muestran como texto React y se normalizan para descarga. Los archivos no se previsualizan ni ejecutan. La URL de descarga se libera al reemplazar el archivo o cerrar la sesión. Descarga el archivo antes de esas acciones.

Developer Mode obtiene estados ICE, PeerConnection y DataChannel; tipos de candidatos del par seleccionado; clasificación `direct`, `relay` o `unknown`; y contadores de bytes del canal cuando `getStats()` los proporciona. También muestra velocidad media del payload y chunks procesados. Los valores ausentes se muestran como `Unavailable`. Los contadores del canal incluyen mensajes de control y no equivalen exactamente al tamaño del archivo.

## 5. Validación

38 pruebas en 8 archivos: schemas de signaling y archivos, metadatos inválidos, códigos, colisiones, unión, tercer peer, expiración, limpieza, WebSocket real, límites de chunks, progreso, estados, consentimiento, reconstrucción exacta, cancelación, desconexión, timeout, backpressure y componentes React.

Comprobaciones realizadas: `npm install`, `npm ci`, `npm run dev`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test`, `npm run build` y `npm audit`. Los controles de código pasan; auditoría sin vulnerabilidades conocidas al ejecutar la revisión.

Prueba de navegador real en procesos separados de Chrome y Edge, sobre localhost y sin STUN:

- Crear sesión, unir y conectar WebRTC.
- Rechazar un archivo: cero bytes de payload enviados.
- Aceptar un archivo de 4.194.341 bytes: 65 chunks y confirmación en ambos peers.
- Descargar en Edge y comparar con el original: SHA-256 idéntico, `E93287FBBB79EBF98590044B8F3F9E701F50F3B65078FF3A63B4954DAF868A98`.
- Transferir y descargar un archivo vacío en sentido Edge → Chrome: contenido idéntico.
- Diagnóstico real: candidatos host/host, conexión directa, canal abierto y contadores disponibles.
- Revisar escritorio a 1440 × 1080 y móvil a 390 px: sin desbordamiento horizontal en la revisión móvil.

La comparación SHA-256 fue una comprobación externa, no una función añadida a la app. Capturas y fixtures están excluidos de Git en `output/playwright/` y `.playwright-cli/`. No se verificaron dos dispositivos físicos ni redes NAT distintas. GitHub Actions está configurado, pero todavía no se ejecutó remotamente porque el proyecto no está publicado.

## 6. Comandos

```powershell
cd D:\LocalDrop\peerbeam
npm install
npm run dev
```

En este espacio de trabajo, abrir `http://localhost:5174`. El puerto 5173 estaba ocupado por otro proceso, que se conservó. La configuración local está en `.env`, excluido de Git. En un clon nuevo sin `.env`, el puerto predeterminado es 5173.

```sh
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

Para ejecutar el servidor compilado: `npm start -w @peerbeam/signaling-server`.

## 7. Variables de entorno

`.env.example` en la raíz contiene `PORT`, `HOST`, `VITE_PORT`, `ALLOWED_ORIGINS`, `VITE_SIGNALING_URL` y `VITE_STUN_URL`. STUN está vacío por defecto; se documenta un ejemplo público optativo. Los valores `VITE_` son públicos y se incorporan al build. Cambiarlos requiere reiniciar Vite o recompilar. Para dos dispositivos físicos se necesitan direcciones alcanzables y HTTPS/WSS con origen autorizado; localhost en un teléfono apunta al propio teléfono.

## 8. Limitaciones actuales

Un archivo por vez, recepción en memoria, sin persistencia ni reanudación. Algunas redes requieren TURN y no conectarán en v0.1. La app usa DTLS de WebRTC; no promete anonimato, identidad verificada ni cifrado personalizado. El código es una invitación temporal que debe compartirse de forma privada.

## 9. Siguientes issues recomendados para v0.2

QR con alternativa textual, cola de varios archivos con consentimiento definido, arrastre sin parpadeo, auditoría con lectores de pantalla, y comprobaciones de teclado, zoom y objetivos táctiles. Se dejan deliberadamente pendientes QR, archivos múltiples, SHA-256 dentro de la app, resume, carpetas, File System Access, escritura directa a disco, Docker, TURN, multi-peer y diagnóstico avanzado.

## 10. Pendientes y observaciones

No quedan errores conocidos que bloqueen los controles locales. El build emite dos avisos de Rollup sobre anotaciones de comentarios internos de Zod; se descartan esos comentarios y la compilación termina correctamente.

La instalación limpia en Windows requirió detener Vite para liberar una biblioteca nativa. No es necesario ejecutar como administrador. Detén `npm run dev` antes de reinstalar dependencias.

Los commits están separados por etapas. La configuración Git global existente tiene nombre y correo `--get`; se utilizó esa identidad sin modificar la configuración global. Antes de publicar conviene establecer la identidad real y decidir si se corrigen los autores de los commits. También queda elegir el repositorio remoto y habilitar allí reportes privados de seguridad. Estos pasos no forman parte de la ejecución local de v0.1.

Fuentes técnicas consultadas: [MDN: DataChannels y DTLS](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels), [MDN: backpressure](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/bufferedAmountLowThreshold) y [Tailwind con Vite](https://tailwindcss.com/docs/installation/using-vite).
