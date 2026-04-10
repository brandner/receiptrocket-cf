# ReceiptRocket (Cloudflare Edition)

A modern, fully decoupled application for parsing and storing receipts, designed from the ground up to run entirely on Cloudflare's serverless edge infrastructure using the Google Gemini OCR engine.

## Architecture

This project strictly adheres to a decoupled SPA (Single Page Application) and Worker API paradigm:
- **Frontend (`frontend/`)**: A Vite React TypeScript SPA using Tailwind CSS and `shadcn/ui`. It generates static assets that are hosted on Cloudflare Pages.
- **Backend (`backend/`)**: A Cloudflare Worker built with Hono.js.

### Key Technologies
- **Auth**: Anonymous `localStorage` UUIDs (No Google Auth required).
- **Database**: Cloudflare D1 (Serverless SQLite).
- **Storage**: Cloudflare R2 (S3-compatible Object Storage).
- **AI Processing**: Google Gemini 2.0 Flash (`gemini-2.0-flash` REST API) for highly accurate structured JSON parsing.

## Development Setup

The project requires [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) to be installed.

### 1. Setup the Gemini API Key
To run the extraction engine, add your Gemini API Key.
Create a `.dev.vars` file in the `backend/` directory:
```env
GEMINI_API_KEY="AIzaSyYourApiKeyHere"
```

### 2. Run the Backend API
Open a terminal and navigate to the `backend` folder:
```bash
cd backend
npm install
npm run dev
```
The Hono worker will start on `http://localhost:8787` with local D1/R2 mocked endpoints.

### 3. Run the Frontend SPA
Open a separate terminal and navigate to the `frontend` folder:
```bash
cd frontend
npm install
npm run dev
```
Vite will serve the frontend on `http://localhost:5173`. Its Vite proxy automatically routes `/api` calls directly to the local Hono worker.

---

## Production Deployment to Cloudflare

Deploying to Cloudflare takes less than two minutes.

### Phase 1: Deploy the Backend Worker
You must provision your production databases and upload your secret key.

1. **Navigate to the Backend**
   ```bash
   cd backend
   ```
2. **Provision Production D1 Database**
   ```bash
   npx wrangler d1 create receipt-rocket-db
   ```
   *Take the `database_id` output from this command and update the `[[d1_databases]]` block in your `backend/wrangler.toml`.*
3. **Execute Production Schema Migration**
   ```bash
   npx wrangler d1 execute receipt-rocket-db --remote --file=schema.sql
   ```
4. **Provision Production R2 Bucket**
   ```bash
   npx wrangler r2 bucket create receipt-rocket-receipts
   ```
5. **Upload the Gemini API Key to Cloudflare Secrets**
   ```bash
   npx wrangler secret put GEMINI_API_KEY
   ```
   *Paste your API key when prompted.*
6. **Deploy the Worker**
   ```bash
   npm run deploy
   ```
   *Note the final deployment URL of your worker (e.g. `https://receipt-rocket-worker.<your-username>.workers.dev`).*

### Phase 2: Deploy the Frontend to Cloudflare Pages
1. **Navigate to the Frontend**
   ```bash
   cd frontend
   ```
2. **Build the React SPA**
   First, update the `vite.config.ts` or `src/App.tsx` routes so it points to your newly deployed backend worker URL instead of `localhost:8787`. Then build:
   ```bash
   npm run build
   ```
3. **Deploy to Cloudflare Pages**
   ```bash
   npx wrangler pages deploy dist --project-name receiptrocket-ui
   ```

You can now open the provided Pages URL and use the fully serverless ReceiptRocket app!
