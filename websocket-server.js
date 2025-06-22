const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3000 });
const clients = new Map();

console.log('📡 Servidor WebSocket iniciado en ws://localhost:3000');

wss.on('connection', (ws) => {
    console.log('🟢 Cliente conectado');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📩 Mensaje recibido:', data);

            // Unirse a la sala
            if (data.type === 'join') {
                clients.set(ws, {
                    name: data.name,
                    rol: data.rol || 'alumno',
                    mic: true,
                    video: true
                });
                console.log(`✅ Participante unido: ${data.name}`);
                broadcastParticipants();
            }

            // Chat entre usuarios
            if (data.type === 'chat') {
                const senderInfo = clients.get(ws);
                const senderName = senderInfo?.name || data.from;

                const messageToSend = {
                    type: 'chat',
                    from: senderName,
                    message: data.message,
                    time: data.time
                };

                for (const client of clients.keys()) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(messageToSend));
                    }
                }
            }

            // Expulsión por nombre
            if (data.type === 'expulsar') {
                for (const [client, info] of clients.entries()) {
                    if (info.name === data.target) {
                        console.log(`🚫 Expulsando a: ${data.target}`);
                        client.send(JSON.stringify({ type: 'expulsado' }));
                        setTimeout(() => client.close(), 500);
                    }
                }
            }

            // Silenciar usuario
            if (data.type === 'silenciar') {
                for (const [client, info] of clients.entries()) {
                    if (info.name === data.target) {
                        info.mic = false;
                        console.log(`🔇 Silenciando a: ${data.target}`);
                        broadcastParticipants();
                    }
                }
            }

            // Señalización WebRTC
            if (['offer', 'answer', 'candidate'].includes(data.type)) {
                const senderInfo = clients.get(ws);
                const senderName = senderInfo?.name || data.from;

                for (const [client, info] of clients.entries()) {
                    if (info.name === data.to && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: data.type,
                            from: senderName,
                            ...(data.offer && { offer: data.offer }),
                            ...(data.answer && { answer: data.answer }),
                            ...(data.candidate && { candidate: data.candidate })
                        }));
                        break;
                    }
                }
            }

        } catch (error) {
            console.error('❌ Error al procesar mensaje:', error);
        }
    });

    ws.on('close', () => {
        const info = clients.get(ws);
        console.log(`❌ Cliente desconectado: ${info?.name}`);
        clients.delete(ws);
        broadcastParticipants();
    });
});

// Difundir lista de participantes
function broadcastParticipants() {
    const participants = Array.from(clients.values()).map(c => ({
        name: c.name,
        rol: c.rol,
        mic: c.mic,
        video: c.video
    }));

    const message = {
        type: 'participants-list',
        data: participants
    };

    for (const client of clients.keys()) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    }
}
