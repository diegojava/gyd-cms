// src/pages/api/blog/[id].js

export const prerender = false; // <-- AÑADE ESTA LÍNEA

import { getPostByIdServer, updatePostServer, deletePostServer } from '/src/lib/blog-crud-server';
import { authorizeAdmin } from '/src/lib/auth-middleware';
import { Buffer } from 'node:buffer';

export async function GET({ request, params }) {
  const authResult = await authorizeAdmin(request);
  if (!authResult.authorized) { return new Response(JSON.stringify({ error: authResult.message }), { status: authResult.status, headers: { 'Content-Type': 'application/json' } }); }

  try {
    const post = await getPostByIdServer(params.id);
    if (!post) { return new Response(JSON.stringify({ error: 'Post no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } }); }
    return new Response(JSON.stringify(post), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al obtener post' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function PUT({ request, params }) {
  const authResult = await authorizeAdmin(request);
  if (!authResult.authorized) { return new Response(JSON.stringify({ error: authResult.message }), { status: authResult.status, headers: { 'Content-Type': 'application/json' } }); }

  try {
    const formData = await request.formData();
    const updatedData = {
      translations: {
        es: {
          title: formData.get('title_es'), content: formData.get('content_es'), excerpt: formData.get('excerpt_es') // <-- AÑADIR ESTA LÍNEA
        },
        en: { title: formData.get('title_en'), content: formData.get('content_en'), excerpt: formData.get('excerpt_en') },
      },
      categories: formData.get('categories')?.split(',').map(cat => cat.trim()).filter(cat => cat) || [],
      pubDate: formData.get('pubDate'),
      draft: formData.get('draft') === 'on',
      coverImage: formData.get('coverImage_clear_flag') === 'true' ? null : undefined,
    };

    const coverImageFile = formData.get('coverImageFile');
    let fileBuffer = null;
    if (coverImageFile && coverImageFile.size > 0) {
      fileBuffer = Buffer.from(await coverImageFile.arrayBuffer());
    }

    await updatePostServer(params.id, updatedData, fileBuffer);

    // Después de que el post se creó correctamente, dispara el build.
    if (import.meta.env.NETLIFY_BUILD_HOOK) {
      await fetch(import.meta.env.NETLIFY_BUILD_HOOK, {
        method: 'POST'
      });
      console.log('Build de Netlify disparado por creación de post.');
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al actualizar post: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function DELETE({ request, params }) {
  return; // Esta función se usa para borrar un post específico por ID
  const authResult = await authorizeAdmin(request);
  if (!authResult.authorized) { return new Response(JSON.stringify({ error: authResult.message }), { status: authResult.status, headers: { 'Content-Type': 'application/json' } }); }

  try {
    await deletePostServer(params.id);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al borrar post: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}