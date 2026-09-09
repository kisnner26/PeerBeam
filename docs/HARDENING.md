# PeerBeam v0.1 — informe de hardening

Validación local en Windows, 8 de septiembre de 2026. Sin push, PR ni despliegue.

## 1. Repository state before changes

- Rama: `main`, siguiendo `origin/main`.
- Commit: `066ea75b01118932d4f8d9af2aa79a997ddc4235`.
- Working tree: limpio.
- Base: monorepo npm, React/Vite, TypeScript strict, Node/ws y Zod; 42 tests existentes, español/inglés y temas ya implementados.
- Se revisaron README, SECURITY, CONTRIBUTING, protocolo, ADR, conexión, transferencias, signaling, paquetes de protocolo/shared y tests antes de implementar. No había configuración E2E automatizada; sí evidencia histórica de smoke tests manuales.

## 2. Issue 1 — signaling disconnect

**Confirmado.** La pérdida del WebSocket llamaba al mismo `fail` que los errores WebRTC; `teardown()` cerraba PeerConnection y DataChannel aun cuando este último estaba abierto.

Cambios: `SignalingClient.ts`, `useSession.ts`, `PeerConnectionManager.ts`, `App.tsx`, traducciones y `useSession.test.tsx`. Se distingue el error de signaling del error del transporte P2P. Antes de abrir el canal, falla la sesión; después, se cierra signaling y se muestra un warning conservando el canal y la transferencia. Las notificaciones `peer-disconnected` y `session-expired` tampoco demuestran por sí solas que el transporte P2P haya fallado. Un fallo real del canal/peer sigue siendo fatal. Reset y unmount limpian ambos transportes, handlers y timers de conexión.

`useTransfer.ts` no necesitó cambios: recibe el mismo objeto DataChannel y conserva su manager cuando solo cambia el warning.

Pruebas: tres tests del hook cubren fallo previo, conservación posterior, expiración, fallo posterior del canal, reset y unmount. Los tests del manager cubren interrupción real del canal; el E2E detiene signaling durante una transferencia y comprueba finalización y bytes exactos.

## 3. Issue 2 — codes and join guessing

**Confirmado.** Los códigos tenían seis caracteres y solo existía el presupuesto general de 200 mensajes/10 segundos. La generación criptográfica y el manejo de colisiones ya eran correctos y se conservaron.

Cambios: shared, schema de signaling, dependencia interna protocol→shared, `SessionEntry`, mensajes/traducciones/fixtures, nuevo `joinLimiter.ts` y servidor. Longitud compartida de ocho caracteres, alfabeto sin I/O/0/1: 40 bits frente a 30, búsqueda 1.024 veces mayor. Cinco joins fallidos por conexión en 60 segundos; el siguiente join queda limitado hasta reiniciar la ventana. Los joins malformados cuentan. No se bloquean por este presupuesto create, ping o relay.

Pruebas: generación de 500 códigos válidos, colisiones existentes, código incorrecto/malformado, límite, join válido con presupuesto restante, reinicio de ventana y operaciones no afectadas. Origin continúa siendo política de navegador, no autenticación. Reconectarse elude el presupuesto por conexión; se documenta mitigación en reverse proxy.

Compatibilidad: clientes de seis caracteres deben actualizarse junto con el servidor; recrear códigos antiguos. No cambió el formato de mensajes del canal de archivos.

## 4. Issue 3 — session/socket exhaustion

**Confirmado parcialmente.** Dos peers quedaban exentos de expiración indefinidamente y sockets sin sesión podían responder heartbeat sin un límite de edad. El límite de 500 sesiones ya usaba `>=` correctamente. La comprobación `clients.size > 1000` dentro de `connection` rechazaba el excedente después del upgrade: no era una admisión estable de 1.001 peers, pero sí un rechazo tardío. Ahora se comprueba capacidad antes del upgrade.

Cambios: `sessions.ts`, `server.ts`, `index.ts`, `.env.example` y tests. Waiting TTL predeterminado de 10 minutos, conservando la UX previa; vida absoluta de sesión y socket de 60 minutos. Variables positivas enteras `WAITING_TTL_MS`/`ABSOLUTE_TTL_MS`. `createdAt` no se renueva con heartbeat, actividad, leave o rejoin. Expirar elimina memberships y sesiones, notifica y cierra sockets; cierre forzoso tras cinco segundos. El barrido periódico de 30 segundos introduce esa tolerancia en la limpieza. Sockets sin membresía también tienen el límite de espera.

Pruebas: espera, pareja inmune al TTL de inactividad, pareja expirada al límite absoluto, memberships vacías, reutilización del código, leave/rejoin, eliminación de sesión vacía, exactamente 500 sesiones, admisión de sockets con límite reducido a dos y recuperación de capacidad, expiración real de ambos sockets y de un socket sin sesión. Son mitigaciones, no protección completa DDoS.

## 5. Issue 4 — transfer state races

**Bugs confirmados y corregidos** en `TransferManager.ts`, con tests dirigidos en `TransferManager.test.ts`:

| Escenario / estado previo    | Evento                                   | Resultado anterior incorrecto                        | Corrección                                                                           |
| ---------------------------- | ---------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Oferta recibida              | `accept` cambia a accepted y send falla  | Estado intermedio sin progreso                       | Error terminal y limpieza local                                                      |
| Oferta/transferencia activa  | Send de reject/cancel falla              | No se ejecuta finish                                 | Decisión terminal antes de notificación de mejor esfuerzo                            |
| Transferencia activa         | Error y falla su notificación            | Limpieza interrumpida por otro throw                 | Limpieza primero, sin fallo recursivo                                                |
| Receptor con todos los bytes | Blob creado; envío de ack falla          | URL retenida sin descarga válida                     | Revocación y error terminal                                                          |
| Transferencia terminada      | Completion duplicado                     | ID retirado ignoraba el duplicado                    | Violación segura; sin segundo ack ni segunda completion                              |
| Transferencia cancelada      | Metadata antigua seguida de otro control | Booleano podía descartar binario de otro archivo     | Metadata/binario adyacentes, con tamaño exacto incluso al descartar                  |
| Envío pendiente de lectura   | Dispose, cierre o cancelación            | Referencias/continuación asíncrona podían sobrevivir | Abort comprobado después de awaits y sends; liberar source/current/parts y listeners |
| Nueva transferencia          | Callback de timeout anterior             | Callback no identificaba su generación               | Versión de timer invalida callbacks anteriores                                       |

El estado terminal es estable ante cancel/completion cruzados. Errores del canal se escuchan además de close. Los últimos 16 IDs terminales se retienen con su estado; bytes sin metadata son inválidos. Las URLs de descargas exitosas se conservan solo hasta reemplazo/dispose, igual que antes.

Pruebas del manager: **26**, incluyendo los diez escenarios mínimos pedidos, send que lanza sin evento close, reject/cancel fallidos, cierre esperando ack, ambos órdenes cancel/completion, metadata antigua tras éxito/cancelación, binario suelto, nueva transferencia tras rechazo/cancelación/éxito, dispose durante lectura, callback antiguo, completion duplicado, limpieza de URL y evento error. Se conservan consentimiento, archivos vacíos, chunks, bytes exactos y backpressure.

## 6. Issue 5 — real browser E2E

Cambios: `@playwright/test` como dependencia de desarrollo, `playwright.config.ts`, `e2e/transfer.spec.ts`, script `test:e2e`, configuración Vitest para separar suites, TypeScript incluyendo E2E y pasos de CI.

- Navegadores ejecutados: Chromium ↔ Chromium, dos contextos aislados, un host Windows.
- Vite real en 5188, signaling real en 8099 por test, PeerConnection y DataChannel nativos, sin STUN.
- Dos escenarios con archivo sintético de 2 MiB: consentimiento y comparación exacta; shutdown real de signaling durante transferencia y la misma comparación.
- Antes de aceptar se comprueban nombre/tamaño/Reject, progreso cero y cero envíos binarios observando `DataChannel.send` sin sustituir el transporte.
- Para evitar terminar antes del shutdown, se pausa la quinta lectura Blob tras cuatro chunks; se detiene el servidor y sus sockets, se comprueban warnings en ambos peers y se libera la lectura. No hay sleeps arbitrarios, retries ni transporte simulado.
- Resultado final: **2 PASS**, 11,0 segundos. CI configurado, no ejecutado remotamente. Firefox, dispositivos físicos y NAT distintos no están verificados.

El sandbox local impedía abrir WebRTC; los E2E completos pasaron fuera de ese entorno, con permisos de sockets locales. Una ejecución bloqueada dejó Vite ocupando 5188; se identificó y cerró únicamente su árbol de procesos antes de repetir.

## 7. Security impact

Mejoran resistencia a guessing básico, ocupación indefinida, consistencia de transferencias y supervivencia del transporte P2P. Permanecen Zod strict, 32 KiB signaling, 8 KiB control, 128 MiB archivo, sanitización de nombres, recepción download-only y ningún payload de archivo por WebSocket. No se añadieron previews, almacenamiento de archivos en servidor, autenticación, anonimato ni cifrado propio; se mantiene el lenguaje DTLS.

Fuera de alcance: SHA-256 en producto, múltiples archivos, resume, QR, TURN, persistencia, multiinstancia y protección integral DDoS. El rate limit por conexión no resiste por sí solo clientes distribuidos o reconexiones.

`npm audit` informa dos alertas moderadas en Vitest y su `@vitest/mocker`, dependencias de desarrollo existentes ([GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)). No se aplicó `audit fix --force`: la propuesta de npm implica una versión mayor. El build pasó con avisos no fatales sobre anotaciones de comentarios de Zod.

## 8. Documentation changed

README, SECURITY, PROTOCOL, TESTING, CHANGELOG, este informe, nota de contexto histórico en DELIVERY y consecuencias del ADR 0001. También se actualizó el comentario de caducidad de SessionManager. No se reescribió como actual la validación histórica de DELIVERY.

## 9. Commands executed

Comandos con Node/npm de `D:\node.js` en PATH; la instalación final fue limpia y todos los controles posteriores usaron esa instalación.

| Comando                | Resultado final                                     |
| ---------------------- | --------------------------------------------------- |
| `npm ci`               | PASS — 308 paquetes instalados desde lockfile       |
| `npm run lint`         | PASS                                                |
| `npm run format:check` | PASS                                                |
| `npm run typecheck`    | PASS — strict                                       |
| `npm run test`         | PASS — 70 tests, 11 archivos                        |
| `npm run build`        | PASS — signaling y web                              |
| `npm run test:e2e`     | PASS — 2 Chromium E2E                               |
| `git diff --check`     | PASS                                                |
| `npm audit --json`     | FAIL (exit 1) — dos alertas moderadas de desarrollo |

Incidencias previas corregidas: shim npm inválido en PATH; instalación offline sin acceso al cache; tipado de `verifyClient` y filtro de mensajes de una prueba de expiración; formato del E2E; restricción de sockets del sandbox. Los controles se repitieron después de resolverlas.

Dos intentos de `npm ci` fallaron por DLL nativa bloqueada por el Vite antiguo de 5174, cuyo proceso no permite cierre desde este contexto. Se conservó la carpeta anterior en `output/locked-node_modules-20260908` y se ejecutó `npm ci` sobre un `node_modules` nuevo. No se borraron archivos personales ni se cerraron navegadores del usuario. Esa carpeta está ignorada por Git y se puede retirar cuando el proceso antiguo libere sus archivos.

## 10. Git summary

Commits locales de implementación, en orden:

```text
c172a5b fix(connection): preserve established peers after signaling disconnect
c1f7f61 security(signaling): harden session join codes and rate limits
1d74d64 security(signaling): bound connected session lifetime
6b957fe fix(transfer): harden transfer state races and cleanup
941f5f7 test(e2e): verify real browser file transfers
1d1a906 chore: finalize hardening translations and formatting
```

La documentación cierra la serie con `docs: update v0.1 hardening guarantees`. El hash de ese commit y el resultado final de `git status --short` se entregan junto con este informe. No hubo push ni PR; los cambios se revisan comparando con `066ea75`.

## 11. Remaining recommendations

- Evaluar una actualización compatible de Vitest que resuelva la alerta, con pruebas de migración.
- Ejecutar CI en Linux y comprobar dos dispositivos físicos sobre HTTPS/WSS antes de afirmar cobertura entre redes.
- Para exposición pública, configurar límites de conexión/solicitudes en reverse proxy y la confianza de IP de cliente; Origin no autentica.
- Cerrar el servidor de desarrollo antiguo de 5174 y eliminar la copia ignorada de dependencias bloqueadas cuando Windows la libere.
