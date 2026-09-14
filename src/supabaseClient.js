import { createClient } from "@supabase/supabase-js";

// Le chiavi vengono lette dalle variabili d'ambiente Vite (file .env, mai
// da committare su Git). La chiave "anon" è pensata per essere pubblica:
// è sicura da esporre nel codice del sito, l'accesso reale è controllato
// dalle policy di Row Level Security definite nel database.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Un client "finto" ma completamente "thenable" a ogni passaggio della catena,
// usato solo se manca la configurazione. Serve a evitare che l'intero sito
// smetta di funzionare quando le variabili d'ambiente non sono ancora state
// impostate: meglio restituire dati vuoti che bloccare tutto.
function createNoopClient() {
  const emptyResult = { data: [], error: null };
  const chain = {
    select: () => chain,
    order: () => chain,
    limit: () => chain,
    insert: () => chain,
    then: (resolve) => resolve(emptyResult),
  };
  return { from: () => chain };
}

let client;
if (supabaseUrl && supabaseAnonKey) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey);
  } catch (e) {
    console.warn("Supabase non configurato correttamente, il catalogo e il logging restano disattivati:", e.message);
    client = createNoopClient();
  }
} else {
  console.warn("Variabili VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY mancanti: catalogo e logging restano disattivati.");
  client = createNoopClient();
}

export const supabase = client;
