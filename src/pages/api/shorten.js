// src/pages/api/shorten.js
import { getFirebaseAdmin } from "../../lib/firebase-admin-config.js";
import { authorizeAdmin } from "../../lib/auth-middleware.js";

// Función para generar un ID corto y aleatorio
function generateShortKey(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export async function POST({ request }) {
    const authResult = await authorizeAdmin(request);
    if (!authResult.authorized) {
        return new Response(JSON.stringify({ error: authResult.message }), { status: authResult.status });
    }

    try {
        const { longUrl } = await request.json();
        if (!longUrl || !longUrl.startsWith('http')) {
            return new Response(JSON.stringify({ error: "URL inválida proporcionada." }), { status: 400 });
        }

        const { adminDb } = getFirebaseAdmin();
        if (!adminDb) throw new Error("Firebase no inicializado.");

        const shortKey = generateShortKey();
        const linkRef = adminDb.collection('shortlinks').doc(shortKey);

        await linkRef.set({ longUrl });

        const shortUrl = `https://getyourdepa.com/r/${shortKey}`; // Usa el dominio de tu sitio público

        return new Response(JSON.stringify({ success: true, shortUrl }), { status: 201 });

    } catch (error) {
        console.error("Error al acortar URL:", error);
        return new Response(JSON.stringify({ error: "No se pudo crear el enlace corto." }), { status: 500 });
    }
}