/** English source strings are stable keys; protocol values and filenames are never translated. */
export const spanish: Record<string, string> = {
  'Signaling disconnected. Your established P2P connection continues.':
    'Se perdió la señalización. Tu conexión P2P establecida continúa.',
  'PeerBeam home': 'Inicio de PeerBeam',
  'Open source. Open by design.': 'Código abierto. Transparente por diseño.',
  'DEVICE TO DEVICE. NOTHING IN BETWEEN.*':
    'DE DISPOSITIVO A DISPOSITIVO. SIN INTERMEDIARIOS.*',
  'Your files.': 'Tus archivos.',
  'A direct line.': 'Una conexión directa.',
  'That’s it.': 'Así de simple.',
  'P2P file transfer you can actually inspect.':
    'Transferencias P2P que puedes inspeccionar.',
  'Connect two browsers. Share a file.':
    'Conecta dos navegadores. Comparte un archivo.',
  'See exactly how it gets there.': 'Mira exactamente cómo llega a su destino.',
  'Your device': 'Tu dispositivo',
  'Other device': 'Otro dispositivo',
  'One peer. One connection.': 'Dos dispositivos. Una conexión.',
  '* File bytes travel over WebRTC. A small signaling server helps the browsers find each other.':
    '* Los archivos viajan por WebRTC. Un pequeño servidor de señalización ayuda a los navegadores a encontrarse.',
  'Ready when you are': 'Todo listo para empezar',
  'Reaching signaling server': 'Conectando al servidor',
  'Waiting for another device': 'Esperando otro dispositivo',
  'Connecting to your peer': 'Conectando al otro dispositivo',
  'Peer connected': 'Dispositivo conectado',
  'Connection ended': 'Conexión finalizada',
  '01 / CONNECT': '01 / CONECTAR',
  'Your code': 'Tu código',
  'Leave session': 'Salir de la sesión',
  'Copied ✓': 'Copiado ✓',
  'Copy code': 'Copiar código',
  'Making a direct connection…': 'Estableciendo la conexión…',
  'Bring your other device.': 'Conecta tu otro dispositivo.',
  'Open PeerBeam there, choose Join session, and enter this code.':
    'Abre PeerBeam allí, elige Unirse a una sesión e introduce este código.',
  'Waiting codes expire after 10 minutes.':
    'Los códigos en espera caducan a los 10 minutos.',
  'Drop a file here': 'Arrastra un archivo aquí',
  'or choose one from your device': 'o selecciona uno de tu dispositivo',
  'Choose file': 'Elegir archivo',
  'One file at a time · Up to 128 MiB': 'Un archivo a la vez · Hasta 128 MiB',
  'Files never pass through the signaling server.':
    'Los archivos nunca pasan por el servidor de señalización.',
  'PeerBeam principles': 'Principios de PeerBeam',
  'Direct by default': 'Conexión directa',
  'Your file moves between browsers over an encrypted WebRTC channel.':
    'Tu archivo viaja entre navegadores por un canal WebRTC cifrado.',
  'Permission comes first': 'Primero, tu permiso',
  'Nothing starts until the other person accepts the file.':
    'Nada comienza hasta que la otra persona acepta el archivo.',
  'No black boxes': 'Sin cajas negras',
  'Inspect connection states, chunks, and transfer speed as they happen.':
    'Inspecciona los estados de conexión, los bloques y la velocidad en tiempo real.',
  '/ built to be understood.': '/ hecho para entenderlo.',
  'Two devices. Zero accounts.': 'Dos dispositivos. Cero cuentas.',
  'MIT licensed.': 'Licencia MIT.',
  'Connect devices': 'Conectar dispositivos',
  'Create session': 'Crear sesión',
  'Join session': 'Unirse a una sesión',
  'A small code.': 'Un código corto.',
  'A direct connection.': 'Una conexión directa.',
  'Create a private session, then share its code with your other device.':
    'Crea una sesión privada y comparte su código con tu otro dispositivo.',
  'Connecting…': 'Conectando…',
  'No account. No installation. Just two devices.':
    'Sin cuentas ni instalaciones. Solo dos dispositivos.',
  'Your other device': 'Tu otro dispositivo',
  'is one code away.': 'está a un código de distancia.',
  'Enter the code shown on the device that created the session.':
    'Introduce el código que aparece en el dispositivo que creó la sesión.',
  'Enter session code': 'Código de la sesión',
  Connect: 'Conectar',
  'Permission required': 'Se requiere permiso',
  'Incoming file': 'Archivo entrante',
  '· Only accept files you expect.': '· Acepta solo los archivos que esperas.',
  Accept: 'Aceptar',
  Reject: 'Rechazar',
  'Waiting for acceptance': 'Esperando aceptación',
  'Preparing transfer': 'Preparando transferencia',
  'Sending file': 'Enviando archivo',
  'Receiving file': 'Recibiendo archivo',
  'Waiting for receiver confirmation': 'Esperando confirmación del receptor',
  'Transfer complete': 'Transferencia completada',
  'File rejected': 'Archivo rechazado',
  'Transfer cancelled': 'Transferencia cancelada',
  'Transfer interrupted': 'Transferencia interrumpida',
  'File transfer': 'Transferencia de archivo',
  Outgoing: 'Saliente',
  Incoming: 'Entrante',
  'Transfer progress': 'Progreso de la transferencia',
  'Speed unavailable': 'Velocidad no disponible',
  chunks: 'bloques',
  average: 'de media',
  avg: 'media',
  'Cancel transfer': 'Cancelar transferencia',
  'Download file': 'Descargar archivo',
  'ICE state': 'Estado ICE',
  'Peer connection': 'Conexión del dispositivo',
  'Data channel': 'Canal de datos',
  'Local candidate': 'Candidato local',
  'Remote candidate': 'Candidato remoto',
  'Connection type': 'Tipo de conexión',
  'Bytes sent': 'Bytes enviados',
  'Bytes received': 'Bytes recibidos',
  'Transfer speed': 'Velocidad de transferencia',
  Chunks: 'Bloques',
  Unavailable: 'No disponible',
  'Connection details': 'Detalles de conexión',
  'Developer mode': 'Modo desarrollador',
  'Live WebRTC states and getStats() values. Missing metrics are marked unavailable. Byte counters include data channel control messages; progress counts file payload only.':
    'Estados WebRTC y valores de getStats() en tiempo real. Las métricas ausentes se indican como no disponibles. Los contadores incluyen mensajes de control; el progreso cuenta solo los bytes del archivo.',
  Language: 'Idioma',
  'Switch to light mode': 'Cambiar a modo día',
  'Switch to dark mode': 'Cambiar a modo noche',
  Day: 'Día',
  Night: 'Noche',
  'Choose one file at a time in v0.1.': 'Elige un archivo a la vez en v0.1.',
  'Could not copy. Select and copy the code manually.':
    'No se pudo copiar. Selecciona y copia el código manualmente.',
  'Invalid signaling message. Please restart the session.':
    'Mensaje de señalización no válido. Reinicia la sesión.',
  'Session not found. Check the code or ask for a new one.':
    'Sesión no encontrada. Revisa el código o solicita uno nuevo.',
  'Session full. Only two devices can connect.':
    'Sesión llena. Solo pueden conectarse dos dispositivos.',
  'You are already in a session.': 'Ya estás en una sesión.',
  'Your session ended. Create or join a new one.':
    'Tu sesión terminó. Crea una nueva o únete a otra.',
  'The other device is no longer available.':
    'El otro dispositivo ya no está disponible.',
  'Session expired. Create a new code.':
    'La sesión caducó. Crea un código nuevo.',
  'Too many requests. Wait a moment before trying again.':
    'Demasiadas solicitudes. Espera un momento antes de intentarlo de nuevo.',
  'The signaling server is busy. Please try again later.':
    'El servidor de señalización está ocupado. Inténtalo más tarde.',
  'Invalid code. Enter 8 letters or numbers, excluding I, O, 0 and 1.':
    'Código no válido. Introduce 8 letras o números, sin I, O, 0 ni 1.',
  'Peer disconnected. Any active transfer was interrupted. Start a new session.':
    'El dispositivo se desconectó. Las transferencias activas se interrumpieron. Inicia una nueva sesión.',
  'Peer setup is unavailable.':
    'La configuración del dispositivo no está disponible.',
  'WebRTC connection failed.': 'La conexión WebRTC falló.',
  'Connection failed.': 'La conexión falló.',
  'Signaling disconnected during connection setup.':
    'La señalización se desconectó al establecer la conexión.',
  'WebRTC failed. This network may require TURN, which v0.1 does not provide.':
    'WebRTC falló. Esta red puede requerir TURN, que no está disponible en v0.1.',
  'Peer connection interrupted. Start a new session.':
    'La conexión se interrumpió. Inicia una nueva sesión.',
  'Connection failed: WebRTC timed out. Try devices on the same network.':
    'Se agotó el tiempo de conexión WebRTC. Prueba con dispositivos en la misma red.',
  'Data channel failed. Transfer interrupted.':
    'El canal de datos falló. Transferencia interrumpida.',
  'Data channel closed. Transfer interrupted.':
    'El canal de datos se cerró. Transferencia interrumpida.',
  'Too many ICE candidates.': 'Demasiados candidatos ICE.',
  'The signaling server sent an invalid message.':
    'El servidor de señalización envió un mensaje no válido.',
  'WebSocket disconnected. Start a new session to reconnect.':
    'WebSocket se desconectó. Inicia una nueva sesión para reconectar.',
  'Signaling connection timed out.':
    'Se agotó el tiempo de conexión al servidor.',
  'Cannot reach the signaling server. Check its address and try again.':
    'No se puede conectar al servidor de señalización. Revisa su dirección e inténtalo de nuevo.',
  'WebSocket disconnected.': 'WebSocket desconectado.',
  'Session closed.': 'Sesión cerrada.',
  'Connect a device before sending a file.':
    'Conecta un dispositivo antes de enviar un archivo.',
  'Transfer failed.': 'La transferencia falló.',
  'Finish or cancel the current transfer first.':
    'Termina o cancela la transferencia actual primero.',
  'This file cannot be transferred. The v0.1 limit is 128 MiB.':
    'No se puede transferir este archivo. El límite de v0.1 es 128 MiB.',
  'Data channel is not open.': 'El canal de datos no está abierto.',
  'Invalid transfer data. The connection was closed.':
    'Datos de transferencia no válidos. La conexión se cerró.',
  'Transfer interrupted.': 'Transferencia interrumpida.',
  'The other device reported a transfer error.':
    'El otro dispositivo informó un error de transferencia.',
  'Source file unavailable.': 'El archivo de origen no está disponible.',
  'Transfer timed out. Try sending the file again.':
    'Se agotó el tiempo de transferencia. Intenta enviar el archivo de nuevo.',
  'Transfer interrupted: peer disconnected.':
    'Transferencia interrumpida: el dispositivo se desconectó.',
  'Transfer cancelled.': 'Transferencia cancelada.',
  'Data channel closed.': 'Canal de datos cerrado.',
  'Transfer stalled while waiting for the network.':
    'La transferencia se detuvo mientras esperaba a la red.',
};

export type Language = 'en' | 'es';
export function translate(language: Language, message: string): string {
  return language === 'es' ? (spanish[message] ?? message) : message;
}
