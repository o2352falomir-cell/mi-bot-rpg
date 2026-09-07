import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { GoogleGenAI } from '@google/genai';

// Configuración de la IA de Google (Usa la variable de entorno para seguridad)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const CONTEXTO_RPG = `
Actúas como el Master de un RPG de Naruto en WhatsApp.
LISTA DE PERSONAJES:
- Sasuke / HP: 100 / Chakra: 50 / Jutsus: Chidori
- Naruto / HP: 120 / Chakra: 40 / Jutsus: Rasengan
- Kakashi / HP: 90 / Chakra: 70 / Jutsus: Raikiri

REGLAS DE JUEGO:
1. Ignora el número de teléfono. Guíate estrictamente si el mensaje inicia con '[Nombre del Personaje]: Acción'.
2. Si un usuario no usa este formato exacto, recuérdaselo amablemente en una sola línea.
3. Narra los entrenamientos o físicas de forma creativa y breve (máximo 3 líneas). Especifica claramente los puntos de estadística modificados.
`;

async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_whatsapp');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if(qr) {
            console.log('--- ESCANEA ESTE CÓDIGO QR EN LA NUBE ---');
            qrcode.generate(qr, { small: true });
        }
        if(connection === 'close') {
            const deberiaReiniciar = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if(deberiaReiniciar) iniciarBot();
        } else if(connection === 'open') {
            console.log('¡Bot de Rol Conectado y en línea 24/7!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const textoChat = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const idGrupo = msg.key.remoteJid;

        if (textoChat.includes('[') && textoChat.includes(']')) {
            try {
                // Llamada oficial a la IA gratuita de Gemini
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: [
                        { role: 'user', parts: [{ text: CONTEXTO_RPG + "\n\nMensaje del jugador:\n" + textoChat }] }
                    ],
                });

                await sock.sendMessage(idGrupo, { text: response.text });
            } catch (error) {
                console.error("Error con Gemini API:", error);
            }
        }
    });
}

iniciarBot();