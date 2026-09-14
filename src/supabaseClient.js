import { createClient } from "@supabase/supabase-js";

// Le chiavi vengono lette dalle variabili d'ambiente Vite (file .env, mai
// da committare su Git). La chiave "anon" è pensata per essere pubblica:
// è sicura da esporre nel codice del sito, l'accesso reale è controllato
// dalle policy di Row Level Security definite nel database.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Un client "finto" che non fa nulla, usato solo se manca la configurazione.
// Serve a evitare che l'intero sito smetta di funzionare (pagina bianca/nera)
// quando le variabili d'ambiente non sono ancora state impostate: meglio che
// il logging su Supabase resti silenziosamente inattivo piuttosto che
// bloccare la visualizzazione di tutto il resto dell'app.
function createNoopClient() {
  const noopBuilder = {
    insert: async () => ({ data: null, error: null }),
    select: () => noopBuilder,
    order: () => noopBuilder,
    limit: async () => ({ data: [], error: null }),
  };
  return { from: () => noopBuilder };
}

let client;
if (supabaseUrl && supabaseAnonKey) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey);
  } catch (e) {
    console.warn("Supabase non configurato correttamente, il logging resta disattivato:", e.message);
    client = createNoopClient();
  }
} else {
  console.warn("Variabili VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY mancanti: il logging resta disattivato.");
  client = createNoopClient();
}

export const supabase = client;
