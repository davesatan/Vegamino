import React, { useState, useMemo, useEffect, useRef } from "react";
import { Search, Check, AlertTriangle, X, Sprout, BookOpen, FlaskConical, ChefHat, ShoppingBag } from "lucide-react";
import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------
   TOKENS
--------------------------------------------------------- */
const C = {
  bg: "#1E2A1C",
  surface: "#26331F",
  surface2: "#2E3D26",
  border: "rgba(242,238,221,0.12)",
  borderStrong: "rgba(242,238,221,0.22)",
  text: "#F2EEDD",
  muted: "#AAB79A",
  mustard: "#D4A017",
  mustardDark: "#8C6913",
  success: "#6E8F57",
  warn: "#B4482F",
  legumi: "#D48B6E",
  cereali: "#E0BB5E",
  semi: "#CBA894",
  altro: "#E8DCC0",
  farine: "#F0E8D8",
  varie: "#8FA89A",
};

const CATEGORY_COLOR = {
  "Legumi": C.legumi,
  "Cereali e pseudocereali": C.cereali,
  "Farine, pane e pasta": C.farine,
  "Frutta secca e semi": C.semi,
  "Preparati e fermentati": C.altro,
  "Altro": C.varie,
};

/* WHO/FAO/UNU 2007 reference pattern, mg amino acid per g di proteina, adulto */
/* Due pattern di riferimento amminoacidico in uso nella letteratura nutrizionale:
   - "adulto": FAO/OMS/UNU 2007, il fabbisogno reale di un adulto sano (meno esigente).
   - "bambino": il pattern per bambini in età prescolare (2-5 anni), storicamente usato
     per calcolare il PDCAAS ed è il riferimento più severo con cui la maggior parte
     delle fonti divulgative giudica se una proteina è "completa". */
const REFERENCE_SETS = {
  adult: {
    label: "Adulto (OMS/FAO 2007)",
    shortLabel: "Adulto",
    description: "Il fabbisogno reale di un adulto sano: la soglia meno esigente.",
    values: { his: 15, ile: 30, leu: 59, lys: 45, sit: 22, aaa: 38, thr: 23, trp: 6, val: 39 },
  },
  child: {
    label: "Bambino 2-5 anni (pattern classico PDCAAS)",
    shortLabel: "Bambino 2-5 anni",
    description: "Il pattern più severo, usato storicamente per il calcolo del PDCAAS: è il motivo per cui molte fonti definiscono \"incompleti\" alimenti che con il fabbisogno da adulto risultano invece adeguati.",
    values: { his: 19, ile: 28, leu: 66, lys: 58, sit: 25, aaa: 63, thr: 34, trp: 11, val: 35 },
  },
};
const referenceTotal = (ref) => Object.values(ref).reduce((a, b) => a + b, 0);

const AA_ORDER = ["his", "ile", "leu", "lys", "sit", "aaa", "thr", "trp", "val"];
const AA_LABEL = {
  his: "Istidina", ile: "Isoleucina", leu: "Leucina", lys: "Lisina",
  sit: "Metionina + Cisteina", aaa: "Fenilalanina + Tirosina",
  thr: "Treonina", trp: "Triptofano", val: "Valina",
};
const AA_SHORT = { his: "His", ile: "Ile", leu: "Leu", lys: "Lys", sit: "S-AA", aaa: "AAA", thr: "Thr", trp: "Trp", val: "Val" };
const AA_ROLE = {
  his: "produzione di globuli rossi e riparazione dei tessuti",
  ile: "metabolismo energetico e recupero muscolare",
  leu: "innesca la sintesi proteica nei muscoli",
  lys: "produzione di collagene e assorbimento del calcio",
  sit: "struttura di pelle e capelli, contiene zolfo",
  aaa: "precursori di neurotrasmettitori e ormoni tiroidei",
  thr: "struttura di collagene ed elastina",
  trp: "precursore della serotonina",
  val: "metabolismo energetico e recupero muscolare",
};

const MAX_SELECTION = 3;

/* ---------------------------------------------------------
   DATASET — valori indicativi per 100 g (educational estimates)
--------------------------------------------------------- */
/* Regola del catalogo: solo alimenti vegetali/vegani con almeno 5 g di
   proteine per 100 g. Sotto questa soglia un alimento non è rilevante ai
   fini della completezza amminoacidica e va tenuto fuori da questo elenco. */
// Il catalogo alimenti vive ora su Supabase (tabella "foods"), non più
// incorporato nel codice: si può modificare/aggiungere alimenti direttamente
// dalla dashboard Supabase (Table Editor) senza toccare il codice o rifare
// il deploy. Queste variabili partono vuote e vengono popolate da loadFoods()
// al primo caricamento della pagina.
let FOODS = [];
let FOOD_MAP = {};

async function loadFoods() {
  try {
    const { data, error } = await supabase.from("foods").select("*");
    if (error) throw error;
    if (!data || data.length === 0) return false;
    FOODS = data.map((row) => ({
      id: row.id,
      name: row.name,
      note: row.note || "",
      category: row.category,
      kcal: Number(row.kcal),
      protein_g: Number(row.protein_g),
      carbs_g: Number(row.carbs_g),
      fat_g: Number(row.fat_g),
      fiber_g: Number(row.fiber_g),
      excludeFromSuggestions: !!row.exclude_from_suggestions,
      aa: {
        his: Number(row.his), ile: Number(row.ile), leu: Number(row.leu),
        lys: Number(row.lys), sit: Number(row.sit), aaa: Number(row.aaa),
        thr: Number(row.thr), trp: Number(row.trp), val: Number(row.val),
      },
    }));
    FOOD_MAP = Object.fromEntries(FOODS.map((f) => [f.id, f]));
    return true;
  } catch (e) {
    console.error("Impossibile caricare il catalogo alimenti da Supabase:", e);
    return false;
  }
}

/* Controllo di integrità: individua alimenti con dati incompleti o
   palesemente sbagliati prima che arrivino a produrre un calcolo silenziosamente
   scorretto (è così che è stato scoperto in origine l'errore sui ceci).
   Gira una sola volta al caricamento del modulo, a costo zero per l'utente. */
(function validateFoodData() {
  FOODS.forEach((f) => {
    const missingAA = AA_ORDER.filter((k) => typeof f.aa[k] !== "number" || f.aa[k] < 0);
    if (missingAA.length > 0) {
      console.warn(`[Vegamino] "${f.name}" ha amminoacidi mancanti o negativi: ${missingAA.join(", ")}`);
    }
    if (!(f.protein_g >= 5)) {
      console.warn(`[Vegamino] "${f.name}" ha proteine sotto la soglia di 5 g/100 g (${f.protein_g}).`);
    }
    if (!CATEGORY_COLOR[f.category]) {
      console.warn(`[Vegamino] "${f.name}" ha una categoria "${f.category}" senza colore/icona associati.`);
    }
  });
})();

const CATEGORY_ORDER = ["Legumi", "Cereali e pseudocereali", "Farine, pane e pasta", "Frutta secca e semi", "Preparati e fermentati", "Altro"];


/* ---------------------------------------------------------
   LOGICA NUTRIZIONALE
--------------------------------------------------------- */
function computeScores(proteinG, aa, ref) {
  const scores = {};
  AA_ORDER.forEach((k) => {
    const mgPerGProtein = proteinG > 0 ? aa[k] / proteinG : 0;
    scores[k] = Math.round((mgPerGProtein / ref[k]) * 100);
  });
  return scores;
}

function limitingKeys(scores) {
  return AA_ORDER.filter((k) => scores[k] < 100).sort((a, b) => scores[a] - scores[b]);
}

/* Somma pesata di più alimenti, ciascuno alla propria quantità reale in grammi.
   ids e grams devono avere la stessa lunghezza. */
function computeComboAbsolute(ids, grams) {
  let protein_g = 0, kcal = 0, carbs_g = 0, fat_g = 0, fiber_g = 0;
  const aa = { his: 0, ile: 0, leu: 0, lys: 0, sit: 0, aaa: 0, thr: 0, trp: 0, val: 0 };
  ids.forEach((id, i) => {
    const f = FOOD_MAP[id];
    const share = grams[i] / 100;
    protein_g += f.protein_g * share;
    kcal += f.kcal * share;
    carbs_g += f.carbs_g * share;
    fat_g += f.fat_g * share;
    fiber_g += f.fiber_g * share;
    AA_ORDER.forEach((k) => { aa[k] += f.aa[k] * share; });
  });
  return { protein_g, kcal, carbs_g, fat_g, fiber_g, aa };
}

/* Calcola la quantità minima (e, se esiste, massima) di un alimento "candidato"
   da aggiungere a una base già presente in una certa quantità assoluta, in modo
   che TUTTI e nove gli amminoacidi essenziali della combinazione raggiungano
   almeno il 100% del fabbisogno di riferimento.
   base: oggetto con protein_g e aa assoluti (qualsiasi quantità di partenza).
   candidate: alimento del catalogo, con i suoi valori per 100 g.
   Ritorna { feasible, gramsMin, gramsMax } dove le quantità sono grammi di
   candidato. Se feasible è false, nessuna quantità del candidato, da sola,
   può completare il profilo (serve un alimento diverso per l'amminoacido
   che resta scoperto). */
function computeMinComplementGrams(base, candidate, ref) {
  let fMin = 0;
  let fMax = Infinity;
  let impossible = false;
  AA_ORDER.forEach((k) => {
    const A = base.aa[k] - ref[k] * base.protein_g;
    const B = ref[k] * candidate.protein_g - candidate.aa[k];
    if (Math.abs(B) < 1e-9) {
      if (A < -1e-9) impossible = true;
      return;
    }
    const bound = A / B;
    if (B < 0) {
      if (bound > fMin) fMin = bound;
    } else {
      if (bound < fMax) fMax = bound;
    }
  });
  if (fMax < fMin - 1e-9) impossible = true;
  if (fMax < 0) impossible = true;
  const gramsMinRaw = Math.max(0, fMin * 100);
  return {
    feasible: !impossible,
    gramsMin: gramsMinRaw,
    gramsMax: isFinite(fMax) ? Math.max(0, fMax * 100) : null,
    // Sotto questa soglia il risultato dipende da un margine di partenza così
    // sottile che diventa molto sensibile a piccole imprecisioni nei dati.
    thinMargin: gramsMinRaw > 0 && gramsMinRaw < 10,
  };
}

function roundGrams(g, max) {
  let rounded = Math.ceil(g / 10) * 10;
  if (rounded < 10) rounded = 10;
  if (max != null && rounded > max) rounded = Math.max(10, Math.round(g));
  return rounded;
}

/* Costruisce la combinazione "in cascata": il primo alimento selezionato è la
   base a 100 g; ogni alimento aggiunto dopo riceve la quantità minima calcolata
   per completare il profilo rispetto a tutto ciò che è già stato messo insieme. */
function buildComboChain(ids, ref) {
  if (ids.length === 0) return { grams: [], combo: null, infeasibleAt: [] };
  const grams = [100];
  const infeasibleAt = [false];
  let combo = computeComboAbsolute([ids[0]], [100]);
  for (let i = 1; i < ids.length; i++) {
    const candidate = FOOD_MAP[ids[i]];
    const { feasible, gramsMin, gramsMax } = computeMinComplementGrams(combo, candidate, ref);
    let g;
    if (feasible) {
      g = gramsMin <= 0.5 ? 50 : roundGrams(gramsMin, gramsMax);
      infeasibleAt.push(false);
    } else {
      g = 100;
      infeasibleAt.push(true);
    }
    grams.push(g);
    combo = computeComboAbsolute(ids.slice(0, i + 1), grams);
  }
  return { grams, combo, infeasibleAt };
}

const SUGGESTIONS_MAX = 25;
const SUGGESTIONS_PAGE = 5;

/* Suggerimenti di completamento: per ogni alimento non ancora scelto, calcola
   la quantità minima che servirebbe per completare da sola il profilo rispetto
   alla combinazione attuale. Se nessun alimento riesce a completarlo da solo,
   ripiega sul vecchio criterio (miglior punteggio sull'amminoacido più carente).
   Ritorna fino a SUGGESTIONS_MAX risultati: la UI ne mostra un numero limitato
   alla volta e permette di caricarne altri restando sulla stessa logica. */
function getSuggestions(current, excludeIds, ref, categoryFilter) {
  let candidates = FOODS.filter((f) => !excludeIds.includes(f.id) && !f.excludeFromSuggestions);
  if (categoryFilter) candidates = candidates.filter((f) => f.category === categoryFilter);
  const evaluated = candidates.map((f) => ({ food: f, ...computeMinComplementGrams(current, f, ref) }));
  const feasible = evaluated
    .filter((s) => s.feasible && s.gramsMin > 0.5)
    .sort((a, b) => a.gramsMin - b.gramsMin);
  if (feasible.length > 0) {
    return feasible.slice(0, SUGGESTIONS_MAX).map((s) => ({ ...s, mode: "complete", grams: roundGrams(s.gramsMin, s.gramsMax) }));
  }
  const scores = computeScores(current.protein_g, current.aa, ref);
  const limiting = limitingKeys(scores);
  if (limiting.length === 0) return [];
  const targetKey = limiting[0];
  return candidates
    .map((f) => ({ food: f, score: computeScores(f.protein_g, f.aa, ref)[targetKey], mode: "partial" }))
    .sort((a, b) => b.score - a.score)
    .slice(0, SUGGESTIONS_MAX);
}

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  arr.forEach((item, i) => {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    permutations(rest).forEach((p) => result.push([item, ...p]));
  });
  return result;
}

/* Quando gli alimenti selezionati sono fissi (l'utente li ha scelti apposta
   e non vuole sostituzioni), l'unico margine è cambiare le QUANTITÀ. Prova
   tutti gli ordini possibili di "chi è la base e chi si aggiunge dopo" (ogni
   ordine può produrre una combinazione di grammi diversa mantenendo sempre
   la regola del minimo necessario) e tiene solo quelli che risultano
   effettivamente completi su tutti e nove gli amminoacidi. Ritorna fino a 5
   alternative, ordinate per quantità totale crescente. */
function getAlternativeCombos(selectedIds, ref) {
  if (selectedIds.length < 2) return [];
  const seen = new Set();
  const options = [];
  permutations(selectedIds).forEach((perm) => {
    const chain = buildComboChain(perm, ref);
    if (!chain.combo) return;
    const scores = computeScores(chain.combo.protein_g, chain.combo.aa, ref);
    if (limitingKeys(scores).length > 0) return;
    const gramsByOriginalOrder = selectedIds.map((id) => chain.grams[perm.indexOf(id)]);
    const key = gramsByOriginalOrder.join(",");
    if (seen.has(key)) return;
    seen.add(key);
    options.push({ grams: gramsByOriginalOrder, total: gramsByOriginalOrder.reduce((a, b) => a + b, 0) });
  });
  options.sort((a, b) => a.total - b.total);
  return options.slice(0, 5);
}

/* Costruisce l'URL di ricerca esterna con gli ingredienti selezionati.
   Cambia RECIPE_SEARCH_BASE per puntare a un motore diverso (es. un sito di
   ricette specifico) senza toccare il resto della logica. */
const RECIPE_SEARCH_BASE = "https://www.google.com/search?q=";

function buildRecipeSearchUrl(foods) {
  const names = foods.map((f) => f.name.toLowerCase()).join(" ");
  const query = `ricetta vegana ${names}`;
  return `${RECIPE_SEARCH_BASE}${encodeURIComponent(query)}`;
}

/* Link di affiliazione Amazon Associates. Sostituisci AMAZON_ASSOCIATE_TAG
   con il tuo tag reale una volta iscritto al programma (affiliazione.amazon.it).
   Punta a una RICERCA su Amazon, non a un prodotto specifico: niente ASIN da
   mantenere aggiornati, e Amazon mostra sempre risultati disponibili. */
const AMAZON_ASSOCIATE_TAG = "vegamino21-21"; // <-- sostituisci con il tuo tag reale
const AMAZON_DOMAIN = "https://www.amazon.it";

function buildAmazonSearchUrl(foodName) {
  const query = `${foodName} biologico`;
  return `${AMAZON_DOMAIN}/s?k=${encodeURIComponent(query)}&tag=${AMAZON_ASSOCIATE_TAG}`;
}

/* ---------------------------------------------------------
   COMPONENTI VISIVI CONDIVISI
--------------------------------------------------------- */
function FoodIcon({ category, size = 22 }) {
  const color = CATEGORY_COLOR[category] || C.muted;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10.5" fill={color} opacity="0.22" />

      {/* Legumi: un fagiolo */}
      {category === "Legumi" && (
        <path
          d="M12 3.5c-4.5 0-8 4-8 9s3 9 7.5 9c3 0 6-2 7-5.5 1-3.5-1-6-3-6-1.5 0-2 1.5-3.5 1.5S10 9 10 7c0-2 1-3.5 2-3.5z"
          fill={color}
        />
      )}

      {/* Preparati e fermentati: un panetto (tofu/tempeh) */}
      {category === "Preparati e fermentati" && (
        <>
          <path d="M6 9l6-3 6 3-6 3-6-3z" fill={color} opacity="0.95" />
          <path d="M6 9v6.5l6 3v-6.5L6 9z" fill={color} opacity="0.72" />
          <path d="M18 9v6.5l-6 3v-6.5l6-3z" fill={color} opacity="0.5" />
        </>
      )}

      {/* Cereali e pseudocereali: una spiga di grano */}
      {category === "Cereali e pseudocereali" && (
        <g fill={color}>
          <line x1="12" y1="4.5" x2="12" y2="19.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
          <ellipse cx="9.7" cy="7" rx="1.1" ry="2" transform="rotate(-35 9.7 7)" />
          <ellipse cx="14.3" cy="7" rx="1.1" ry="2" transform="rotate(35 14.3 7)" />
          <ellipse cx="9.4" cy="10.6" rx="1.1" ry="2" transform="rotate(-32 9.4 10.6)" />
          <ellipse cx="14.6" cy="10.6" rx="1.1" ry="2" transform="rotate(32 14.6 10.6)" />
          <ellipse cx="9.7" cy="14.2" rx="1" ry="1.8" transform="rotate(-28 9.7 14.2)" />
          <ellipse cx="14.3" cy="14.2" rx="1" ry="1.8" transform="rotate(28 14.3 14.2)" />
        </g>
      )}

      {/* Farine, pane e pasta: una montagnetta di farina */}
      {category === "Farine, pane e pasta" && (
        <>
          <path
            d="M12 5.3c-0.8 2.6-1.8 3.6-3.4 5.2-1.8 1.8-2.8 3.7-2.8 6h12.4c0-2.3-1-4.2-2.8-6-1.6-1.6-2.6-2.6-3.4-5.2z"
            fill={color}
          />
          <circle cx="5.3" cy="18.3" r="0.7" fill={color} opacity="0.7" />
          <circle cx="18.7" cy="18.3" r="0.7" fill={color} opacity="0.7" />
          <circle cx="7.1" cy="19.4" r="0.5" fill={color} opacity="0.6" />
        </>
      )}

      {/* Frutta secca e semi: una mandorla */}
      {category === "Frutta secca e semi" && (
        <>
          <path d="M12 3.2c3 2.2 5 6 5 10 0 4-2.2 7-5 7s-5-3-5-7c0-4 2-7.8 5-10z" fill={color} />
          <path d="M12 5.5v12" stroke="rgba(0,0,0,0.18)" strokeWidth="0.7" />
        </>
      )}

      {/* Fallback: se una categoria futura non ha ancora una forma dedicata,
          mostra comunque un segnaposto invece di sparire silenziosamente. */}
      {!["Legumi", "Preparati e fermentati", "Cereali e pseudocereali", "Farine, pane e pasta", "Frutta secca e semi"].includes(category) && (
        <circle cx="12" cy="12" r="4" fill={color} />
      )}
    </svg>
  );
}

function AminoChart({ scores, limiting, aa, animate }) {
  const values = AA_ORDER.map((k) => scores[k]);
  const maxScore = Math.max(300, ...values) * 1.05;
  const chartH = 190;
  const chartW = 560;
  const labelW = 34; // spazio riservato alle etichette % sulla destra
  const plotW = chartW - labelW;
  const barGap = 10;
  const barW = (plotW - barGap * (AA_ORDER.length - 1)) / AA_ORDER.length;
  const thresholdY = chartH - (100 / maxScore) * chartH;

  return (
    <svg viewBox={`0 0 ${chartW} 232`} width="100%" style={{ maxWidth: chartW, display: "block" }}>
      {[0, 50, 100, 150, 200, 250, 300, 350, 400, 450].filter((v) => v <= maxScore).map((v) => {
        const y = chartH - (v / maxScore) * chartH;
        return (
          <g key={v}>
            <line x1={0} x2={plotW} y1={y} y2={y} stroke={C.border} strokeWidth="1" />
            <text x={plotW + 6} y={y + 3} textAnchor="start" fontSize="9" fill={C.muted} fontFamily="IBM Plex Sans, sans-serif">{v}%</text>
          </g>
        );
      })}
      <line x1={0} x2={plotW} y1={thresholdY} y2={thresholdY} stroke={C.mustard} strokeWidth="1.5" strokeDasharray="4 3" />

      {AA_ORDER.map((k, i) => {
        const score = scores[k];
        const h = Math.max(2, (Math.min(score, maxScore) / maxScore) * chartH);
        const x = i * (barW + barGap);
        const y = chartH - h;
        const isLimiting = limiting.includes(k);
        const fill = score >= 100 ? C.success : C.warn;
        const mg = aa ? Math.round(aa[k]) : null;
        return (
          <g key={k}>
            <title>{mg != null
              ? `${AA_LABEL[k]}: ${mg} mg presenti — ${score}% del fabbisogno di riferimento`
              : `${AA_LABEL[k]}: ${score}% del fabbisogno di riferimento`}</title>
            <rect
              x={x} y={y} width={barW} height={h} rx="3"
              fill={fill}
              stroke={isLimiting ? C.text : "none"}
              strokeWidth={isLimiting ? 1.2 : 0}
              style={animate ? { transition: "y 0.6s ease, height 0.6s ease" } : undefined}
            />
            <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize="9.5" fill={C.text} fontFamily="IBM Plex Sans, sans-serif">{score}</text>
            <text x={x + barW / 2} y={chartH + 16} textAnchor="middle" fontSize="10" fill={C.muted} fontFamily="IBM Plex Sans, sans-serif">{AA_SHORT[k]}</text>
          </g>
        );
      })}
    </svg>
  );
}

function MacroGrid({ data }) {
  const items = [
    { label: "Energia", value: `${Math.round(data.kcal)} kcal` },
    { label: "Proteine", value: `${data.protein_g.toFixed(1)} g` },
    { label: "Carboidrati", value: `${data.carbs_g.toFixed(1)} g` },
    { label: "Grassi", value: `${data.fat_g.toFixed(1)} g` },
    { label: "Fibre", value: `${data.fiber_g.toFixed(1)} g` },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 10 }}>
      {items.map((it) => (
        <div key={it.label} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: C.muted, fontFamily: "IBM Plex Sans, sans-serif" }}>{it.label}</div>
          <div style={{ fontSize: 16, color: C.text, fontFamily: "IBM Plex Sans, sans-serif", fontWeight: 600, marginTop: 2 }}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

function VerdictBadge({ complete, limiting }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      background: complete ? "rgba(110,143,87,0.16)" : "rgba(180,72,47,0.14)",
      border: `1px solid ${complete ? C.success : C.warn}`,
      color: complete ? C.success : C.warn,
      borderRadius: 999, padding: "6px 14px", fontFamily: "IBM Plex Sans, sans-serif", fontSize: 13.5, fontWeight: 600,
    }}>
      {complete ? <Check size={15} /> : <AlertTriangle size={15} />}
      {complete
        ? "Proteina completa"
        : `Manca: ${limiting.map((k) => AA_LABEL[k]).join(", ")}`}
    </div>
  );
}

/* ---------------------------------------------------------
   PAGINA GUIDA
--------------------------------------------------------- */
function GuidePage({ focusSignal }) {
  const [refKey, setRefKey] = useState("adult");
  const thresholdRef = useRef(null);
  const sectionStyle = { marginBottom: 34 };
  const h2Style = { fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 21, margin: "0 0 10px" };
  const pStyle = { color: C.muted, fontSize: 14.5, lineHeight: 1.7, margin: "0 0 12px", maxWidth: 620 };
  const ref = REFERENCE_SETS[refKey].values;
  const total = referenceTotal(ref);

  useEffect(() => {
    if (focusSignal) {
      thresholdRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focusSignal]);

  return (
    <div style={{ maxWidth: 680 }}>
      <h1 style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 27, margin: "0 0 8px" }}>
        Proteine e amminoacidi, in breve
      </h1>
      <p style={pStyle}>
        Una guida rapida ai concetti che questo strumento usa per dirti se un alimento vegetale
        ha una proteina completa e con cosa abbinarlo.
      </p>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Cosa sono le proteine</h2>
        <p style={pStyle}>
          Le proteine sono catene di amminoacidi legati tra loro. Il corpo le scompone durante la
          digestione e riutilizza i singoli amminoacidi per costruire muscoli, enzimi, ormoni,
          anticorpi e molte altre strutture. In totale gli amminoacidi che formano le proteine
          umane sono venti.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Essenziali e non essenziali</h2>
        <p style={pStyle}>
          Alcuni amminoacidi il corpo li sintetizza da solo a partire da altre molecole: si dicono
          <em> non essenziali</em>. Nove amminoacidi, invece, il corpo non riesce a produrre in
          quantità sufficiente e devono arrivare necessariamente dal cibo: sono gli
          <em> amminoacidi essenziali</em>, quelli su cui si concentra questo strumento.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: C.muted }}>Pattern di riferimento:</span>
          {Object.entries(REFERENCE_SETS).map(([key, set]) => (
            <button
              key={key}
              className="vgm-chip vgm-btn"
              onClick={() => setRefKey(key)}
              aria-pressed={refKey === key}
              style={{
                background: refKey === key ? C.mustard : "transparent",
                color: refKey === key ? C.bg : C.text,
                border: `1px solid ${refKey === key ? C.mustard : C.borderStrong}`,
                borderRadius: 999, padding: "5px 12px", fontSize: 12.5, cursor: "pointer",
              }}
            >
              {set.shortLabel}
            </button>
          ))}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 6 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 10px 6px 0", color: C.text, borderBottom: `1px solid ${C.borderStrong}`, fontWeight: 600 }}>Amminoacido essenziale</th>
                <th style={{ textAlign: "left", padding: "6px 10px", color: C.text, borderBottom: `1px solid ${C.borderStrong}`, fontWeight: 600 }}>Ruolo principale</th>
                <th style={{ textAlign: "right", padding: "6px 10px", color: C.text, borderBottom: `1px solid ${C.borderStrong}`, fontWeight: 600, whiteSpace: "nowrap" }}>Riferimento (mg/g proteina)</th>
                <th style={{ textAlign: "right", padding: "6px 0 6px 10px", color: C.text, borderBottom: `1px solid ${C.borderStrong}`, fontWeight: 600, whiteSpace: "nowrap" }}>Quota sul totale</th>
              </tr>
            </thead>
            <tbody>
              {AA_ORDER.map((k) => (
                <tr key={k}>
                  <td style={{ padding: "8px 10px 8px 0", color: C.text, borderBottom: `1px solid ${C.border}` }}>{AA_LABEL[k]}</td>
                  <td style={{ padding: "8px 10px", color: C.muted, borderBottom: `1px solid ${C.border}` }}>{AA_ROLE[k]}</td>
                  <td style={{ padding: "8px 10px", color: C.muted, borderBottom: `1px solid ${C.border}`, textAlign: "right" }}>{ref[k]}</td>
                  <td style={{ padding: "8px 0 8px 10px", color: C.muted, borderBottom: `1px solid ${C.border}`, textAlign: "right" }}>
                    {Math.round((ref[k] / total) * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ ...pStyle, fontSize: 12.5, marginTop: 10 }}>
          I valori di riferimento mostrati sono il pattern "{REFERENCE_SETS[refKey].label}"
          ({total} mg per grammo di proteina in totale): la quantità minima di ciascun amminoacido
          essenziale, per ogni grammo di proteina ingerita, considerata sufficiente a coprire il
          fabbisogno secondo quel pattern. La "quota sul totale" mostra quanto pesa ciascun
          amminoacido sul fabbisogno complessivo dei nove essenziali insieme.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Cosa rende una proteina "completa"</h2>
        <p style={pStyle}>
          Per ogni amminoacido essenziale, lo strumento calcola quanti milligrammi sono presenti
          per ogni grammo di proteina dell'alimento, poi confronta questo valore con il pattern di
          riferimento. Il risultato è una percentuale: 100% significa che l'amminoacido copre
          esattamente il fabbisogno di riferimento, un valore più alto indica abbondanza.
        </p>
        <p style={pStyle}>
          Una proteina si definisce <em>completa</em> quando tutti e nove gli amminoacidi
          essenziali raggiungono almeno il 100%. Se anche uno solo scende sotto quella soglia,
          si parla di <em>amminoacido limitante</em>: è lui a fissare il limite di quanto quella
          proteina può essere effettivamente utilizzata dal corpo, anche se l'alimento è
          complessivamente ricco di proteine.
        </p>
      </section>

      <section style={sectionStyle} ref={thresholdRef}>
        <h2 style={h2Style}>Quale soglia usare: adulto o bambino?</h2>
        <p style={pStyle}>
          Qui nasce la confusione più comune. Esistono più pattern di riferimento in uso nella
          letteratura nutrizionale, e non danno sempre lo stesso verdetto sullo stesso alimento:
        </p>
        <p style={pStyle}>
          <strong>Adulto (OMS/FAO 2007)</strong>: rispecchia il fabbisogno reale di un adulto sano
          ed è la soglia meno esigente. Con questo pattern alcuni alimenti considerati
          "incompleti" nel linguaggio comune, come i ceci, risultano invece adeguati su tutti e
          nove gli amminoacidi, anche se spesso con un margine sottile su quelli solforati
          (metionina e cisteina).
        </p>
        <p style={pStyle}>
          <strong>Bambino 2-5 anni</strong>: è il pattern più severo, storicamente usato per
          calcolare il PDCAAS (l'indice di qualità proteica più citato) ed è diventato lo standard
          con cui la maggior parte delle fonti divulgative giudica se una proteina è "completa",
          anche parlando di alimentazione adulta. Con questa soglia più alta, margini sottili come
          quello dei ceci sui solforati possono scendere sotto al 100%, facendo risultare
          l'alimento "incompleto".
        </p>
        <p style={pStyle}>
          Nessuno dei due è "sbagliato": sono soglie pensate per popolazioni diverse. Usa il
          selettore sopra la tabella per vedere come cambia il verdetto nello strumento a seconda
          del pattern scelto.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Perché i vegetali sono spesso incompleti</h2>
        <p style={pStyle}>
          I legumi tendono a essere abbondanti in lisina ma relativamente più poveri di
          amminoacidi solforati (metionina e cisteina). I cereali, al contrario, hanno più
          amminoacidi solforati ma poca lisina. Combinando le due famiglie, i punti deboli
          dell'uno vengono coperti dai punti di forza dell'altro: è il principio alla base di
          abbinamenti tradizionali come riso e lenticchie, o pane e hummus di ceci.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Serve combinarli nello stesso pasto?</h2>
        <p style={pStyle}>
          Non necessariamente. Il corpo mantiene una riserva di amminoacidi liberi nel sangue e
          nei tessuti, quindi le fonti proteiche complementari possono essere consumate in pasti
          diversi nell'arco della stessa giornata, non per forza nello stesso piatto. Combinarle
          insieme resta comunque un modo pratico, gustoso e tradizionale per assicurarsi un
          profilo completo: è l'approccio semplificato che questo strumento usa per suggerirti
          gli abbinamenti.
        </p>
      </section>

      <p style={{ ...pStyle, fontSize: 12.5 }}>
        Le informazioni qui sopra hanno scopo educativo generale e non sostituiscono il parere di
        un professionista della nutrizione.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------
   REGISTRO RICERCHE SENZA RISULTATI
   Tabella privata: chiunque può scrivere (per registrare i termini cercati
   e non trovati), ma solo chi ha accesso al progetto Supabase può leggerla
   dalla dashboard. Serve a capire quali alimenti aggiungere in futuro.
--------------------------------------------------------- */
async function logSearchMiss(term) {
  const clean = term.trim().toLowerCase();
  if (!clean) return;
  try {
    const { error } = await supabase.from("search_misses").insert({ term: clean });
    if (error) console.error("[vegamino] errore scrivendo search_misses:", error); // TEMPORANEO, da rimuovere dopo il debug
  } catch (e) {
    console.error("[vegamino] eccezione scrivendo search_misses:", e); // TEMPORANEO, da rimuovere dopo il debug
  }
}

/* ---------------------------------------------------------
   REGISTRO ALIMENTI SELEZIONATI
   Tabella pubblica in lettura SOLO in forma aggregata (tramite la vista
   food_selection_counts): il sito la usa per mostrare "i più cercati" in
   prima pagina. Le righe singole (chi ha cercato cosa e quando) restano
   private, solo il conteggio totale per alimento è visibile a tutti.
--------------------------------------------------------- */
async function logFoodSelection(foodId) {
  try {
    await supabase.from("food_selections").insert({ food_id: foodId });
  } catch (e) {
    // Come sopra: non deve mai bloccare l'interazione dell'utente.
  }
}

async function loadTopSelectedFoods(limit = 6) {
  try {
    const { data, error } = await supabase
      .from("food_selection_counts")
      .select("food_id, selections")
      .order("selections", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (e) {
    return [];
  }
}

/* ---------------------------------------------------------
   APP
--------------------------------------------------------- */
export default function App() {
  const [page, setPage] = useState("tool");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [customGrams, setCustomGrams] = useState(null); // override, stessa lunghezza/ordine di selectedIds
  const [visibleSuggestions, setVisibleSuggestions] = useState(SUGGESTIONS_PAGE);
  const [suggestionCategory, setSuggestionCategory] = useState(null); // null = tutte le categorie
  const [guideFocusSignal, setGuideFocusSignal] = useState(0);
  const [targetProteinInput, setTargetProteinInput] = useState("");
  const [topSelected, setTopSelected] = useState([]);
  const [foodsStatus, setFoodsStatus] = useState("loading"); // "loading" | "ready" | "error"
  const REFERENCE = REFERENCE_SETS.adult.values;

  useEffect(() => {
    let cancelled = false;
    loadFoods().then((ok) => {
      if (cancelled) return;
      setFoodsStatus(ok ? "ready" : "error");
    });
    return () => { cancelled = true; };
  }, []);

  // Carica la classifica dei più selezionati una sola volta, all'avvio.
  // Se Supabase non è ancora configurato (o la vista non ha ancora righe),
  // loadTopSelectedFoods restituisce un array vuoto e la sezione resta nascosta.
  useEffect(() => {
    let cancelled = false;
    loadTopSelectedFoods(3).then((rows) => {
      if (cancelled) return;
      // Alcuni food_id registrati in passato potrebbero non esistere più nel
      // catalogo attuale (es. un alimento rimosso): li scartiamo qui.
      const resolved = rows
        .map((r) => ({ food: FOOD_MAP[r.food_id], selections: r.selections }))
        .filter((r) => r.food);
      setTopSelected(resolved);
    });
    return () => { cancelled = true; };
  }, []);

  function openThresholdGuide() {
    setPage("guide");
    setGuideFocusSignal((n) => n + 1);
  }

  const chain = useMemo(() => buildComboChain(selectedIds, REFERENCE), [selectedIds]);
  const grams = customGrams && customGrams.length === selectedIds.length ? customGrams : chain.grams;
  const current = selectedIds.length > 0 ? computeComboAbsolute(selectedIds, grams) : null;
  const scores = current ? computeScores(current.protein_g, current.aa, REFERENCE) : null;
  const limiting = scores ? limitingKeys(scores) : [];
  const complete = scores ? limiting.length === 0 : false;

  // Scala le quantità mantenendo le proporzioni, così il profilo amminoacidico
  // (che è un rapporto, non una quantità assoluta) resta invariato: solo le
  // grammature visualizzate cambiano per centrare la proteina target.
  const proteinTarget = parseFloat(targetProteinInput.replace(",", "."));
  const hasValidTarget = complete && current && current.protein_g > 0 && !isNaN(proteinTarget) && proteinTarget > 0;
  const scaleFactor = hasValidTarget ? proteinTarget / current.protein_g : 1;
  const displayGrams = scaleFactor !== 1 ? grams.map((g) => Math.round(g * scaleFactor)) : grams;
  const displayCombo = scaleFactor !== 1 ? computeComboAbsolute(selectedIds, displayGrams) : current;

  const canAddMore = selectedIds.length < MAX_SELECTION;
  const suggestions = useMemo(
    () => (current && !complete && canAddMore ? getSuggestions(current, selectedIds, REFERENCE, suggestionCategory) : []),
    [current, complete, canAddMore, selectedIds, suggestionCategory]
  );
  const alternativeCombos = useMemo(
    () => (!complete && !canAddMore ? getAlternativeCombos(selectedIds, REFERENCE) : []),
    [complete, canAddMore, selectedIds]
  );

  const MAX_PER_CATEGORY = 5;
  const isSearching = query.trim().length > 0;
  const filteredFoods = FOODS.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));
  const grouped = CATEGORY_ORDER.map((cat) => {
    const all = filteredFoods.filter((f) => f.category === cat);
    let items;
    if (isSearching) {
      items = all;
    } else {
      // Mostra alimenti diversi tra loro, non più varianti dello stesso alimento
      // (es. non 5 tipi di fagioli quando ce ne sono altri non ancora rappresentati).
      const seenBase = new Set();
      items = [];
      for (const f of all) {
        const base = f.name.replace(/\s*\([^)]*\)\s*$/, "").trim();
        if (seenBase.has(base)) continue;
        seenBase.add(base);
        items.push(f);
        if (items.length >= MAX_PER_CATEGORY) break;
      }
    }
    return { category: cat, items, hiddenCount: all.length - items.length };
  }).filter((g) => g.items.length > 0);

  useEffect(() => {
    if (grouped.length !== 0 || query.trim().length < 2) return;
    const t = setTimeout(() => { logSearchMiss(query); }, 800);
    return () => clearTimeout(t);
  }, [query, grouped.length]);

  function toggleSelection(id) {
    setCustomGrams(null);
    setVisibleSuggestions(SUGGESTIONS_PAGE);
    setSuggestionCategory(null);
    setTargetProteinInput("");
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SELECTION) return prev;
      logFoodSelection(id); // registrato solo quando si aggiunge, non quando si toglie
      return [...prev, id];
    });
  }

  // Permette di sovrascrivere a mano i grammi di un singolo alimento già
  // selezionato (es. "oggi ho usato 140 g di lenticchie"), invece di usare
  // solo la quantità minima calcolata automaticamente. L'editing manuale
  // ha la precedenza sulla scala per proteina target, che viene azzerata.
  function updateGramsAt(index, rawValue) {
    const value = Math.max(0, Math.round(Number(rawValue) || 0));
    setTargetProteinInput("");
    setCustomGrams((prev) => {
      const base = prev && prev.length === selectedIds.length ? [...prev] : [...grams];
      base[index] = value;
      return base;
    });
  }

  const selectedFoods = selectedIds.map((id) => FOOD_MAP[id]);

  // Il catalogo arriva da Supabase in modo asincrono: finché non è pronto (o
  // se il caricamento fallisce) mostriamo uno stato dedicato invece del resto
  // dell'interfaccia, per evitare comportamenti strani su un catalogo vuoto.
  if (foodsStatus !== "ready") {
    return (
      <div style={{ background: C.bg, minHeight: "100%", color: C.text, fontFamily: "IBM Plex Sans, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;1,500&family=IBM+Plex+Sans:wght@400;500;600&display=swap');`}</style>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          {foodsStatus === "loading" ? (
            <>
              <Sprout size={28} color={C.mustard} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 14.5, color: C.muted }}>Caricamento del catalogo alimenti...</div>
            </>
          ) : (
            <>
              <AlertTriangle size={28} color={C.warn} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 14.5, color: C.text, marginBottom: 12 }}>
                Non riesco a caricare il catalogo alimenti in questo momento.
              </div>
              <button
                className="vgm-btn"
                onClick={() => { setFoodsStatus("loading"); loadFoods().then((ok) => setFoodsStatus(ok ? "ready" : "error")); }}
                style={{ background: C.mustard, color: C.bg, border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
              >
                Riprova
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: "100%", color: C.text, fontFamily: "IBM Plex Sans, sans-serif" }} className="vgm-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;1,500&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .vgm-scroll::-webkit-scrollbar { width: 6px; }
        .vgm-scroll::-webkit-scrollbar-thumb { background: rgba(242,238,221,0.18); border-radius: 4px; }
        .vgm-btn:focus-visible, .vgm-chip:focus-visible, .vgm-input:focus-visible, .vgm-tab:focus-visible {
          outline: 2px solid ${C.mustard}; outline-offset: 2px;
        }
        .vgm-food-btn { transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease; }
        .vgm-chip { transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease; }
        .vgm-tab { transition: color 0.15s ease, border-color 0.15s ease; }

        /* Layout in CSS puro, senza dipendere da Tailwind: il file gira così
           com'è in qualsiasi progetto React (Vite, Next.js, ecc.). */
        .vgm-page { padding: 16px; }
        .vgm-layout { display: flex; flex-direction: column; gap: 24px; }
        .vgm-sidebar { flex-shrink: 0; }
        .vgm-main { flex: 1 1 0%; min-width: 0; }
        @media (min-width: 768px) {
          .vgm-page { padding: 32px; }
          .vgm-layout { flex-direction: row; }
          .vgm-sidebar { width: 288px; }
        }
      `}</style>

      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {/* HERO */}
        <header style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Sprout size={22} color={C.mustard} />
            <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 30, margin: 0, letterSpacing: 0.2 }}>
              <span style={{ fontStyle: "italic", fontWeight: 600 }}>Vegamino</span>
              <span style={{ fontWeight: 400, color: C.muted }}> - Completa le tue proteine</span>
            </h1>
          </div>
          <p style={{ color: C.muted, marginTop: 8, maxWidth: 620, lineHeight: 1.5, fontSize: 14.5 }}>
            Seleziona fino a tre alimenti vegetali per vederne il profilo amminoacidico combinato,
            trovare l'alimento complementare consigliato e trovare una ricetta pensata per quella combinazione.
          </p>
        </header>

        {/* NAV */}
        <nav style={{ display: "flex", gap: 22, borderBottom: `1px solid ${C.border}`, marginBottom: 26 }}>
          <button
            className="vgm-btn vgm-tab"
            onClick={() => setPage("tool")}
            style={{
              display: "flex", alignItems: "center", gap: 7, background: "none", border: "none",
              borderBottom: `2px solid ${page === "tool" ? C.mustard : "transparent"}`,
              color: page === "tool" ? C.text : C.muted, padding: "0 0 10px", fontSize: 14, cursor: "pointer",
            }}
          >
            <FlaskConical size={15} /> Strumento
          </button>
          <button
            className="vgm-btn vgm-tab"
            onClick={() => setPage("guide")}
            style={{
              display: "flex", alignItems: "center", gap: 7, background: "none", border: "none",
              borderBottom: `2px solid ${page === "guide" ? C.mustard : "transparent"}`,
              color: page === "guide" ? C.text : C.muted, padding: "0 0 10px", fontSize: 14, cursor: "pointer",
            }}
          >
            <BookOpen size={15} /> Guida agli amminoacidi
          </button>
        </nav>

        {page === "guide" && <GuidePage focusSignal={guideFocusSignal} />}

        {page === "tool" && (
          <div className="vgm-layout">
            {/* SIDEBAR */}
            <aside className="vgm-sidebar">
              <div style={{ position: "relative", marginBottom: 10 }}>
                <Search size={15} color={C.muted} style={{ position: "absolute", left: 10, top: 10 }} />
                <input
                  className="vgm-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cerca un alimento..."
                  style={{
                    width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
                    padding: "8px 10px 8px 32px", color: C.text, fontSize: 13.5, fontFamily: "IBM Plex Sans, sans-serif",
                  }}
                />
              </div>

              {!isSearching && selectedIds.length === 0 && topSelected.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6, color: C.mustard, letterSpacing: 0.2 }}>
                    Più cercati dagli utenti
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {topSelected.map(({ food }) => (
                      <button
                        key={food.id}
                        className="vgm-btn vgm-food-btn"
                        onClick={() => toggleSelection(food.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 9, textAlign: "left",
                          background: "transparent", border: `1px solid ${C.borderStrong}`,
                          borderRadius: 8, padding: "6px 8px", cursor: "pointer", width: "100%",
                        }}
                      >
                        <FoodIcon category={food.category} size={17} />
                        <span style={{ fontSize: 13.5, color: C.text, flex: 1, minWidth: 0 }}>{food.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>
                {selectedIds.length}/{MAX_SELECTION} selezionati
                {selectedIds.length >= MAX_SELECTION && " · massimo raggiunto"}
              </div>

              <div className="vgm-scroll" style={{ maxHeight: 520, overflowY: "auto", paddingRight: 4 }}>
                {grouped.map((g) => (
                  <div key={g.category} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6, letterSpacing: 0.2 }}>
                      <span style={{ color: CATEGORY_COLOR[g.category] }}>{g.category}</span>
                      {g.hiddenCount > 0 && (
                        <span style={{ color: C.muted, fontWeight: 400 }}> - usa la ricerca per altri alimenti.</span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {g.items.map((f) => {
                        const active = selectedIds.includes(f.id);
                        const disabled = !active && selectedIds.length >= MAX_SELECTION;
                        return (
                          <button
                            key={f.id}
                            className="vgm-btn vgm-food-btn"
                            onClick={() => toggleSelection(f.id)}
                            title={disabled ? "Massimo 3 alimenti selezionabili" : undefined}
                            role="checkbox"
                            aria-checked={active}
                            disabled={disabled}
                            style={{
                              display: "flex", alignItems: "center", gap: 9, textAlign: "left",
                              background: active ? C.surface2 : "transparent",
                              border: `1px solid ${active ? C.mustard : "transparent"}`,
                              borderRadius: 8, padding: "6px 8px", cursor: disabled ? "default" : "pointer",
                              opacity: disabled ? 0.4 : 1,
                            }}
                          >
                            <span style={{
                              width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                              border: `1.4px solid ${active ? C.mustard : C.borderStrong}`,
                              background: active ? C.mustard : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {active && <Check size={11} color={C.bg} />}
                            </span>
                            <FoodIcon category={f.category} size={17} />
                            <span style={{ fontSize: 13.5, color: active ? C.text : C.muted }}>{f.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {grouped.length === 0 && (
                  <div style={{
                    color: C.muted, fontSize: 12.5, lineHeight: 1.6,
                    border: `1px dashed ${C.border}`, borderRadius: 10, padding: 12,
                  }}>
                    "{query}" non è nel nostro catalogo di {FOODS.length} alimenti vegetali proteici.
                    Puoi comunque cercarne i valori amminoacidici su{" "}
                    <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noreferrer" style={{ color: C.mustard }}>
                      USDA FoodData Central
                    </a>, la banca dati nutrizionale pubblica e gratuita del governo statunitense
                    (cerca l'alimento tra i risultati "Foundation" o "SR Legacy" per i profili amminoacidici completi).
                    <div style={{ marginTop: 8, fontSize: 11.5 }}>
                      Questo termine viene registrato: se valutato idoneo, verrà aggiunto al catalogo in futuro.
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* MAIN */}
            <main className="vgm-main">
              {!current && (
                <div style={{
                  border: `1px dashed ${C.border}`, borderRadius: 14, padding: "48px 24px",
                  textAlign: "center", color: C.muted,
                }}>
                  <Sprout size={26} color={C.muted} style={{ marginBottom: 10 }} />
                  <div style={{ fontSize: 14.5 }}>Seleziona fino a 3 alimenti dall'elenco per iniziare.</div>
                </div>
              )}

              {current && (
                <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                  {/* RIFERIMENTO AMMINOACIDICO */}
                  <button
                    className="vgm-btn"
                    onClick={openThresholdGuide}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start",
                      background: "none", border: "none", color: C.muted, fontSize: 12.5, cursor: "pointer", padding: 0,
                    }}
                  >
                    <BookOpen size={13} />
                    I punteggi qui sotto usano la soglia adulta — scopri le soglie di riferimento
                  </button>

                  {/* ALIMENTI SELEZIONATI */}
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    {selectedFoods.map((f, i) => (
                      <span key={f.id} style={{
                        display: "flex", alignItems: "center", gap: 6,
                        background: C.surface2, border: `1px solid ${C.borderStrong}`,
                        borderRadius: 999, padding: "5px 6px 5px 12px", fontSize: 13,
                      }}>
                        {f.name}
                        <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={displayGrams[i]}
                            onChange={(e) => updateGramsAt(i, e.target.value)}
                            aria-label={`Grammi di ${f.name} (modificabile)`}
                            title="Modifica per indicare la quantità che hai usato davvero"
                            style={{
                              width: 44, background: "transparent", border: "none",
                              borderBottom: `1px dashed ${C.mustard}`, color: C.mustard,
                              fontSize: 12, fontWeight: 600, textAlign: "right", padding: "0 2px",
                            }}
                          />
                          <span style={{ color: C.mustard, fontSize: 12, fontWeight: 600 }}>g</span>
                        </span>
                        <a
                          href={buildAmazonSearchUrl(f.name)}
                          target="_blank"
                          rel="noreferrer sponsored"
                          aria-label={`Acquista ${f.name} su Amazon`}
                          title={`Acquista ${f.name} su Amazon`}
                          style={{ color: C.muted, display: "flex", padding: 3, textDecoration: "none" }}
                        >
                          <ShoppingBag size={13} />
                        </a>
                        <button
                          className="vgm-btn"
                          onClick={() => toggleSelection(f.id)}
                          aria-label={`Rimuovi ${f.name}`}
                          style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", display: "flex", padding: 3 }}
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                    {selectedIds.length > 0 && (
                      <button
                        className="vgm-btn"
                        onClick={() => { setSelectedIds([]); setCustomGrams(null); setVisibleSuggestions(SUGGESTIONS_PAGE); setSuggestionCategory(null); setTargetProteinInput(""); }}
                        style={{ color: C.muted, background: "transparent", border: "none", fontSize: 12.5, cursor: "pointer" }}
                      >
                        azzera tutto
                      </button>
                    )}
                  </div>
                  {selectedIds.length > 0 && (
                    <p style={{ color: C.muted, fontSize: 12, margin: "-4px 0 0" }}>
                      Modifica i grammi per indicare quanto hai usato davvero. Il peso si intende nello stato indicato tra parentesi (es. crudo, cotto, in scatola).
                    </p>
                  )}

                  {/* SCHEDA / PROFILO */}
                  <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                      <h2 style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 22, margin: 0 }}>
                        {selectedIds.length === 1
                          ? selectedFoods[0].name
                          : "Profilo del piatto combinato"}
                      </h2>
                      <span style={{ color: C.muted, fontSize: 13 }}>
                        {selectedIds.length === 1
                          ? `${selectedFoods[0].note} · ${displayGrams[0]} g`
                          : selectedFoods.map((f, i) => `${displayGrams[i]} g ${f.name.toLowerCase()}`).join(" + ")}
                      </span>
                    </div>

                    {selectedIds.length > 1 && (
                      <p style={{ color: C.muted, fontSize: 12.5, margin: "0 0 14px", maxWidth: 560 }}>
                        Quantità calcolate per raggiungere almeno il 100% del fabbisogno su ogni
                        amminoacido essenziale usando la minor quantità possibile di ogni alimento
                        aggiunto.
                      </p>
                    )}

                    <div style={{ marginTop: 14, marginBottom: 18 }}>
                      <MacroGrid data={displayCombo} />
                    </div>

                    <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 8, fontWeight: 600 }}>
                      Amminoacidi essenziali — % del fabbisogno di riferimento per grammo di proteina
                    </div>
                    <AminoChart scores={scores} limiting={limiting} aa={displayCombo.aa} animate={selectedIds.length > 1} />

                    <div style={{ marginTop: 14, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
                      <VerdictBadge complete={complete} limiting={limiting} />
                      {complete && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <label htmlFor="target-protein" style={{ fontSize: 12, color: C.muted }}>
                            Immetti quante proteine vuoi assumere con questo pasto:
                          </label>
                          <input
                            id="target-protein"
                            className="vgm-input"
                            type="number"
                            min="1"
                            inputMode="decimal"
                            value={targetProteinInput}
                            onChange={(e) => setTargetProteinInput(e.target.value)}
                            placeholder={`${Math.round(current.protein_g)}`}
                            style={{
                              width: 64, background: C.surface2, border: `1px solid ${C.borderStrong}`, borderRadius: 6,
                              padding: "4px 6px", color: C.text, fontSize: 13, fontFamily: "IBM Plex Sans, sans-serif",
                            }}
                          />
                          <span style={{ fontSize: 12, color: C.muted }}>g</span>
                          {targetProteinInput && (
                            <button
                              className="vgm-btn"
                              onClick={() => setTargetProteinInput("")}
                              style={{ background: "none", border: "none", color: C.mustard, fontSize: 12, cursor: "pointer" }}
                            >
                              reimposta
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </section>

                  {/* COMPLETAMENTO */}
                  {!complete && canAddMore && (
                    <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                      <h3 style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 17, margin: "0 0 4px" }}>
                        Completa il profilo con
                      </h3>
                      <p style={{ color: C.muted, fontSize: 13, margin: "0 0 14px" }}>
                        {suggestions.length > 0 && suggestions[0].mode === "complete"
                          ? <>Quanto aggiungere, oltre ai {grams.reduce((a, b) => a + b, 0)} g già scelti di {selectedFoods.map((f) => f.name.toLowerCase()).join(" + ")}, per arrivare al 100% su tutti gli amminoacidi.</>
                          : <>Nessun alimento da solo basta a coprire {AA_LABEL[limiting[0]]}: questi aiutano di più.</>}
                      </p>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                        <FlaskConical size={13} color={C.muted} />
                        <span style={{ color: C.muted, fontSize: 12.5, fontWeight: 600 }}>
                          Filtra per tipo di alimento complementare:
                        </span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                        <button
                          className="vgm-chip vgm-btn"
                          onClick={() => { setSuggestionCategory(null); setVisibleSuggestions(SUGGESTIONS_PAGE); }}
                          aria-pressed={suggestionCategory === null}
                          style={{
                            background: suggestionCategory === null ? C.mustard : "transparent",
                            color: suggestionCategory === null ? C.bg : C.muted,
                            border: `1px solid ${suggestionCategory === null ? C.mustard : C.borderStrong}`,
                            borderRadius: 999, padding: "4px 11px", fontSize: 12, cursor: "pointer",
                          }}
                        >
                          Tutte le categorie
                        </button>
                        {CATEGORY_ORDER.map((cat) => (
                          <button
                            key={cat}
                            className="vgm-chip vgm-btn"
                            onClick={() => { setSuggestionCategory(cat); setVisibleSuggestions(SUGGESTIONS_PAGE); }}
                            aria-pressed={suggestionCategory === cat}
                            style={{
                              background: suggestionCategory === cat ? C.mustard : "transparent",
                              color: suggestionCategory === cat ? C.bg : C.muted,
                              border: `1px solid ${suggestionCategory === cat ? C.mustard : C.borderStrong}`,
                              borderRadius: 999, padding: "4px 11px", fontSize: 12, cursor: "pointer",
                            }}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      {suggestions.length === 0 && suggestionCategory && (
                        <div style={{ color: C.muted, fontSize: 13, marginBottom: 14 }}>
                          Nessun alimento in "{suggestionCategory}" aiuta a completare il profilo. Prova un'altra categoria.
                        </div>
                      )}

                      {suggestions.length > 0 && suggestions[0].mode === "complete" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {suggestions.slice(0, visibleSuggestions).map((s) => {
                            const totalGrams = grams.reduce((a, b) => a + b, 0);
                            const pct = Math.round((s.grams / totalGrams) * 100);
                            return (
                              <div key={s.food.id}>
                                <button
                                  className="vgm-btn vgm-food-btn"
                                  onClick={() => toggleSelection(s.food.id)}
                                  style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
                                    width: "100%", textAlign: "left", cursor: "pointer",
                                    background: C.surface2, border: `1.5px solid ${C.success}`, borderRadius: 12, padding: "14px 16px",
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                    <FoodIcon category={s.food.category} size={22} />
                                    <span style={{ fontSize: 15, color: C.text, fontWeight: 500 }}>{s.food.name}</span>
                                  </div>
                                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: C.success, lineHeight: 1.1, fontFamily: "IBM Plex Sans, sans-serif" }}>
                                      +{s.grams} g
                                    </div>
                                    <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                                      +{pct}% rispetto ai {totalGrams} g attuali
                                    </div>
                                  </div>
                                </button>
                                {s.thinMargin && (
                                  <div style={{ fontSize: 11.5, color: C.mustard, marginTop: 4, paddingLeft: 4 }}>
                                    Margine di calcolo amminoacidi mancanti molto sottile, si mostrano i risultati basati sull'aggiunta di 10gr di prodotto complementare.
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {suggestions.slice(0, visibleSuggestions).map((s) => (
                            <button
                              key={s.food.id}
                              className="vgm-chip vgm-btn"
                              onClick={() => toggleSelection(s.food.id)}
                              title="Da solo non basta a completare il profilo, ma aiuta sull'amminoacido più carente"
                              style={{
                                display: "flex", alignItems: "center", gap: 6,
                                background: "transparent", color: C.text,
                                border: `1px solid ${C.borderStrong}`,
                                borderRadius: 999, padding: "6px 12px", fontSize: 13, cursor: "pointer",
                              }}
                            >
                              {s.food.name}
                              <span style={{ opacity: 0.75, fontSize: 11.5 }}>· {s.score}%</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {suggestions.length > visibleSuggestions && visibleSuggestions < SUGGESTIONS_MAX && (
                        <button
                          className="vgm-btn"
                          onClick={() => setVisibleSuggestions((n) => Math.min(SUGGESTIONS_MAX, n + SUGGESTIONS_PAGE))}
                          style={{
                            marginTop: 12, background: "none", border: `1px solid ${C.borderStrong}`, color: C.text,
                            borderRadius: 8, padding: "7px 14px", fontSize: 12.5, cursor: "pointer",
                          }}
                        >
                          Mostra altri {Math.min(SUGGESTIONS_PAGE, suggestions.length - visibleSuggestions)} risultati
                        </button>
                      )}
                    </section>
                  )}

                  {!complete && !canAddMore && (
                    <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                      <h3 style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 17, margin: "0 0 4px" }}>
                        Alternative di quantità per completare il profilo
                      </h3>
                      <p style={{ color: C.muted, fontSize: 13, margin: "0 0 14px" }}>
                        Restando sugli stessi {MAX_SELECTION} alimenti, ecco altre combinazioni di quantità che
                        raggiungono il 100% su tutti gli amminoacidi.
                      </p>

                      {alternativeCombos.length === 0 && (
                        <div style={{ color: C.muted, fontSize: 13.5, border: `1px dashed ${C.border}`, borderRadius: 12, padding: 18 }}>
                          Nessuna combinazione di quantità tra questi {MAX_SELECTION} alimenti risulta completa su
                          tutti gli amminoacidi, in nessuna proporzione provata. Serve un alimento diverso al posto
                          di uno dei tre per coprire {AA_LABEL[limiting[0]]}.
                        </div>
                      )}

                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {alternativeCombos.map((opt, i) => (
                          <button
                            key={i}
                            className="vgm-btn vgm-food-btn"
                            onClick={() => setCustomGrams(opt.grams)}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
                              width: "100%", textAlign: "left", cursor: "pointer", flexWrap: "wrap",
                              background: C.surface2, border: `1.5px solid ${C.success}`, borderRadius: 12, padding: "14px 16px",
                            }}
                          >
                            <span style={{ fontSize: 14, color: C.text }}>
                              {selectedFoods.map((f, idx) => (
                                <span key={f.id}>
                                  {idx > 0 && " + "}
                                  <strong>{opt.grams[idx]} g</strong> {f.name.toLowerCase()}
                                </span>
                              ))}
                            </span>
                            <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{opt.total} g totali</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* RICETTE */}
                  <section>
                    <a
                      href={buildRecipeSearchUrl(selectedFoods)}
                      target="_blank"
                      rel="noreferrer"
                      className="vgm-btn"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        background: C.mustard, color: C.bg, textDecoration: "none",
                        borderRadius: 10, padding: "11px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      <ChefHat size={16} />
                      Cerca ricette con questi ingredienti
                    </a>
                    <p style={{ color: C.muted, fontSize: 12, margin: "8px 0 0" }}>
                      Apre una ricerca nel browser per "{selectedFoods.map((f) => f.name.toLowerCase()).join(", ")}" —
                      Vegamino non ospita ricette proprie, solo il calcolo del profilo amminoacidico.
                    </p>
                  </section>
                </div>
              )}
            </main>
          </div>
        )}

        <footer style={{ marginTop: 40, paddingTop: 16, borderTop: `1px solid ${C.border}`, color: C.muted, fontSize: 11.5, lineHeight: 1.6 }}>
          I valori nutrizionali e amminoacidici sono stime indicative a scopo educativo, non dati di laboratorio.
          Per scelte alimentari specifiche fai riferimento a una banca dati certificata (es. USDA FoodData Central)
          o a un professionista della nutrizione.
          <div style={{ marginTop: 8 }}>
            In qualità di Affiliato Amazon, Vegamino riceve un guadagno dagli acquisti idonei effettuati
            tramite i link a Amazon presenti in questa pagina.
          </div>
        </footer>
      </div>
    </div>
  );
}
