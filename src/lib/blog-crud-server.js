// src/lib/blog-crud-server.js
import * as adminModule from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { Buffer } from 'node:buffer';

// El objeto 'admin' del SDK sigue siendo necesario para operaciones como FieldValue.delete()
const admin = adminModule.default;

// 1. IMPORTAMOS LA NUEVA FUNCIÓN DE INICIALIZACIÓN
import { getFirebaseAdmin } from './firebase-admin-config';

// --- Funciones de ayuda (sin cambios) ---
function generateSlug(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function isEmptyHtml(htmlString) {
  if (!htmlString) return true;
  const plainText = htmlString.replace(/<[^>]*>/g, '').trim();
  return plainText === '';
}


// --- 1. CREAR POST (Create) ---
export async function createPostServer(postData, coverImageBuffer = null) {
  // 2. OBTENEMOS LAS INSTANCIAS DE FIREBASE AL INICIO DE LA FUNCIÓN
  const { adminDb, adminStorage } = getFirebaseAdmin();
  if (!adminDb || !adminStorage) {
    throw new Error("La conexión con Firebase (adminDb o adminStorage) no está inicializada.");
  }

  try {
    let finalData = { ...postData };

    if (coverImageBuffer) {
      const bucket = adminStorage.bucket();
      const fileName = `images/posts/${generateSlug(postData.translations?.es?.title || 'sin-titulo')}-${Date.now()}`;
      const file = bucket.file(fileName);
      await file.save(coverImageBuffer);
      await file.makePublic();
      finalData.coverImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    } else {
      finalData.coverImage = '';
    }

    finalData.pubDate = Timestamp.fromDate(new Date(finalData.pubDate || Date.now()));
    finalData.slug = {
      es: finalData.translations?.es?.title ? generateSlug(finalData.translations.es.title) : '',
      en: finalData.translations?.en?.title ? generateSlug(finalData.translations.en.title) : ''
    };

    finalData.translations = finalData.translations || { en: {}, es: {} };
    finalData.translations.es.content = finalData.translations.es.content || '';
    finalData.translations.es.excerpt = finalData.translations.es.excerpt || '';
    finalData.translations.en.content = finalData.translations.en.content || '';
    finalData.translations.en.excerpt = finalData.translations.en.excerpt || '';
    finalData.categories = finalData.categories || [];
    finalData.draft = typeof finalData.draft === 'boolean' ? finalData.draft : true;

    const docRef = await adminDb.collection("posts").add(finalData);
    return docRef.id;
  } catch (error) {
    console.error("[createPostServer] Error:", error);
    throw error;
  }
}

// --- 2. LEER POSTS (Read) ---
export async function getAllPostsServer() {
  const { adminDb } = getFirebaseAdmin();
  if (!adminDb) {
    throw new Error("La conexión con Firebase (adminDb) no está inicializada.");
  }

  try {
    // Ordenamos por fecha de publicación descendente, que es lo común en un blog.
    const querySnapshot = await adminDb.collection("posts").orderBy('pubDate', 'desc').get();
    const posts = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Convertimos el Timestamp a un string ISO para que sea compatible con JSON
      if (data.pubDate instanceof Timestamp) {
        data.pubDate = data.pubDate.toDate().toISOString();
      }
      posts.push({ id: doc.id, ...data });
    });
    return posts;
  } catch (error) {
    console.error("[getAllPostsServer] Error:", error);
    throw error;
  }
}

export async function getPostByIdServer(postId) {
  const { adminDb } = getFirebaseAdmin();
  if (!adminDb) {
    throw new Error("La conexión con Firebase (adminDb) no está inicializada.");
  }

  try {
    const docSnap = await adminDb.collection("posts").doc(postId).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data.pubDate instanceof Timestamp) {
        data.pubDate = data.pubDate.toDate().toISOString();
      }
      return { id: docSnap.id, ...data };
    }
    return null;
  } catch (error) {
    console.error("[getPostByIdServer] Error:", error);
    throw error;
  }
}

// --- 3. ACTUALIZAR POST (Update) ---
export async function updatePostServer(postId, updatedData, newCoverImageBuffer = null) {
  const { adminDb, adminStorage } = getFirebaseAdmin();
  if (!adminDb || !adminStorage) {
    throw new Error("La conexión con Firebase (adminDb o adminStorage) no está inicializada.");
  }

  try {
    const postRef = adminDb.collection("posts").doc(postId);
    let finalDataToProcess = { ...updatedData };
    delete finalDataToProcess.translations;

    if (finalDataToProcess.pubDate) {
      finalDataToProcess.pubDate = Timestamp.fromDate(new Date(finalDataToProcess.pubDate));
    }

    if (newCoverImageBuffer) {
      const bucket = adminStorage.bucket();
      // ... (lógica para subir y borrar imagen antigua)
    } else if (updatedData.coverImage === null) {
      const bucket = adminStorage.bucket();
      // ... (lógica para borrar imagen existente)
    }

    const esTrans = updatedData.translations?.es || {};
    const enTrans = updatedData.translations?.en || {};

    if (esTrans.title !== undefined) finalDataToProcess['translations.es.title'] = esTrans.title;
    if (enTrans.title !== undefined) finalDataToProcess['translations.en.title'] = enTrans.title;
    if (esTrans.content !== undefined) finalDataToProcess['translations.es.content'] = isEmptyHtml(esTrans.content) ? admin.firestore.FieldValue.delete() : esTrans.content;
    if (enTrans.content !== undefined) finalDataToProcess['translations.en.content'] = isEmptyHtml(enTrans.content) ? admin.firestore.FieldValue.delete() : enTrans.content;
    if (esTrans.excerpt !== undefined) finalDataToProcess['translations.es.excerpt'] = isEmptyHtml(esTrans.excerpt) ? admin.firestore.FieldValue.delete() : esTrans.excerpt;
    if (enTrans.excerpt !== undefined) finalDataToProcess['translations.en.excerpt'] = isEmptyHtml(enTrans.excerpt) ? admin.firestore.FieldValue.delete() : enTrans.excerpt;

    if (esTrans.title !== undefined) finalDataToProcess['slug.es'] = generateSlug(esTrans.title);
    if (enTrans.title !== undefined) finalDataToProcess['slug.en'] = generateSlug(enTrans.title);

    const dataToUpdate = {};
    for (const key in finalDataToProcess) {
      if (finalDataToProcess[key] !== undefined) {
        dataToUpdate[key] = finalDataToProcess[key];
      }
    }

    await postRef.update(dataToUpdate);
  } catch (error) {
    console.error("[updatePostServer] Error:", error);
    throw error;
  }
}

// --- 4. BORRAR POST (Delete) ---
export async function deletePostServer(postId) {
  const { adminDb, adminStorage } = getFirebaseAdmin();
  if (!adminDb || !adminStorage) {
    throw new Error("La conexión con Firebase (adminDb o adminStorage) no está inicializada.");
  }

  try {
    const postRef = adminDb.collection("posts").doc(postId);
    const postDoc = await postRef.get();

    if (postDoc.exists) {
      const imageUrl = postDoc.data().coverImage;
      if (imageUrl && imageUrl.includes("storage.googleapis.com")) {
        const bucket = adminStorage.bucket();
        try {
          const imagePath = imageUrl.split(`${bucket.name}/`)[1];
          if (imagePath) await bucket.file(decodeURIComponent(imagePath)).delete();
        } catch (e) {
          console.warn("No se pudo borrar la imagen de Storage:", e.message);
        }
      }
      await postRef.delete();
    }
  } catch (error) {
    console.error("[deletePostServer] Error:", error);
    throw error;
  }
}