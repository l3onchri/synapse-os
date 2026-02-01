# Deploy Synapse OS

## 0. Caricare su GitHub (Primo Passo)
Ho già inizializzato Git e creato il primo commit sul tuo PC. Ora devi metterlo online.

1.  Vai su [GitHub.com/new](https://github.new) e crea un repository vuoto (chiamalo `synapse-os`).
2.  Non aggiungere README o .gitignore (ci sono già).
3.  Copia il link del repo (es. `https://github.com/tuonome/synapse-os.git`).
4.  Apri il terminale nella cartella del progetto e scrivi:
    ```bash
    git remote add origin https://github.com/TUO_NOME_UTENTE/synapse-os.git
    git branch -M main
    git push -u origin main
    ```

Poiché l'applicazione ha due componenti (Frontend React e Backend Stripe Node.js), la soluzione migliore e gratuita è usare due servizi separati.

## 1. Backend (Stripe Server) -> Hugging Face Spaces
Il servizio pagamenti vive qui.

1.  Vai su [Hugging Face Spaces](https://huggingface.co/spaces) -> **Create new Space**.
    *   **Space Name**: `synapse-backend` (o simile).
    *   **SDK**: **Docker** (Molto importante! Non scegliere "Static" o "Gradio").
    *   **License**: MIT.
2.  Clona il repo dello Space sul tuo PC o usa l'interfaccia web "Files" per caricare SOLO questi 3 file:
    *   `server.js`
    *   `package.json`
    *   `Dockerfile` (l'ho appena creato per te)
3.  Vai su **Settings** dello Space -> **Variables and secrets**.
    *   Crea un **New Secret**: `STRIPE_SECRET_KEY` con valore `sk_test_...` (prendilo dal tuo .env).
4.  Attendi che lo Space diventi "Running". Copia l'URL in alto (es. `https://huggingface.co/spaces/tuonome/synapse-backend` -> che diventa un link diretto tipo `https://tuonome-synapse-backend.hf.space`).

**Importante**: L'URL API sarà `https://[TUO-SPACE].hf.space/create-payment-intent`. Usalo nel passaggio sotto.

## 2. Frontend (React Site) -> Vercel / Netlify
Il sito web vero e proprio.

1.  Nel file `src/App.jsx`, cerca la riga dove facciamo la `fetch` al server locale:
    ```javascript
    // MODIFICA QUESTO:
    fetch('http://localhost:4242/create-payment-intent', ...)
    
    // CON QUESTO (L'URL che ti ha dato Hugging Face):
    fetch('https://l3onchri-synapse-backend.hf.space/create-payment-intent', ...)
    ```
2.  Crea un repo GitHub "synapse-frontend".
3.  Vai su [Vercel](https://vercel.com) -> Add New Project.
4.  Collega il repo.
5.  Inserisci le Variabili d'Ambiente (da `.env`):
    *   `VITE_SUPABASE_URL`
    *   `VITE_SUPABASE_ANON_KEY`
    *   `VITE_STRIPE_PUBLISHABLE_KEY`
    *   `VITE_OPENROUTER_API_KEY`
    *   `VITE_YOUTUBE_API_KEY`
6.  Deploy.

## Alternativa Rapida (Solo Frontend)
Se non vuoi deployare il server, i pagamenti NON funzioneranno online, ma tutto il resto (AI, Auth) sì. In quel caso basta fare il punto 2 su Vercel.
