// src/pages/api/zones/[id].js
export const prerender = false; // <-- AÑADE ESTA LÍNEA

import { getZoneByIdServer, updateZoneServer, deleteZoneServer } from '../../../lib/zones-crud-server';
import { authorizeAdmin } from '../../../lib/auth-middleware';
import { Buffer } from 'node:buffer'; // Necesario para manejar archivos de FormData

export async function GET({ request, params }) {
  const authResult = await authorizeAdmin(request);
  console.log(`API GET /api/zones/${params.id}: Authorization result:`, authResult);

  if (!authResult.authorized) {
    return new Response(JSON.stringify({ error: authResult.message }), {
      status: authResult.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const zoneId = params.id;
    const zone = await getZoneByIdServer(zoneId);
    if (!zone) {
      return new Response(JSON.stringify({ error: 'Zona no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(zone), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`API GET /api/zones/${params.id} error:`, error);
    return new Response(JSON.stringify({ error: 'Error al obtener zona' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function PUT({ request, params }) {
  const authResult = await authorizeAdmin(request);
  console.log(`API PUT /api/zones/${params.id}: Authorization result:`, authResult);

  if (!authResult.authorized) {
    return new Response(JSON.stringify({ error: authResult.message }), {
      status: authResult.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const zoneId = params.id;
    const formData = await request.formData();

    const updatedData = {
      translations: {
        es: {
          title: formData.get('title_es'),
          description: formData.get('description_es'),
          excerpt: formData.get('excerpt_es'),
        },
        en: {
          title: formData.get('title_en'),
          description: formData.get('description_en'),
          excerpt: formData.get('excerpt_en'),
        },
      },
      pubDate: formData.get('pubDate'),
      coverImage: formData.get('coverImage_clear_flag') === 'true' ? null : undefined, // Flag para borrar imagen
    };

    const coverImageFile = formData.get('coverImageFile');
    let fileBuffer = null;
    if (coverImageFile && coverImageFile.size > 0) {
        fileBuffer = Buffer.from(await coverImageFile.arrayBuffer());
    }

    await updateZoneServer(zoneId, updatedData, fileBuffer);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`API PUT /api/zones/${params.id} error:`, error);
    return new Response(JSON.stringify({ error: 'Error al actualizar zona: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function DELETE({ request, params }) {
  const authResult = await authorizeAdmin(request);
  console.log(`API DELETE /api/zones/${params.id}: Authorization result:`, authResult);

  if (!authResult.authorized) {
    return new Response(JSON.stringify({ error: authResult.message }), {
      status: authResult.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const zoneId = params.id;
    await deleteZoneServer(zoneId);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`API DELETE /api/zones/${params.id} error:`, error);
    return new Response(JSON.stringify({ error: 'Error al borrar zona: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}