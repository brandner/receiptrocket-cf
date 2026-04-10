import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Buffer } from 'node:buffer';

export interface Env {
  DB: D1Database;
  RECEIPTS_BUCKET: R2Bucket;
  GEMINI_API_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: '*', // In production, replace with your frontend URL
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-User-ID'],
}));

// Middleware to extract X-User-ID
app.use('*', async (c, next) => {
  if (c.req.method !== 'OPTIONS' && !c.req.path.startsWith('/api/images')) {
    const userId = c.req.header('X-User-ID');
    if (!userId) {
      return c.json({ error: 'Unauthorized: Missing X-User-ID' }, 401);
    }
  }
  await next();
});

app.get('/', (c) => c.text('ReceiptRocket API is running'));

// --- GET receipts ---
app.get('/api/receipts', async (c) => {
  const userId = c.req.header('X-User-ID')!;
  
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM receipts WHERE user_id = ? ORDER BY date DESC'
    ).bind(userId).all();
    
    // Map SQLite snake_case columns back to React's expected camelCase properties
    const mappedReceipts = results.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      companyName: row.company_name,
      description: row.description,
      totalAmount: row.total_amount,
      gst: row.gst,
      pst: row.pst,
      image: row.image_url,
      imagePath: row.image_path,
      date: row.date
    }));
    
    return c.json({ receipts: mappedReceipts });
  } catch (error: any) {
    console.error(error);
    return c.json({ error: 'Failed to retrieve receipts' }, 500);
  }
});

// --- DELETE receipt ---
app.delete('/api/receipts/:id', async (c) => {
  const userId = c.req.header('X-User-ID')!;
  const id = c.req.param('id');
  
  try {
    const receipt = await c.env.DB.prepare(
      'SELECT * FROM receipts WHERE id = ? AND user_id = ?'
    ).bind(id, userId).first();
    
    if (!receipt) {
      return c.json({ error: 'Receipt not found or unauthorized' }, 404);
    }
    
    if (receipt.image_path) {
      await c.env.RECEIPTS_BUCKET.delete(receipt.image_path as string);
    }
    
    await c.env.DB.prepare('DELETE FROM receipts WHERE id = ?').bind(id).run();
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return c.json({ error: 'Failed to delete receipt' }, 500);
  }
});

// --- UPLOAD receipt ---
app.post('/api/upload', async (c) => {
  const userId = c.req.header('X-User-ID')!;
  const body = await c.req.parseBody();
  const file = body['photo'];
  
  if (!file || !(file instanceof File)) {
    return c.json({ error: 'Invalid file upload' }, 400);
  }

  try {
    const fileData = await file.arrayBuffer();
    const uint8Array = new Uint8Array(fileData);
    
    // 1. Run AI Extraction via Google Gemini
    // Convert ArrayBuffer to Base64 for the API payload using native NodeJS Buffer module injected by nodejs_compat
    const base64Image = Buffer.from(uint8Array).toString('base64');
    
    let extractedData = { companyName: null, description: null, totalAmount: null, gst: null, pst: null };
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${c.env.GEMINI_API_KEY}`;
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Analyze the receipt image provided and extract the following information:\n- Company Name\n- A short description of what the receipt is for (e.g. 'Groceries', 'Dinner', 'Gas')\n- GST (if available)\n- PST (if available)\n- Total Amount" },
              {
                inlineData: {
                  mimeType: file.type || 'image/jpeg',
                  data: base64Image
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                companyName: { type: "STRING", description: "Name of the business", nullable: true },
                description: { type: "STRING", description: "3-6 word summary of items bought", nullable: true },
                totalAmount: { type: "NUMBER", description: "Total amount charged", nullable: true },
                gst: { type: "NUMBER", description: "Total GST tax amount if present", nullable: true },
                pst: { type: "NUMBER", description: "Total PST tax amount if present", nullable: true }
              }
            }
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error: ${response.status} ${errText}`);
      }

      const rawJson = await response.json() as any;
      const resultText = rawJson.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!resultText) {
        throw new Error("Empty response from Gemini");
      }

      // Gemini strictly returns validated JSON directly matching the exact schema!
      extractedData = JSON.parse(resultText);

    } catch (apiError) {
      console.error('Failed to parse Receipt via Gemini:', apiError);
      return c.json({ error: 'Failed to extract JSON from receipt image' }, 500);
    }

    // 2. Upload to R2 Bucket
    const fileId = crypto.randomUUID();
    const mimeType = file.type || 'image/jpeg';
    const ext = file.name.split('.').pop() || 'jpg';
    const objectKey = `receipts/${fileId}.${ext}`;
    
    await c.env.RECEIPTS_BUCKET.put(objectKey, fileData, {
      httpMetadata: { contentType: mimeType }
    });
    
    // Public URL (for production, configure a custom domain on the bucket)
    // For local dev / unconfigured buckets, we return a worker-proxied route or just the relative path
    const imageUrl = `/api/images/${objectKey}`; 

    // 3. Save to D1 Database
    await c.env.DB.prepare(
      `INSERT INTO receipts (id, user_id, company_name, description, total_amount, gst, pst, image_url, image_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      fileId,
      userId,
      extractedData.companyName || null,
      extractedData.description || null,
      extractedData.totalAmount || null,
      extractedData.gst || null,
      extractedData.pst || null,
      imageUrl,
      objectKey
    ).run();

    return c.json({ success: true, receiptId: fileId, data: extractedData, imageUrl });

  } catch (error: any) {
    console.error('Upload Error:', error);
    return c.json({ error: 'Internal server error processing receipt' }, 500);
  }
});

// --- PROXY images (since R2 standard bucket isn't strictly public unless configured) ---
app.get('/api/images/receipts/:key', async (c) => {
  const key = 'receipts/' + c.req.param('key');
  const object = await c.env.RECEIPTS_BUCKET.get(key);
  
  if (object === null) {
    return new Response('Object Not Found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  return new Response(object.body, { headers });
});

export default app;
