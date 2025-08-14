// src/pages/api/blog/index.js
import { getAllPostsServer, createPostServer } from '../../../lib/blog-crud-server.js';
import { authorizeAdmin } from '../../../lib/auth-middleware.js';
import { Buffer } from 'node:buffer';

export async function GET({ request }) {
  const authResult = await authorizeAdmin(request);
  console.log("Authorization result:", authResult);

  if (!authResult.authorized) { return new Response(JSON.stringify({ error: authResult.message }), { status: authResult.status, headers: { 'Content-Type': 'application/json' } }); }
  try {
    const posts = await getAllPostsServer();
    return new Response(JSON.stringify(posts), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al obtener posts' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function POST({ request }) {
  const authResult = await authorizeAdmin(request);
  if (!authResult.authorized) { return new Response(JSON.stringify({ error: authResult.message }), { status: authResult.status, headers: { 'Content-Type': 'application/json' } }); }

  try {
    const formData = await request.formData();
    const postData = {
      translations: {
        es: { title: formData.get('title_es'), content: formData.get('content_es'), excerpt: formData.get('excerpt_es') },
        en: { title: formData.get('title_en'), content: formData.get('content_en'), excerpt: formData.get('excerpt_en') },
      },
      categories: formData.get('categories')?.split(',').map(cat => cat.trim()).filter(cat => cat) || [],
      pubDate: formData.get('pubDate'),
      draft: formData.get('draft') === 'on',
    };

    const coverImageFile = formData.get('coverImageFile');
    let fileBuffer = null;
    if (coverImageFile && coverImageFile.size > 0) {
      fileBuffer = Buffer.from(await coverImageFile.arrayBuffer());
    }

    const postId = await createPostServer(postData, fileBuffer);

    // Después de que el post se creó correctamente, dispara el build.
    if (import.meta.env.NETLIFY_BUILD_HOOK) {
      await fetch(import.meta.env.NETLIFY_BUILD_HOOK, {
        method: 'POST'
      });
      console.log('Build de Netlify disparado por creación de post.');
    }

    return new Response(JSON.stringify({ success: true, postId }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al crear post: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}