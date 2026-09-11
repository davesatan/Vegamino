import React, { useState, useMemo, useEffect, useRef } from "react";
import { Search, Check, AlertTriangle, X, Sprout, BookOpen, FlaskConical, ChefHat, ShoppingBag } from "lucide-react";

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
const FOODS = [
  { id: "lenticchie", name: "Lenticchie (secche)", note: "secche, crude", category: "Legumi",
    kcal: 352, protein_g: 25, carbs_g: 63, fat_g: 1.1, fiber_g: 11,
    aa: { his: 720, ile: 1050, leu: 1850, lys: 1730, sit: 480, aaa: 2070, thr: 880, trp: 210, val: 1210 } },
  { id: "lenticchie_secco_cotto_bollito", name: "Lenticchie (cotte)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 114, protein_g: 9, carbs_g: 19.5, fat_g: 0.4, fiber_g: 7.9,
    aa: { his: 254, ile: 390, leu: 654, lys: 630, sit: 195, aaa: 686, thr: 323, trp: 81, val: 448 } },
  { id: "lenticchie_crudo", name: "Lenticchie (crude)", note: "crudo", category: "Legumi",
    kcal: 352, protein_g: 24.6, carbs_g: 63.4, fat_g: 1.1, fiber_g: 10.7,
    aa: { his: 693, ile: 1065, leu: 1786, lys: 1720, sit: 532, aaa: 1873, thr: 882, trp: 221, val: 1223 } },
  { id: "ceci", name: "Ceci (secchi)", note: "secchi, crudi", category: "Legumi",
    kcal: 364, protein_g: 19, carbs_g: 61, fat_g: 6, fiber_g: 17,
    aa: { his: 500, ile: 830, leu: 1470, lys: 1350, sit: 415, aaa: 1690, thr: 705, trp: 210, val: 870 } },
  { id: "ceci_secco_in_scatola_sgocciolato", name: "Ceci (in scatola)", note: "secco, in scatola, sgocciolato", category: "Legumi",
    kcal: 139, protein_g: 7.1, carbs_g: 22.5, fat_g: 2.8, fiber_g: 6.4,
    aa: { his: 195, ile: 304, leu: 505, lys: 475, sit: 189, aaa: 556, thr: 264, trp: 69, val: 298 } },
  { id: "ceci_secco_cotto_bollito", name: "Ceci (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 164, protein_g: 8.9, carbs_g: 27.4, fat_g: 2.6, fiber_g: 7.6,
    aa: { his: 244, ile: 380, leu: 631, lys: 593, sit: 235, aaa: 695, thr: 329, trp: 85, val: 372 } },
  { id: "fagioli_neri", name: "Fagioli neri (secchi)", note: "secchi, crudi", category: "Legumi",
    kcal: 341, protein_g: 21.6, carbs_g: 62, fat_g: 1.4, fiber_g: 15,
    aa: { his: 620, ile: 950, leu: 1700, lys: 1450, sit: 430, aaa: 1900, thr: 780, trp: 220, val: 1080 } },
  { id: "fagioli_neri_secco_in_scatola_a_basso_contenuto_di_sodio", name: "Fagioli neri (in scatola)", note: "secco, in scatola, a basso contenuto di sodio", category: "Legumi",
    kcal: 91, protein_g: 6, carbs_g: 16.6, fat_g: 0.3, fiber_g: 6.9,
    aa: { his: 166, ile: 285, leu: 512, lys: 422, sit: 135, aaa: 499, thr: 222, trp: 72, val: 348 } },
  { id: "fagioli_neri_secco_cotto_bollito", name: "Fagioli neri (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 132, protein_g: 8.9, carbs_g: 23.7, fat_g: 0.5, fiber_g: 8.7,
    aa: { his: 247, ile: 391, leu: 708, lys: 608, sit: 229, aaa: 729, thr: 373, trp: 105, val: 464 } },
  { id: "soia", name: "Semi di soia (secchi)", note: "secchi, crudi", category: "Legumi",
    kcal: 446, protein_g: 36.5, carbs_g: 30, fat_g: 20, fiber_g: 9,
    aa: { his: 990, ile: 1770, leu: 2870, lys: 2260, sit: 1090, aaa: 3310, thr: 1590, trp: 480, val: 1800 } },
  { id: "semi_di_soia_cotto_bollito", name: "Semi di soia (cotti)", note: "cotto, bollito", category: "Legumi",
    kcal: 172, protein_g: 18.2, carbs_g: 8.4, fat_g: 9, fiber_g: 6,
    aa: { his: 449, ile: 807, leu: 1355, lys: 1108, sit: 492, aaa: 1499, thr: 723, trp: 242, val: 831 } },
  { id: "semi_di_soia_secco_tostato_a_secco", name: "Semi di soia (tostati)", note: "secco, tostato a secco", category: "Legumi",
    kcal: 449, protein_g: 43.3, carbs_g: 29, fat_g: 21.6, fiber_g: 8.1,
    aa: { his: 1068, ile: 1920, leu: 3223, lys: 2634, sit: 1172, aaa: 3563, thr: 1719, trp: 575, val: 1976 } },
  { id: "tofu", name: "Tofu", note: "pronto al consumo", category: "Preparati e fermentati",
    kcal: 76, protein_g: 8, carbs_g: 1.9, fat_g: 4.8, fiber_g: 0.3,
    aa: { his: 217, ile: 388, leu: 629, lys: 495, sit: 239, aaa: 725, thr: 348, trp: 105, val: 394 } },
  { id: "tofu_crudo", name: "Tofu (crudo)", note: "crudo", category: "Legumi",
    kcal: 76, protein_g: 8.1, carbs_g: 1.9, fat_g: 4.8, fiber_g: 0.3,
    aa: { his: 221, ile: 435, leu: 713, lys: 452, sit: 137, aaa: 787, thr: 402, trp: 120, val: 446 } },
  { id: "tempeh", name: "Tempeh", note: "pronto al consumo", category: "Preparati e fermentati",
    kcal: 192, protein_g: 19, carbs_g: 9, fat_g: 11, fiber_g: 9,
    aa: { his: 516, ile: 922, leu: 1495, lys: 1177, sit: 568, aaa: 1724, thr: 828, trp: 250, val: 938 } },
  { id: "edamame", name: "Edamame (crudi)", note: "crudi", category: "Legumi",
    kcal: 121, protein_g: 11, carbs_g: 10, fat_g: 5, fiber_g: 5,
    aa: { his: 298, ile: 533, leu: 864, lys: 680, sit: 328, aaa: 996, thr: 479, trp: 144, val: 542 } },
  { id: "edamame_surgelato", name: "Edamame (surgelati)", note: "surgelato", category: "Legumi",
    kcal: 121, protein_g: 11.9, carbs_g: 8.9, fat_g: 5.2, fiber_g: 5.2,
    aa: { his: 267, ile: 300, leu: 745, lys: 745, sit: 265, aaa: 824, thr: 331, trp: 126, val: 324 } },
  { id: "piselli", name: "Piselli spezzati (secchi)", note: "secchi, crudi", category: "Legumi",
    kcal: 341, protein_g: 24.6, carbs_g: 60, fat_g: 1.2, fiber_g: 25,
    aa: { his: 570, ile: 1030, leu: 1650, lys: 1700, sit: 400, aaa: 2100, thr: 850, trp: 200, val: 1150 } },
  { id: "piselli_spezzati_secco_cotto_bollito", name: "Piselli spezzati (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 116, protein_g: 8.3, carbs_g: 20.5, fat_g: 0.4, fiber_g: 8.3,
    aa: { his: 203, ile: 344, leu: 598, lys: 602, sit: 212, aaa: 626, thr: 296, trp: 93, val: 394 } },
  { id: "quinoa", name: "Quinoa (cruda)", note: "cruda", category: "Cereali e pseudocereali",
    kcal: 368, protein_g: 14.1, carbs_g: 64, fat_g: 6, fiber_g: 7,
    aa: { his: 400, ile: 550, leu: 870, lys: 780, sit: 400, aaa: 1090, thr: 460, trp: 170, val: 620 } },
  { id: "riso_integrale", name: "Riso integrale (crudo)", note: "crudo", category: "Cereali e pseudocereali",
    kcal: 370, protein_g: 7.9, carbs_g: 77, fat_g: 2.9, fiber_g: 3.5,
    aa: { his: 210, ile: 320, leu: 650, lys: 300, sit: 280, aaa: 700, thr: 290, trp: 100, val: 470 } },
  { id: "avena", name: "Avena (cruda)", note: "cruda, in fiocchi", category: "Cereali e pseudocereali",
    kcal: 389, protein_g: 13.2, carbs_g: 66, fat_g: 6.9, fiber_g: 10.6,
    aa: { his: 290, ile: 550, leu: 970, lys: 560, sit: 400, aaa: 1080, thr: 460, trp: 180, val: 730 } },
  { id: "avena_2", name: "Avena", note: "", category: "Cereali e pseudocereali",
    kcal: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6,
    aa: { his: 405, ile: 694, leu: 1284, lys: 701, sit: 720, aaa: 1468, thr: 575, trp: 234, val: 937 } },
  { id: "grano_saraceno", name: "Grano saraceno (crudo)", note: "crudo", category: "Cereali e pseudocereali",
    kcal: 343, protein_g: 13.3, carbs_g: 71, fat_g: 3.4, fiber_g: 10,
    aa: { his: 310, ile: 500, leu: 800, lys: 680, sit: 300, aaa: 950, thr: 460, trp: 200, val: 640 } },
  { id: "grano_saraceno_2", name: "Grano saraceno", note: "", category: "Cereali e pseudocereali",
    kcal: 343, protein_g: 13.3, carbs_g: 71.5, fat_g: 3.4, fiber_g: 10,
    aa: { his: 309, ile: 498, leu: 832, lys: 672, sit: 401, aaa: 761, thr: 506, trp: 192, val: 678 } },
  { id: "farro", name: "Farro (crudo)", note: "crudo", category: "Cereali e pseudocereali",
    kcal: 338, protein_g: 14.6, carbs_g: 70, fat_g: 2.4, fiber_g: 10.7,
    aa: { his: 320, ile: 500, leu: 950, lys: 380, sit: 400, aaa: 1150, thr: 380, trp: 180, val: 620 } },
  { id: "mandorle", name: "Mandorle (crude)", note: "crude", category: "Frutta secca e semi",
    kcal: 579, protein_g: 21.2, carbs_g: 22, fat_g: 50, fiber_g: 12.5,
    aa: { his: 550, ile: 750, leu: 1470, lys: 610, sit: 420, aaa: 1900, thr: 620, trp: 210, val: 850 } },
  { id: "mandorle_2", name: "Mandorle", note: "", category: "Frutta secca e semi",
    kcal: 579, protein_g: 21.2, carbs_g: 21.6, fat_g: 49.9, fiber_g: 12.5,
    aa: { his: 539, ile: 751, leu: 1473, lys: 568, sit: 372, aaa: 1582, thr: 601, trp: 211, val: 855 } },
  { id: "anacardi", name: "Anacardi (crudi)", note: "crudi", category: "Frutta secca e semi",
    kcal: 553, protein_g: 18.2, carbs_g: 30, fat_g: 44, fiber_g: 3.3,
    aa: { his: 460, ile: 780, leu: 1350, lys: 1000, sit: 560, aaa: 1550, thr: 660, trp: 290, val: 1090 } },
  { id: "anacardi_tostato_a_secco", name: "Anacardi (tostati)", note: "tostato a secco", category: "Frutta secca e semi",
    kcal: 574, protein_g: 15.3, carbs_g: 32.7, fat_g: 46.4, fiber_g: 3,
    aa: { his: 399, ile: 731, leu: 1285, lys: 817, sit: 557, aaa: 1282, thr: 592, trp: 237, val: 1040 } },
  { id: "semi_zucca", name: "Semi di zucca (crudi)", note: "crudi", category: "Frutta secca e semi",
    kcal: 559, protein_g: 30.2, carbs_g: 11, fat_g: 49, fiber_g: 6,
    aa: { his: 800, ile: 1300, leu: 2200, lys: 1450, sit: 1000, aaa: 2500, thr: 1100, trp: 420, val: 1700 } },
  { id: "semi_di_zucca_secco", name: "Semi di zucca (secchi)", note: "secco", category: "Frutta secca e semi",
    kcal: 559, protein_g: 30.2, carbs_g: 10.7, fat_g: 49.1, fiber_g: 6,
    aa: { his: 780, ile: 1281, leu: 2419, lys: 1236, sit: 935, aaa: 2826, thr: 998, trp: 576, val: 1579 } },
  { id: "semi_di_zucca_tostato", name: "Semi di zucca (tostati)", note: "tostato", category: "Frutta secca e semi",
    kcal: 446, protein_g: 18.6, carbs_g: 53.8, fat_g: 19.4, fiber_g: 18.4,
    aa: { his: 515, ile: 956, leu: 1572, lys: 1386, sit: 645, aaa: 1694, thr: 683, trp: 326, val: 1491 } },
  { id: "semi_canapa", name: "Semi di canapa (crudi)", note: "crudi, decorticati", category: "Frutta secca e semi",
    kcal: 553, protein_g: 31.6, carbs_g: 8.7, fat_g: 49, fiber_g: 4,
    aa: { his: 850, ile: 1200, leu: 2100, lys: 1200, sit: 950, aaa: 2600, thr: 1150, trp: 380, val: 1600 } },
  { id: "semi_di_canapa", name: "Semi di canapa", note: "", category: "Frutta secca e semi",
    kcal: 553, protein_g: 31.6, carbs_g: 8.7, fat_g: 48.8, fiber_g: 4,
    aa: { his: 969, ile: 1286, leu: 2163, lys: 1276, sit: 1605, aaa: 2710, thr: 1269, trp: 369, val: 1777 } },
  { id: "semi_chia", name: "Semi di chia (crudi)", note: "crudi", category: "Frutta secca e semi",
    kcal: 486, protein_g: 16.5, carbs_g: 42, fat_g: 31, fiber_g: 34,
    aa: { his: 480, ile: 700, leu: 1150, lys: 850, sit: 550, aaa: 1350, thr: 600, trp: 220, val: 900 } },
  { id: "semi_di_chia_secco", name: "Semi di chia (secchi)", note: "secco", category: "Frutta secca e semi",
    kcal: 486, protein_g: 16.5, carbs_g: 42.1, fat_g: 30.7, fiber_g: 34.4,
    aa: { his: 531, ile: 801, leu: 1371, lys: 970, sit: 995, aaa: 1579, thr: 709, trp: 436, val: 950 } },
  { id: "arachidi", name: "Arachidi (crude)", note: "crude", category: "Frutta secca e semi",
    kcal: 567, protein_g: 25.8, carbs_g: 16, fat_g: 49, fiber_g: 8.5,
    aa: { his: 640, ile: 900, leu: 1670, lys: 940, sit: 590, aaa: 2530, thr: 880, trp: 250, val: 1050 } },
  { id: "arachidi_cotto_bollito", name: "Arachidi (cotte)", note: "cotto, bollito", category: "Legumi",
    kcal: 318, protein_g: 13.5, carbs_g: 21.3, fat_g: 22, fiber_g: 8.8,
    aa: { his: 341, ile: 475, leu: 875, lys: 485, sit: 339, aaa: 1249, thr: 462, trp: 131, val: 566 } },
  { id: "arachidi_tostato_a_secco", name: "Arachidi (tostate)", note: "tostato a secco", category: "Frutta secca e semi",
    kcal: 594, protein_g: 17.3, carbs_g: 25.4, fat_g: 51.5, fiber_g: 9,
    aa: { his: 480, ile: 744, leu: 1371, lys: 712, sit: 515, aaa: 1629, thr: 597, trp: 264, val: 934 } },
  { id: "seitan", name: "Seitan", note: "pronto al consumo", category: "Preparati e fermentati",
    kcal: 370, protein_g: 25, carbs_g: 14, fat_g: 1.9, fiber_g: 0.6,
    aa: { his: 550, ile: 850, leu: 1650, lys: 400, sit: 350, aaa: 2500, thr: 700, trp: 250, val: 1050 } },
  { id: "lievito_alimentare", name: "Lievito alimentare", note: "essiccato, in scaglie", category: "Preparati e fermentati",
    // Escluso dai suggerimenti di completamento: nella pratica si usa come insaporitore
    // in piccole quantità (poche grammi), non come componente proteico su cui basare
    // un pasto. Resta comunque selezionabile a mano dall'utente, come richiesto.
    excludeFromSuggestions: true,
    kcal: 350, protein_g: 47, carbs_g: 30, fat_g: 5, fiber_g: 20,
    aa: { his: 1100, ile: 1740, leu: 2960, lys: 3060, sit: 1080, aaa: 2770, thr: 2260, trp: 420, val: 2490 } },
  { id: "fagioli_cannellini", name: "Fagioli cannellini (secchi)", note: "secchi, crudi", category: "Legumi",
    kcal: 333, protein_g: 23.4, carbs_g: 60, fat_g: 0.85, fiber_g: 15,
    aa: { his: 640, ile: 980, leu: 1750, lys: 1550, sit: 450, aaa: 1950, thr: 800, trp: 230, val: 1100 } },
  { id: "fagioli_rossi", name: "Fagioli rossi (kidney) (secchi)", note: "secchi, crudi", category: "Legumi",
    kcal: 337, protein_g: 23.6, carbs_g: 60, fat_g: 0.8, fiber_g: 15,
    aa: { his: 650, ile: 1000, leu: 1800, lys: 1600, sit: 440, aaa: 2000, thr: 820, trp: 230, val: 1120 } },
  { id: "fagioli_rossi_kidney_secco_in_scatola", name: "Fagioli rossi (kidney) (in scatola)", note: "secco, in scatola", category: "Legumi",
    kcal: 84, protein_g: 5.2, carbs_g: 14.5, fat_g: 0.6, fiber_g: 4.3,
    aa: { his: 144, ile: 248, leu: 445, lys: 367, sit: 117, aaa: 433, thr: 193, trp: 63, val: 302 } },
  { id: "fagioli_rossi_kidney_secco_cotto_bollito", name: "Fagioli rossi (kidney) (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 127, protein_g: 8.7, carbs_g: 22.8, fat_g: 0.5, fiber_g: 6.4,
    aa: { his: 242, ile: 383, leu: 693, lys: 595, sit: 224, aaa: 713, thr: 365, trp: 103, val: 454 } },
  { id: "fagioli_borlotti", name: "Fagioli borlotti (secchi)", note: "secchi, crudi", category: "Legumi",
    kcal: 335, protein_g: 23, carbs_g: 60, fat_g: 1.2, fiber_g: 16,
    aa: { his: 630, ile: 970, leu: 1720, lys: 1500, sit: 430, aaa: 1930, thr: 790, trp: 220, val: 1090 } },
  { id: "fagioli_borlotti_secco_in_scatola", name: "Fagioli borlotti (in scatola)", note: "secco, in scatola", category: "Legumi",
    kcal: 83, protein_g: 5.5, carbs_g: 15.1, fat_g: 0.3, fiber_g: 6.3,
    aa: { his: 154, ile: 245, leu: 443, lys: 381, sit: 143, aaa: 456, thr: 233, trp: 66, val: 290 } },
  { id: "fagioli_borlotti_secco_cotto_bollito", name: "Fagioli borlotti (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 136, protein_g: 9.3, carbs_g: 24.5, fat_g: 0.5, fiber_g: 8.6,
    aa: { his: 260, ile: 412, leu: 746, lys: 641, sit: 242, aaa: 768, thr: 393, trp: 111, val: 489 } },
  { id: "pasta_semola", name: "Pasta di semola (cruda)", note: "cruda", category: "Farine, pane e pasta",
    kcal: 371, protein_g: 13, carbs_g: 74.7, fat_g: 1.5, fiber_g: 3.2,
    aa: { his: 300, ile: 480, leu: 900, lys: 350, sit: 380, aaa: 1150, thr: 370, trp: 150, val: 580 } },
  { id: "pasta_di_semola_cotto_arricchito", name: "Pasta di semola (cotta)", note: "cotto, arricchito", category: "Farine, pane e pasta",
    kcal: 157, protein_g: 5.8, carbs_g: 30.6, fat_g: 0.9, fiber_g: 1.8,
    aa: { his: 131, ile: 224, leu: 434, lys: 131, sit: 176, aaa: 400, thr: 203, trp: 81, val: 258 } },
  { id: "pasta_di_semola_secco_arricchito", name: "Pasta di semola (secca)", note: "secco, arricchito", category: "Farine, pane e pasta",
    kcal: 371, protein_g: 13, carbs_g: 74.7, fat_g: 1.5, fiber_g: 3.2,
    aa: { his: 298, ile: 511, leu: 988, lys: 298, sit: 402, aaa: 911, thr: 462, trp: 185, val: 588 } },
  { id: "pasta_integrale", name: "Pasta integrale (cruda)", note: "cruda", category: "Farine, pane e pasta",
    kcal: 348, protein_g: 13, carbs_g: 71.5, fat_g: 2.5, fiber_g: 8,
    aa: { his: 310, ile: 500, leu: 930, lys: 400, sit: 400, aaa: 1180, thr: 400, trp: 170, val: 610 } },
  { id: "pasta_integrale_cotto", name: "Pasta integrale (cotta)", note: "cotto", category: "Farine, pane e pasta",
    kcal: 149, protein_g: 6, carbs_g: 30.1, fat_g: 1.7, fiber_g: 3.9,
    aa: { his: 140, ile: 232, leu: 409, lys: 133, sit: 222, aaa: 454, thr: 161, trp: 77, val: 259 } },
  { id: "riso_bianco", name: "Riso bianco (crudo)", note: "crudo", category: "Cereali e pseudocereali",
    kcal: 365, protein_g: 7.1, carbs_g: 80, fat_g: 0.7, fiber_g: 1.3,
    aa: { his: 190, ile: 290, leu: 590, lys: 270, sit: 260, aaa: 640, thr: 260, trp: 90, val: 430 } },
  { id: "riso_bianco_secco_parboiled_arricchito", name: "Riso bianco (secco)", note: "secco, parboiled, arricchito", category: "Cereali e pseudocereali",
    kcal: 374, protein_g: 7.5, carbs_g: 80.9, fat_g: 1, fiber_g: 1.8,
    aa: { his: 185, ile: 339, leu: 656, lys: 215, sit: 336, aaa: 614, thr: 271, trp: 103, val: 470 } },
  { id: "riso_bianco_secco_precotto_istantaneo_arricchito", name: "Riso bianco (cotto)", note: "secco, precotto/istantaneo, arricchito", category: "Cereali e pseudocereali",
    kcal: 380, protein_g: 7.8, carbs_g: 82.3, fat_g: 0.9, fiber_g: 1.9,
    aa: { his: 189, ile: 359, leu: 691, lys: 221, sit: 350, aaa: 645, thr: 289, trp: 106, val: 497 } },
  { id: "pane_bianco", name: "Pane bianco", note: "di farina raffinata", category: "Farine, pane e pasta",
    kcal: 265, protein_g: 9, carbs_g: 49, fat_g: 3.2, fiber_g: 2.7,
    aa: { his: 210, ile: 340, leu: 640, lys: 220, sit: 260, aaa: 800, thr: 260, trp: 110, val: 400 } },
  { id: "pane_integrale", name: "Pane integrale", note: "di farina integrale", category: "Farine, pane e pasta",
    kcal: 247, protein_g: 10.5, carbs_g: 41, fat_g: 3.4, fiber_g: 6,
    aa: { his: 240, ile: 380, leu: 720, lys: 290, sit: 300, aaa: 900, thr: 300, trp: 130, val: 460 } },
  { id: "burro_arachidi", name: "Burro di arachidi", note: "senza zuccheri aggiunti", category: "Frutta secca e semi",
    kcal: 588, protein_g: 25, carbs_g: 20, fat_g: 50, fiber_g: 6,
    aa: { his: 620, ile: 870, leu: 1620, lys: 910, sit: 570, aaa: 2450, thr: 850, trp: 240, val: 1020 } },
  { id: "semi_di_lino", name: "Semi di lino", note: "", category: "Frutta secca e semi",
    kcal: 545, protein_g: 18, carbs_g: 34.4, fat_g: 37.3, fiber_g: 23.1,
    aa: { his: 514, ile: 938, leu: 1380, lys: 933, sit: 403, aaa: 1689, thr: 931, trp: 301, val: 1138 } },
  { id: "farina_di_soia_magra", name: "Farina di soia magra", note: "", category: "Legumi",
    kcal: 366, protein_g: 51.1, carbs_g: 32.9, fat_g: 3.3, fiber_g: 0,
    aa: { his: 1270, ile: 2310, leu: 4110, lys: 3060, sit: 622, aaa: 4600, thr: 1970, trp: 616, val: 2310 } },
  { id: "farina_di_soia_integrale", name: "Farina di soia integrale", note: "", category: "Legumi",
    kcal: 452, protein_g: 38.6, carbs_g: 27.9, fat_g: 20.7, fiber_g: 0,
    aa: { his: 950, ile: 1740, leu: 3060, lys: 2140, sit: 485, aaa: 3550, thr: 1480, trp: 450, val: 1740 } },
  { id: "mandorle_intere_crude_crudo", name: "Mandorle intere crude", note: "crudo", category: "Frutta secca e semi",
    kcal: 626, protein_g: 21.5, carbs_g: 20, fat_g: 51.1, fiber_g: 10.8,
    aa: { his: 548, ile: 774, leu: 1488, lys: 618, sit: 154, aaa: 1828, thr: 608, trp: 208, val: 916 } },
  { id: "noci_macadamia_crudo", name: "Noci macadamia (crude)", note: "crudo", category: "Frutta secca e semi",
    kcal: 712, protein_g: 7.8, carbs_g: 24.1, fat_g: 64.9, fiber_g: 7.6,
    aa: { his: 195, ile: 314, leu: 602, lys: 18, sit: 29, aaa: 1176, thr: 370, trp: 67, val: 363 } },
  { id: "noci_macadamia_tostato_a_secco", name: "Noci macadamia (tostate)", note: "tostato a secco", category: "Frutta secca e semi",
    kcal: 718, protein_g: 7.8, carbs_g: 13.4, fat_g: 76.1, fiber_g: 8,
    aa: { his: 192, ile: 309, leu: 592, lys: 18, sit: 28, aaa: 1157, thr: 364, trp: 66, val: 357 } },
  { id: "noci_pecan_crudo", name: "Noci pecan (crude)", note: "crudo", category: "Frutta secca e semi",
    kcal: 750, protein_g: 10, carbs_g: 12.7, fat_g: 73.3, fiber_g: 5.8,
    aa: { his: 263, ile: 365, leu: 670, lys: 320, sit: 168, aaa: 775, thr: 303, trp: 115, val: 435 } },
  { id: "noci_pecan_tostato_a_secco", name: "Noci pecan (tostate)", note: "tostato a secco", category: "Frutta secca e semi",
    kcal: 710, protein_g: 9.5, carbs_g: 13.6, fat_g: 74.3, fiber_g: 9.4,
    aa: { his: 271, ile: 348, leu: 619, lys: 297, sit: 347, aaa: 664, thr: 317, trp: 96, val: 426 } },
  { id: "pinoli_crudo", name: "Pinoli (crudi)", note: "crudo", category: "Frutta secca e semi",
    kcal: 689, protein_g: 15.7, carbs_g: 18.6, fat_g: 61.3, fiber_g: 3.9,
    aa: { his: 370, ile: 567, leu: 1097, lys: 587, sit: 330, aaa: 1180, thr: 467, trp: 147, val: 737 } },
  { id: "pinoli_secco", name: "Pinoli (secchi)", note: "secco", category: "Frutta secca e semi",
    kcal: 673, protein_g: 13.7, carbs_g: 13.1, fat_g: 68.4, fiber_g: 3.7,
    aa: { his: 341, ile: 542, leu: 991, lys: 540, sit: 548, aaa: 1033, thr: 370, trp: 107, val: 687 } },
  { id: "pistacchi_crudo", name: "Pistacchi (crudi)", note: "crudo", category: "Frutta secca e semi",
    kcal: 598, protein_g: 20.5, carbs_g: 27.7, fat_g: 45, fiber_g: 7,
    aa: { his: 512, ile: 917, leu: 1604, lys: 1138, sit: 652, aaa: 1601, thr: 684, trp: 251, val: 1249 } },
  { id: "pistacchi_tostato_a_secco", name: "Pistacchi (tostati)", note: "tostato a secco", category: "Frutta secca e semi",
    kcal: 569, protein_g: 21.1, carbs_g: 27.6, fat_g: 45.8, fiber_g: 10.3,
    aa: { his: 535, ile: 957, leu: 1675, lys: 1189, sit: 680, aaa: 1671, thr: 714, trp: 262, val: 1305 } },
  { id: "noci_crudo", name: "Noci (crude)", note: "crudo", category: "Frutta secca e semi",
    kcal: 730, protein_g: 14.6, carbs_g: 10.9, fat_g: 69.7, fiber_g: 5.2,
    aa: { his: 343, ile: 520, leu: 997, lys: 380, sit: 190, aaa: 1037, thr: 443, trp: 127, val: 597 } },
  { id: "noci", name: "Noci", note: "", category: "Frutta secca e semi",
    kcal: 654, protein_g: 15.2, carbs_g: 13.7, fat_g: 65.2, fiber_g: 6.7,
    aa: { his: 391, ile: 625, leu: 1170, lys: 424, sit: 444, aaa: 1117, thr: 596, trp: 170, val: 753 } },
  { id: "amaranto_chicco_crudo", name: "Amaranto (chicco) (crudo)", note: "crudo", category: "Cereali e pseudocereali",
    kcal: 371, protein_g: 13.6, carbs_g: 65.3, fat_g: 7, fiber_g: 6.7,
    aa: { his: 389, ile: 582, leu: 879, lys: 747, sit: 417, aaa: 871, thr: 558, trp: 181, val: 679 } },
  { id: "farina_d_orzo", name: "Farina d'orzo", note: "", category: "Cereali e pseudocereali",
    kcal: 345, protein_g: 10.5, carbs_g: 74.5, fat_g: 1.6, fiber_g: 10.1,
    aa: { his: 236, ile: 383, leu: 713, lys: 391, sit: 434, aaa: 890, thr: 356, trp: 175, val: 515 } },
  { id: "orzo", name: "Orzo", note: "", category: "Cereali e pseudocereali",
    kcal: 354, protein_g: 12.5, carbs_g: 73.5, fat_g: 2.3, fiber_g: 17.3,
    aa: { his: 281, ile: 456, leu: 848, lys: 465, sit: 516, aaa: 1058, thr: 424, trp: 208, val: 612 } },
  { id: "orzo_crudo", name: "Orzo (crudo)", note: "crudo", category: "Cereali e pseudocereali",
    kcal: 352, protein_g: 9.9, carbs_g: 77.7, fat_g: 1.2, fiber_g: 15.6,
    aa: { his: 223, ile: 362, leu: 673, lys: 369, sit: 409, aaa: 840, thr: 337, trp: 165, val: 486 } },
  { id: "fagioli_azuki_secco_cotto_bollito", name: "Fagioli azuki (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 128, protein_g: 7.5, carbs_g: 24.8, fat_g: 0.1, fiber_g: 7.3,
    aa: { his: 198, ile: 300, leu: 632, lys: 567, sit: 149, aaa: 622, thr: 255, trp: 72, val: 387 } },
  { id: "fagioli_azuki_secco_crudo", name: "Fagioli azuki (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 329, protein_g: 19.9, carbs_g: 62.9, fat_g: 0.5, fiber_g: 12.7,
    aa: { his: 524, ile: 791, leu: 1668, lys: 1497, sit: 394, aaa: 1643, thr: 674, trp: 191, val: 1023 } },
  { id: "fagioli_in_salsa_baked_beans_in_scatola", name: "Fagioli in salsa (baked beans) (in scatola)", note: "in scatola", category: "Legumi",
    kcal: 142, protein_g: 6.8, carbs_g: 15.4, fat_g: 6.6, fiber_g: 6.9,
    aa: { his: 190, ile: 297, leu: 534, lys: 472, sit: 179, aaa: 539, thr: 279, trp: 77, val: 345 } },
  { id: "fagioli_in_salsa_baked_beans", name: "Fagioli in salsa (baked beans)", note: "", category: "Legumi",
    kcal: 155, protein_g: 5.5, carbs_g: 21.6, fat_g: 5.2, fiber_g: 5.5,
    aa: { his: 153, ile: 242, leu: 428, lys: 379, sit: 148, aaa: 442, thr: 228, trp: 67, val: 282 } },
  { id: "fagioli_neri_black_turtle_secco_in_scatola", name: "Fagioli neri (Black Turtle) (in scatola)", note: "secco, in scatola", category: "Legumi",
    kcal: 91, protein_g: 6, carbs_g: 16.6, fat_g: 0.3, fiber_g: 6.9,
    aa: { his: 166, ile: 285, leu: 512, lys: 422, sit: 135, aaa: 499, thr: 222, trp: 72, val: 348 } },
  { id: "fagioli_neri_black_turtle_secco_cotto_bollito", name: "Fagioli neri (Black Turtle) (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 130, protein_g: 8.2, carbs_g: 24.4, fat_g: 0.4, fiber_g: 8.3,
    aa: { his: 228, ile: 361, leu: 653, lys: 562, sit: 212, aaa: 672, thr: 344, trp: 97, val: 428 } },
  { id: "fagioli_neri_black_turtle_secco_crudo", name: "Fagioli neri (Black Turtle) (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 339, protein_g: 21.3, carbs_g: 63.3, fat_g: 0.9, fiber_g: 15.5,
    aa: { his: 592, ile: 938, leu: 1697, lys: 1459, sit: 551, aaa: 1747, thr: 894, trp: 252, val: 1112 } },
  { id: "fagioli_varieta_francese_secco_cotto_bollito", name: "Fagioli (varietà francese) (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 129, protein_g: 7.1, carbs_g: 24, fat_g: 0.8, fiber_g: 9.4,
    aa: { his: 196, ile: 311, leu: 563, lys: 484, sit: 183, aaa: 580, thr: 297, trp: 83, val: 369 } },
  { id: "fagioli_varieta_francese_secco_crudo", name: "Fagioli (varietà francese) (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 343, protein_g: 18.8, carbs_g: 64.1, fat_g: 2, fiber_g: 25.2,
    aa: { his: 524, ile: 831, leu: 1502, lys: 1291, sit: 488, aaa: 1547, thr: 792, trp: 223, val: 984 } },
  { id: "fagioli_bianchi_great_northern_secco_in_scatola", name: "Fagioli bianchi (Great Northern) (in scatola)", note: "secco, in scatola", category: "Legumi",
    kcal: 114, protein_g: 7.4, carbs_g: 21, fat_g: 0.4, fiber_g: 4.9,
    aa: { his: 202, ile: 349, leu: 626, lys: 516, sit: 165, aaa: 609, thr: 271, trp: 88, val: 425 } },
  { id: "fagioli_bianchi_great_northern_secco_cotto_bollito", name: "Fagioli bianchi (Great Northern) (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 118, protein_g: 8.3, carbs_g: 21.1, fat_g: 0.5, fiber_g: 7,
    aa: { his: 232, ile: 368, leu: 665, lys: 572, sit: 216, aaa: 686, thr: 351, trp: 99, val: 436 } },
  { id: "fagioli_bianchi_great_northern_secco_crudo", name: "Fagioli bianchi (Great Northern) (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 339, protein_g: 21.9, carbs_g: 62.4, fat_g: 1.1, fiber_g: 20.2,
    aa: { his: 608, ile: 965, leu: 1745, lys: 1500, sit: 567, aaa: 1797, thr: 920, trp: 259, val: 1144 } },
  { id: "fagioli_rossi_california_secco_cotto_bollito", name: "Fagioli rossi (California) (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 124, protein_g: 9.1, carbs_g: 22.4, fat_g: 0.1, fiber_g: 9.3,
    aa: { his: 254, ile: 403, leu: 729, lys: 627, sit: 236, aaa: 751, thr: 384, trp: 108, val: 478 } },
  { id: "fagioli_rossi_california_secco_crudo", name: "Fagioli rossi (California) (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 330, protein_g: 24.4, carbs_g: 59.8, fat_g: 0.3, fiber_g: 24.9,
    aa: { his: 679, ile: 1076, leu: 1946, lys: 1673, sit: 632, aaa: 2004, thr: 1026, trp: 289, val: 1275 } },
  { id: "fagioli_rossi_royal_red_secco_cotto_bollito", name: "Fagioli rossi (Royal Red) (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 123, protein_g: 9.5, carbs_g: 21.9, fat_g: 0.2, fiber_g: 9.3,
    aa: { his: 264, ile: 419, leu: 757, lys: 651, sit: 246, aaa: 780, thr: 399, trp: 112, val: 496 } },
  { id: "fagioli_rossi_royal_red_secco_crudo", name: "Fagioli rossi (Royal Red) (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 329, protein_g: 25.3, carbs_g: 58.3, fat_g: 0.5, fiber_g: 24.9,
    aa: { his: 705, ile: 1118, leu: 2022, lys: 1738, sit: 657, aaa: 2083, thr: 1066, trp: 300, val: 1325 } },
  { id: "fagioli_cannellini_piccoli_navy_secco_in_scatola", name: "Fagioli cannellini piccoli (Navy) (in scatola)", note: "secco, in scatola", category: "Legumi",
    kcal: 113, protein_g: 7.5, carbs_g: 20.5, fat_g: 0.4, fiber_g: 5.1,
    aa: { his: 207, ile: 356, leu: 639, lys: 527, sit: 169, aaa: 622, thr: 277, trp: 90, val: 434 } },
  { id: "fagioli_cannellini_piccoli_navy_secco_cotto_bollito", name: "Fagioli cannellini piccoli (Navy) (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 140, protein_g: 8.2, carbs_g: 26.1, fat_g: 0.6, fiber_g: 10.5,
    aa: { his: 206, ile: 387, leu: 700, lys: 520, sit: 187, aaa: 668, thr: 289, trp: 100, val: 504 } },
  { id: "fagioli_cannellini_piccoli_navy_secco_crudo", name: "Fagioli cannellini piccoli (Navy) (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 337, protein_g: 22.3, carbs_g: 60.8, fat_g: 1.5, fiber_g: 15.3,
    aa: { his: 507, ile: 952, leu: 1723, lys: 1280, sit: 460, aaa: 1642, thr: 711, trp: 247, val: 1241 } },
  { id: "fagioli_cannellini_piccoli_navy_germogliato_cotto_bollito_sg", name: "Fagioli cannellini piccoli (Navy) (germogliati)", note: "germogliato, cotto, bollito, sgocciolato", category: "Legumi",
    kcal: 78, protein_g: 7.1, carbs_g: 15, fat_g: 0.8, fiber_g: 0,
    aa: { his: 198, ile: 314, leu: 508, lys: 403, sit: 154, aaa: 600, thr: 297, trp: 74, val: 363 } },
  { id: "fagioli_rosa_secco_cotto_bollito", name: "Fagioli rosa (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 149, protein_g: 9.1, carbs_g: 27.9, fat_g: 0.5, fiber_g: 5.3,
    aa: { his: 252, ile: 400, leu: 723, lys: 622, sit: 235, aaa: 745, thr: 381, trp: 107, val: 474 } },
  { id: "fagioli_rosa_secco_crudo", name: "Fagioli rosa (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 343, protein_g: 21, carbs_g: 64.2, fat_g: 1.1, fiber_g: 12.7,
    aa: { his: 583, ile: 925, leu: 1673, lys: 1438, sit: 543, aaa: 1723, thr: 882, trp: 248, val: 1096 } },
  { id: "fagioli_pinto_in_scatola_sgocciolato", name: "Fagioli pinto (in scatola)", note: "in scatola, sgocciolato", category: "Legumi",
    kcal: 114, protein_g: 7, carbs_g: 20.2, fat_g: 0.9, fiber_g: 5.5,
    aa: { his: 183, ile: 287, leu: 513, lys: 446, sit: 146, aaa: 501, thr: 266, trp: 78, val: 329 } },
  { id: "fagioli_pinto_secco_cotto_bollito", name: "Fagioli pinto (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 143, protein_g: 9, carbs_g: 26.2, fat_g: 0.7, fiber_g: 9,
    aa: { his: 232, ile: 368, leu: 664, lys: 571, sit: 216, aaa: 684, thr: 350, trp: 98, val: 435 } },
  { id: "fagioli_pinto_secco_crudo", name: "Fagioli pinto (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 347, protein_g: 21.4, carbs_g: 62.6, fat_g: 1.2, fiber_g: 15.5,
    aa: { his: 556, ile: 871, leu: 1558, lys: 1356, sit: 446, aaa: 1522, thr: 810, trp: 237, val: 998 } },
  { id: "fagioli_pinto_germogliato_crudo", name: "Fagioli pinto (germogliati)", note: "germogliato, crudo", category: "Legumi",
    kcal: 62, protein_g: 5.3, carbs_g: 11.6, fat_g: 0.9, fiber_g: 0,
    aa: { his: 147, ile: 233, leu: 377, lys: 299, sit: 115, aaa: 446, thr: 220, trp: 55, val: 270 } },
  { id: "fagioli_bianchi_piccoli_secco_cotto_bollito", name: "Fagioli bianchi piccoli (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 142, protein_g: 9, carbs_g: 25.8, fat_g: 0.6, fiber_g: 10.4,
    aa: { his: 250, ile: 396, leu: 716, lys: 616, sit: 233, aaa: 738, thr: 377, trp: 106, val: 469 } },
  { id: "fagioli_bianchi_piccoli_secco_crudo", name: "Fagioli bianchi piccoli (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 336, protein_g: 21.1, carbs_g: 62.3, fat_g: 1.2, fiber_g: 24.9,
    aa: { his: 588, ile: 932, leu: 1685, lys: 1449, sit: 547, aaa: 1735, thr: 888, trp: 250, val: 1104 } },
  { id: "fagioli_bianchi_secco_in_scatola", name: "Fagioli bianchi (in scatola)", note: "secco, in scatola", category: "Legumi",
    kcal: 114, protein_g: 7.3, carbs_g: 21.2, fat_g: 0.3, fiber_g: 4.8,
    aa: { his: 202, ile: 320, leu: 579, lys: 498, sit: 188, aaa: 596, thr: 305, trp: 86, val: 380 } },
  { id: "fagioli_bianchi_secco_cotto_bollito", name: "Fagioli bianchi (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 139, protein_g: 9.7, carbs_g: 25.1, fat_g: 0.4, fiber_g: 6.3,
    aa: { his: 271, ile: 429, leu: 776, lys: 668, sit: 252, aaa: 800, thr: 409, trp: 115, val: 509 } },
  { id: "fagioli_bianchi_secco_crudo", name: "Fagioli bianchi (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 333, protein_g: 23.4, carbs_g: 60.3, fat_g: 0.9, fiber_g: 15.2,
    aa: { his: 650, ile: 1031, leu: 1865, lys: 1603, sit: 605, aaa: 1921, thr: 983, trp: 277, val: 1222 } },
  { id: "fagioli_gialli_secco_cotto_bollito", name: "Fagioli gialli (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 144, protein_g: 9.2, carbs_g: 25.3, fat_g: 1.1, fiber_g: 10.4,
    aa: { his: 255, ile: 405, leu: 732, lys: 629, sit: 238, aaa: 754, thr: 386, trp: 108, val: 479 } },
  { id: "fagioli_gialli_secco_crudo", name: "Fagioli gialli (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 345, protein_g: 22, carbs_g: 60.7, fat_g: 2.6, fiber_g: 25.1,
    aa: { his: 612, ile: 972, leu: 1756, lys: 1510, sit: 570, aaa: 1810, thr: 926, trp: 260, val: 1151 } },
  { id: "fave_secco_in_scatola", name: "Fave (in scatola)", note: "secco, in scatola", category: "Legumi",
    kcal: 71, protein_g: 5.5, carbs_g: 12.4, fat_g: 0.2, fiber_g: 3.7,
    aa: { his: 139, ile: 221, leu: 411, lys: 350, sit: 115, aaa: 404, thr: 194, trp: 52, val: 243 } },
  { id: "fave_secco_cotto_bollito", name: "Fave (cotte)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 110, protein_g: 7.6, carbs_g: 19.7, fat_g: 0.4, fiber_g: 5.4,
    aa: { his: 193, ile: 306, leu: 572, lys: 486, sit: 159, aaa: 562, thr: 270, trp: 72, val: 338 } },
  { id: "fave_secco_crudo", name: "Fave (secche)", note: "secco, crudo", category: "Legumi",
    kcal: 341, protein_g: 26.1, carbs_g: 58.3, fat_g: 1.5, fiber_g: 25,
    aa: { his: 664, ile: 1053, leu: 1964, lys: 1671, sit: 547, aaa: 1930, thr: 928, trp: 247, val: 1161 } },
  { id: "fave_fresco_semi_immaturi_crudo", name: "Fave (fresche)", note: "fresco (semi immaturi), crudo", category: "Legumi",
    kcal: 72, protein_g: 5.6, carbs_g: 11.7, fat_g: 0.6, fiber_g: 4.2,
    aa: { his: 134, ile: 251, leu: 432, lys: 366, sit: 120, aaa: 424, thr: 208, trp: 56, val: 274 } },
  { id: "farina_di_grano_saraceno", name: "Farina di grano saraceno", note: "", category: "Cereali e pseudocereali",
    kcal: 335, protein_g: 12.6, carbs_g: 70.6, fat_g: 3.1, fiber_g: 10,
    aa: { his: 294, ile: 474, leu: 792, lys: 640, sit: 382, aaa: 725, thr: 482, trp: 183, val: 646 } },
  { id: "grano_saraceno_groats_tostato_secco", name: "Grano saraceno (groats) (tostato)", note: "tostato, secco", category: "Cereali e pseudocereali",
    kcal: 346, protein_g: 11.7, carbs_g: 75, fat_g: 2.7, fiber_g: 10.3,
    aa: { his: 273, ile: 441, leu: 736, lys: 595, sit: 355, aaa: 674, thr: 448, trp: 170, val: 600 } },
  { id: "bulgur_secco", name: "Bulgur (secco)", note: "secco", category: "Cereali e pseudocereali",
    kcal: 342, protein_g: 12.3, carbs_g: 75.9, fat_g: 1.3, fiber_g: 12.5,
    aa: { his: 285, ile: 455, leu: 830, lys: 339, sit: 475, aaa: 938, thr: 354, trp: 190, val: 554 } },
  { id: "peperoncino_con_fagioli_in_scatola", name: "Peperoncino con fagioli (in scatola)", note: "in scatola", category: "Legumi",
    kcal: 103, protein_g: 6.1, carbs_g: 13.2, fat_g: 3.8, fiber_g: 3.3,
    aa: { his: 164, ile: 250, leu: 456, lys: 409, sit: 156, aaa: 456, thr: 240, trp: 69, val: 294 } },
  { id: "farina_di_mais_masa_arricchito", name: "Farina di mais (masa)", note: "arricchito", category: "Cereali e pseudocereali",
    kcal: 363, protein_g: 8.5, carbs_g: 76.6, fat_g: 3.7, fiber_g: 6.4,
    aa: { his: 260, ile: 276, leu: 1025, lys: 219, sit: 349, aaa: 640, thr: 245, trp: 62, val: 380 } },
  { id: "farina_di_mais_integrale", name: "Farina di mais integrale", note: "", category: "Cereali e pseudocereali",
    kcal: 361, protein_g: 6.9, carbs_g: 76.9, fat_g: 3.9, fiber_g: 7.3,
    aa: { his: 211, ile: 248, leu: 850, lys: 195, sit: 270, aaa: 622, thr: 261, trp: 49, val: 351 } },
  { id: "mais_chicco", name: "Mais (chicco)", note: "", category: "Cereali e pseudocereali",
    kcal: 365, protein_g: 9.4, carbs_g: 74.3, fat_g: 4.7, fiber_g: 0,
    aa: { his: 287, ile: 337, leu: 1155, lys: 265, sit: 367, aaa: 846, thr: 354, trp: 67, val: 477 } },
  { id: "farina_di_mais_semola_arricchito", name: "Farina di mais (semola)", note: "arricchito", category: "Cereali e pseudocereali",
    kcal: 370, protein_g: 7.1, carbs_g: 79.5, fat_g: 1.8, fiber_g: 3.9,
    aa: { his: 172, ile: 242, leu: 1006, lys: 105, sit: 321, aaa: 553, thr: 172, trp: 38, val: 337 } },
  { id: "couscous_secco", name: "Couscous (secco)", note: "secco", category: "Cereali e pseudocereali",
    kcal: 376, protein_g: 12.8, carbs_g: 77.4, fat_g: 0.6, fiber_g: 5,
    aa: { his: 259, ile: 493, leu: 872, lys: 245, sit: 559, aaa: 955, thr: 337, trp: 163, val: 544 } },
  { id: "fagioli_dall_occhio_fresco_semi_immaturi_cotto_bollito_surge", name: "Fagioli dall'occhio (surgelati)", note: "fresco (semi immaturi), cotto, bollito, surgelato, sgocciolato", category: "Legumi",
    kcal: 131, protein_g: 8.5, carbs_g: 23.5, fat_g: 0.7, fiber_g: 6.4,
    aa: { his: 274, ile: 455, leu: 606, lys: 558, sit: 247, aaa: 814, thr: 316, trp: 98, val: 492 } },
  { id: "fagioli_dall_occhio_secco_cotto_bollito", name: "Fagioli dall'occhio (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 116, protein_g: 7.7, carbs_g: 20.8, fat_g: 0.5, fiber_g: 6.5,
    aa: { his: 240, ile: 314, leu: 592, lys: 523, sit: 195, aaa: 701, thr: 294, trp: 95, val: 368 } },
  { id: "fagioli_dall_occhio_secco_crudo", name: "Fagioli dall'occhio (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 336, protein_g: 23.5, carbs_g: 60, fat_g: 1.3, fiber_g: 10.6,
    aa: { his: 730, ile: 956, leu: 1802, lys: 1591, sit: 595, aaa: 2133, thr: 895, trp: 290, val: 1121 } },
  { id: "fagioli_catjang_secco_cotto_bollito", name: "Fagioli catjang (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 117, protein_g: 8.1, carbs_g: 20.3, fat_g: 0.7, fiber_g: 3.6,
    aa: { his: 252, ile: 330, leu: 623, lys: 550, sit: 206, aaa: 738, thr: 309, trp: 100, val: 387 } },
  { id: "fagioli_catjang_secco_crudo", name: "Fagioli catjang (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 343, protein_g: 23.9, carbs_g: 59.6, fat_g: 2.1, fiber_g: 10.7,
    aa: { his: 740, ile: 969, leu: 1828, lys: 1614, sit: 603, aaa: 2164, thr: 908, trp: 294, val: 1137 } },
  { id: "falafel", name: "Falafel", note: "", category: "Legumi",
    kcal: 333, protein_g: 13.3, carbs_g: 31.8, fat_g: 17.8, fiber_g: 0,
    aa: { his: 364, ile: 567, leu: 944, lys: 856, sit: 370, aaa: 1046, thr: 492, trp: 134, val: 562 } },
  { id: "fagioli_rossi_in_scatola", name: "Fagioli rossi (in scatola)", note: "in scatola", category: "Legumi",
    kcal: 144, protein_g: 5, carbs_g: 15.5, fat_g: 6.9, fiber_g: 4.7,
    aa: { his: 108, ile: 208, leu: 407, lys: 271, sit: 143, aaa: 449, thr: 162, trp: 49, val: 290 } },
  { id: "bacche_di_goji_secco", name: "Bacche di goji (secche)", note: "secco", category: "Frutta secca e semi",
    kcal: 349, protein_g: 14.3, carbs_g: 77.1, fat_g: 0.4, fiber_g: 13,
    aa: { his: 157, ile: 261, leu: 456, lys: 233, sit: 231, aaa: 493, thr: 358, trp: 0, val: 316 } },
  { id: "fagioli_giacinto_secco_cotto_bollito", name: "Fagioli giacinto (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 117, protein_g: 8.1, carbs_g: 20.7, fat_g: 0.6, fiber_g: 0,
    aa: { his: 233, ile: 390, leu: 691, lys: 556, sit: 160, aaa: 701, thr: 315, trp: 68, val: 422 } },
  { id: "fagioli_giacinto_secco_crudo", name: "Fagioli giacinto (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 344, protein_g: 23.9, carbs_g: 60.7, fat_g: 1.7, fiber_g: 25.6,
    aa: { his: 684, ile: 1143, leu: 2026, lys: 1632, sit: 470, aaa: 2057, thr: 925, trp: 199, val: 1239 } },
  { id: "lenticchie_rosse_crudo", name: "Lenticchie rosse (crude)", note: "crudo", category: "Legumi",
    kcal: 358, protein_g: 23.9, carbs_g: 63.1, fat_g: 2.2, fiber_g: 10.8,
    aa: { his: 702, ile: 1078, leu: 1809, lys: 1740, sit: 539, aaa: 1897, thr: 895, trp: 223, val: 1238 } },
  { id: "germogli_di_lenticchie_cotto_saltato_in_padella", name: "Germogli di lenticchie", note: "cotto (saltato in padella)", category: "Legumi",
    kcal: 101, protein_g: 8.8, carbs_g: 21.3, fat_g: 0.5, fiber_g: 0,
    aa: { his: 252, ile: 320, leu: 617, lys: 698, sit: 431, aaa: 682, thr: 322, trp: 0, val: 391 } },
  { id: "fagioli_di_lima_fresco_semi_immaturi_cotto_bollito_sgocciola", name: "Fagioli di lima (freschi)", note: "fresco (semi immaturi), cotto, bollito, sgocciolato", category: "Legumi",
    kcal: 123, protein_g: 6.8, carbs_g: 23.6, fat_g: 0.3, fiber_g: 5.3,
    aa: { his: 231, ile: 438, leu: 535, lys: 450, sit: 151, aaa: 555, thr: 289, trp: 89, val: 425 } },
  { id: "fagioli_di_lima_fresco_semi_immaturi_cotto_bollito_surgelato", name: "Fagioli di lima (surgelati)", note: "fresco (semi immaturi), cotto, bollito, surgelato, sgocciolato", category: "Legumi",
    kcal: 105, protein_g: 6.7, carbs_g: 19.5, fat_g: 0.3, fiber_g: 4.8,
    aa: { his: 226, ile: 428, leu: 522, lys: 439, sit: 147, aaa: 542, thr: 282, trp: 87, val: 415 } },
  { id: "fagioli_di_lima_secco_cotto_bollito", name: "Fagioli di lima (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 115, protein_g: 7.8, carbs_g: 20.9, fat_g: 0.4, fiber_g: 7,
    aa: { his: 238, ile: 411, leu: 673, lys: 523, sit: 185, aaa: 725, thr: 337, trp: 92, val: 469 } },
  { id: "fagioli_di_lima_secco_crudo", name: "Fagioli di lima (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 338, protein_g: 21.5, carbs_g: 63.4, fat_g: 0.7, fiber_g: 19,
    aa: { his: 656, ile: 1129, leu: 1850, lys: 1438, sit: 508, aaa: 1995, thr: 927, trp: 254, val: 1291 } },
  { id: "fagioli_di_lima_piccoli_secco_cotto_bollito", name: "Fagioli di lima (piccoli) (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 126, protein_g: 8, carbs_g: 23.3, fat_g: 0.4, fiber_g: 7.7,
    aa: { his: 246, ile: 423, leu: 694, lys: 539, sit: 191, aaa: 747, thr: 347, trp: 95, val: 484 } },
  { id: "fagioli_di_lima_piccoli_secco_crudo", name: "Fagioli di lima (piccoli) (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 335, protein_g: 20.6, carbs_g: 62.8, fat_g: 0.9, fiber_g: 20.6,
    aa: { his: 630, ile: 1085, leu: 1778, lys: 1382, sit: 489, aaa: 1917, thr: 891, trp: 244, val: 1240 } },
  { id: "lupini_secco_cotto_bollito", name: "Lupini (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 116, protein_g: 15.6, carbs_g: 9.3, fat_g: 2.9, fiber_g: 2.8,
    aa: { his: 443, ile: 695, leu: 1181, lys: 832, sit: 302, aaa: 1203, thr: 573, trp: 125, val: 650 } },
  { id: "lupini_secco_crudo", name: "Lupini (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 371, protein_g: 36.2, carbs_g: 40.4, fat_g: 9.7, fiber_g: 18.9,
    aa: { his: 1030, ile: 1615, leu: 2743, lys: 1933, sit: 701, aaa: 2795, thr: 1331, trp: 289, val: 1510 } },
  { id: "farina_di_miglio", name: "Farina di miglio", note: "", category: "Cereali e pseudocereali",
    kcal: 382, protein_g: 10.8, carbs_g: 75.1, fat_g: 4.3, fiber_g: 3.5,
    aa: { his: 257, ile: 473, leu: 1537, lys: 144, sit: 497, aaa: 1001, thr: 354, trp: 170, val: 584 } },
  { id: "miglio_crudo", name: "Miglio (crudo)", note: "crudo", category: "Cereali e pseudocereali",
    kcal: 378, protein_g: 11, carbs_g: 72.9, fat_g: 4.2, fiber_g: 8.5,
    aa: { his: 236, ile: 465, leu: 1400, lys: 212, sit: 433, aaa: 920, thr: 353, trp: 119, val: 578 } },
  { id: "miso", name: "Miso", note: "", category: "Legumi",
    kcal: 198, protein_g: 12.8, carbs_g: 25.4, fat_g: 6, fiber_g: 5.4,
    aa: { his: 243, ile: 508, leu: 820, lys: 478, sit: 129, aaa: 838, thr: 479, trp: 155, val: 547 } },
  { id: "fagioli_moth_secco_cotto_bollito", name: "Fagioli moth (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 117, protein_g: 7.8, carbs_g: 21, fat_g: 0.6, fiber_g: 0,
    aa: { his: 263, ile: 388, leu: 525, lys: 425, sit: 115, aaa: 350, thr: 0, trp: 50, val: 250 } },
  { id: "fagioli_moth_secco_crudo", name: "Fagioli moth (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 343, protein_g: 22.9, carbs_g: 61.5, fat_g: 1.6, fiber_g: 0,
    aa: { his: 771, ile: 1138, leu: 1541, lys: 1248, sit: 337, aaa: 1028, thr: 0, trp: 147, val: 734 } },
  { id: "fagioli_mungo_secco_cotto_bollito", name: "Fagioli mungo (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 105, protein_g: 7, carbs_g: 19.2, fat_g: 0.4, fiber_g: 7.6,
    aa: { his: 205, ile: 297, leu: 544, lys: 490, sit: 146, aaa: 635, thr: 230, trp: 76, val: 364 } },
  { id: "fagioli_mungo_secco_crudo", name: "Fagioli mungo (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 347, protein_g: 23.9, carbs_g: 62.6, fat_g: 1.2, fiber_g: 16.3,
    aa: { his: 695, ile: 1008, leu: 1847, lys: 1664, sit: 496, aaa: 2157, thr: 782, trp: 260, val: 1237 } },
  { id: "funghi_shiitake_secco", name: "Funghi shiitake (secchi)", note: "secco", category: "Altro",
    kcal: 296, protein_g: 9.6, carbs_g: 75.4, fat_g: 1, fiber_g: 11.5,
    aa: { his: 159, ile: 405, leu: 679, lys: 343, sit: 375, aaa: 809, thr: 497, trp: 31, val: 486 } },
  { id: "natto", name: "Natto", note: "", category: "Legumi",
    kcal: 211, protein_g: 19.4, carbs_g: 12.7, fat_g: 11, fiber_g: 5.4,
    aa: { his: 512, ile: 931, leu: 1509, lys: 1145, sit: 428, aaa: 1497, thr: 813, trp: 223, val: 1018 } },
  { id: "noodles_soba_grano_saraceno_cotto", name: "Noodles soba (grano saraceno) (cotti)", note: "cotto", category: "Farine, pane e pasta",
    kcal: 99, protein_g: 5.1, carbs_g: 21.4, fat_g: 0.1, fiber_g: 0,
    aa: { his: 119, ile: 195, leu: 330, lys: 214, sit: 166, aaa: 322, thr: 177, trp: 72, val: 249 } },
  { id: "noodles_soba_grano_saraceno_secco", name: "Noodles soba (grano saraceno) (secchi)", note: "secco", category: "Farine, pane e pasta",
    kcal: 336, protein_g: 14.4, carbs_g: 74.6, fat_g: 0.7, fiber_g: 0,
    aa: { his: 339, ile: 553, leu: 937, lys: 607, sit: 472, aaa: 916, thr: 503, trp: 204, val: 707 } },
  { id: "noodles_somen_secco", name: "Noodles somen (secchi)", note: "secco", category: "Farine, pane e pasta",
    kcal: 356, protein_g: 11.4, carbs_g: 74.1, fat_g: 0.8, fiber_g: 4.3,
    aa: { his: 230, ile: 439, leu: 776, lys: 218, sit: 497, aaa: 849, thr: 300, trp: 145, val: 484 } },
  { id: "farina_di_mais", name: "Farina di mais", note: "", category: "Frutta secca e semi",
    kcal: 501, protein_g: 7.5, carbs_g: 54.7, fat_g: 30.2, fiber_g: 0,
    aa: { his: 208, ile: 348, leu: 596, lys: 468, sit: 259, aaa: 555, thr: 288, trp: 90, val: 421 } },
  { id: "ghiande_secco", name: "Ghiande (secche)", note: "secco", category: "Frutta secca e semi",
    kcal: 509, protein_g: 8.1, carbs_g: 53.7, fat_g: 31.4, fiber_g: 0,
    aa: { his: 224, ile: 376, leu: 644, lys: 505, sit: 280, aaa: 600, thr: 312, trp: 98, val: 455 } },
  { id: "ghiande_crudo", name: "Ghiande (crude)", note: "crudo", category: "Frutta secca e semi",
    kcal: 387, protein_g: 6.2, carbs_g: 40.8, fat_g: 23.9, fiber_g: 0,
    aa: { his: 170, ile: 285, leu: 489, lys: 384, sit: 212, aaa: 456, thr: 236, trp: 74, val: 345 } },
  { id: "mandorle_spellate_spellato", name: "Mandorle spellate", note: "spellato", category: "Frutta secca e semi",
    kcal: 590, protein_g: 21.4, carbs_g: 18.7, fat_g: 52.5, fiber_g: 9.9,
    aa: { his: 596, ile: 696, leu: 1479, lys: 605, sit: 474, aaa: 1689, thr: 682, trp: 193, val: 805 } },
  { id: "mandorle_tostate_a_secco_tostato_a_secco", name: "Mandorle tostate a secco", note: "tostato a secco", category: "Frutta secca e semi",
    kcal: 598, protein_g: 21, carbs_g: 21, fat_g: 52.5, fiber_g: 10.9,
    aa: { his: 534, ile: 745, leu: 1461, lys: 563, sit: 369, aaa: 1568, thr: 595, trp: 209, val: 848 } },
  { id: "mandorle_tostate_in_olio_tostato_in_olio", name: "Mandorle tostate in olio", note: "tostato in olio", category: "Frutta secca e semi",
    kcal: 607, protein_g: 21.2, carbs_g: 17.7, fat_g: 55.2, fiber_g: 10.5,
    aa: { his: 592, ile: 691, leu: 1467, lys: 600, sit: 470, aaa: 1675, thr: 677, trp: 192, val: 798 } },
  { id: "faggiole_secco", name: "Faggiole (secche)", note: "secco", category: "Frutta secca e semi",
    kcal: 576, protein_g: 6.2, carbs_g: 33.5, fat_g: 50, fiber_g: 0,
    aa: { his: 172, ile: 245, leu: 367, lys: 367, sit: 343, aaa: 434, thr: 221, trp: 69, val: 346 } },
  { id: "noci_del_brasile_secco_spellato", name: "Noci del Brasile (secche)", note: "secco, spellato", category: "Frutta secca e semi",
    kcal: 659, protein_g: 14.3, carbs_g: 11.7, fat_g: 67.1, fiber_g: 7.5,
    aa: { his: 409, ile: 518, leu: 1190, lys: 490, sit: 1430, aaa: 1055, thr: 365, trp: 135, val: 760 } },
  { id: "castagne_secco", name: "Castagne (secche)", note: "secco", category: "Frutta secca e semi",
    kcal: 363, protein_g: 6.8, carbs_g: 79.8, fat_g: 1.8, fiber_g: 0,
    aa: { his: 197, ile: 255, leu: 421, lys: 371, sit: 344, aaa: 512, thr: 272, trp: 80, val: 358 } },
  { id: "frutta_secca_ricostituita_a_base_di_grano", name: "Frutta secca ricostituita (a base di grano)", note: "", category: "Frutta secca e semi",
    kcal: 647, protein_g: 13.1, carbs_g: 20.8, fat_g: 62.3, fiber_g: 5.2,
    aa: { his: 380, ile: 552, leu: 972, lys: 886, sit: 500, aaa: 1072, thr: 552, trp: 172, val: 712 } },
  { id: "semi_di_ginkgo_secco", name: "Semi di ginkgo (secchi)", note: "secco", category: "Frutta secca e semi",
    kcal: 348, protein_g: 10.4, carbs_g: 72.5, fat_g: 2, fiber_g: 0,
    aa: { his: 244, ile: 500, leu: 755, lys: 494, sit: 188, aaa: 554, thr: 640, trp: 170, val: 677 } },
  { id: "nocciole", name: "Nocciole", note: "", category: "Frutta secca e semi",
    kcal: 628, protein_g: 15, carbs_g: 16.7, fat_g: 60.8, fiber_g: 9.7,
    aa: { his: 432, ile: 545, leu: 1063, lys: 420, sit: 498, aaa: 1025, thr: 497, trp: 193, val: 701 } },
  { id: "noci_di_hickory_secco", name: "Noci di hickory (secche)", note: "secco", category: "Frutta secca e semi",
    kcal: 657, protein_g: 12.7, carbs_g: 18.3, fat_g: 64.4, fiber_g: 6.4,
    aa: { his: 389, ile: 576, leu: 1027, lys: 497, sit: 571, aaa: 1167, thr: 422, trp: 139, val: 730 } },
  { id: "noci_pili_secco", name: "Noci pili (secche)", note: "secco", category: "Frutta secca e semi",
    kcal: 719, protein_g: 10.8, carbs_g: 4, fat_g: 79.6, fiber_g: 0,
    aa: { his: 255, ile: 483, leu: 890, lys: 369, sit: 584, aaa: 878, thr: 407, trp: 189, val: 701 } },
  { id: "noci_nere_secco", name: "Noci nere (secche)", note: "secco", category: "Frutta secca e semi",
    kcal: 619, protein_g: 24.1, carbs_g: 9.6, fat_g: 59.3, fiber_g: 6.8,
    aa: { his: 672, ile: 966, leu: 1684, lys: 713, sit: 929, aaa: 1834, thr: 721, trp: 318, val: 1271 } },
  { id: "crusca_d_avena_crudo", name: "Crusca d'avena (cruda)", note: "crudo", category: "Cereali e pseudocereali",
    kcal: 246, protein_g: 17.3, carbs_g: 66.2, fat_g: 7, fiber_g: 15.4,
    aa: { his: 410, ile: 668, leu: 1374, lys: 760, sit: 911, aaa: 1576, thr: 502, trp: 335, val: 964 } },
  { id: "papad_cracker_di_legumi", name: "Papad (cracker di legumi)", note: "", category: "Legumi",
    kcal: 371, protein_g: 25.6, carbs_g: 59.9, fat_g: 3.3, fiber_g: 18.6,
    aa: { his: 715, ile: 1303, leu: 2115, lys: 1695, sit: 609, aaa: 2284, thr: 886, trp: 266, val: 1434 } },
  { id: "pasta_fresca", name: "Pasta fresca", note: "", category: "Farine, pane e pasta",
    kcal: 288, protein_g: 11.3, carbs_g: 54.7, fat_g: 2.3, fiber_g: 0,
    aa: { his: 226, ile: 431, leu: 763, lys: 214, sit: 489, aaa: 835, thr: 295, trp: 143, val: 476 } },
  { id: "pasta_fresca_agli_spinaci", name: "Pasta fresca agli spinaci", note: "", category: "Farine, pane e pasta",
    kcal: 289, protein_g: 11.3, carbs_g: 55.7, fat_g: 2.1, fiber_g: 0,
    aa: { his: 237, ile: 488, leu: 813, lys: 336, sit: 505, aaa: 892, thr: 352, trp: 150, val: 544 } },
  { id: "pasta_senza_glutine_di_mais_secco", name: "Pasta senza glutine di mais (secca)", note: "secco", category: "Farine, pane e pasta",
    kcal: 357, protein_g: 7.5, carbs_g: 79.3, fat_g: 2.1, fiber_g: 11,
    aa: { his: 228, ile: 267, leu: 915, lys: 210, sit: 290, aaa: 669, thr: 280, trp: 53, val: 378 } },
  { id: "farina_di_arachidi", name: "Farina di arachidi", note: "", category: "Legumi",
    kcal: 327, protein_g: 52.2, carbs_g: 34.7, fat_g: 0.6, fiber_g: 15.8,
    aa: { his: 1319, ile: 1836, leu: 3384, lys: 1874, sit: 1310, aaa: 4827, thr: 1788, trp: 507, val: 2189 } },
  { id: "piselli_cotto_bollito_sgocciolato", name: "Piselli (cotti)", note: "cotto, bollito, sgocciolato", category: "Legumi",
    kcal: 84, protein_g: 5.4, carbs_g: 15.6, fat_g: 0.2, fiber_g: 5.5,
    aa: { his: 105, ile: 193, leu: 320, lys: 314, sit: 113, aaa: 310, thr: 201, trp: 37, val: 232 } },
  { id: "piselli_cotto_bollito_surgelato_sgocciolato", name: "Piselli (surgelati)", note: "cotto, bollito, surgelato, sgocciolato", category: "Legumi",
    kcal: 78, protein_g: 5.2, carbs_g: 14.3, fat_g: 0.3, fiber_g: 4.5,
    aa: { his: 101, ile: 185, leu: 307, lys: 302, sit: 108, aaa: 298, thr: 193, trp: 35, val: 223 } },
  { id: "piselli_crudo", name: "Piselli (crudi)", note: "crudo", category: "Legumi",
    kcal: 81, protein_g: 5.4, carbs_g: 14.5, fat_g: 0.4, fiber_g: 5.7,
    aa: { his: 107, ile: 195, leu: 323, lys: 317, sit: 114, aaa: 314, thr: 203, trp: 37, val: 235 } },
  { id: "germogli_di_piselli_germogliato_cotto_bollito_sgocciolato", name: "Germogli di piselli", note: "germogliato, cotto, bollito, sgocciolato", category: "Legumi",
    kcal: 98, protein_g: 7.1, carbs_g: 17.1, fat_g: 0.5, fiber_g: 0,
    aa: { his: 217, ile: 221, leu: 473, lys: 497, sit: 289, aaa: 489, thr: 240, trp: 0, val: 285 } },
  { id: "piselli_d_angola_secco_cotto_bollito", name: "Piselli d'Angola (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 121, protein_g: 6.8, carbs_g: 23.3, fat_g: 0.4, fiber_g: 6.7,
    aa: { his: 241, ile: 245, leu: 483, lys: 474, sit: 154, aaa: 747, thr: 239, trp: 66, val: 292 } },
  { id: "piselli_d_angola_secco_crudo", name: "Piselli d'Angola (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 343, protein_g: 21.7, carbs_g: 62.8, fat_g: 1.5, fiber_g: 15,
    aa: { his: 774, ile: 785, leu: 1549, lys: 1521, sit: 493, aaa: 2396, thr: 767, trp: 212, val: 937 } },
  { id: "farina_di_patate", name: "Farina di patate", note: "", category: "Farine, pane e pasta",
    kcal: 357, protein_g: 6.9, carbs_g: 83.1, fat_g: 0.3, fiber_g: 5.9,
    aa: { his: 166, ile: 299, leu: 425, lys: 413, sit: 177, aaa: 540, thr: 280, trp: 115, val: 356 } },
  { id: "fagioli_rifritti_in_scatola", name: "Fagioli rifritti", note: "in scatola", category: "Legumi",
    kcal: 90, protein_g: 5, carbs_g: 13.6, fat_g: 2, fiber_g: 3.7,
    aa: { his: 153, ile: 242, leu: 438, lys: 377, sit: 143, aaa: 452, thr: 231, trp: 65, val: 287 } },
  { id: "crusca_di_riso", name: "Crusca di riso", note: "", category: "Cereali e pseudocereali",
    kcal: 316, protein_g: 13.4, carbs_g: 49.7, fat_g: 20.9, fiber_g: 21,
    aa: { his: 355, ile: 568, leu: 1022, lys: 650, sit: 623, aaa: 1046, thr: 555, trp: 108, val: 881 } },
  { id: "farina_di_riso_integrale", name: "Farina di riso integrale", note: "", category: "Cereali e pseudocereali",
    kcal: 363, protein_g: 7.2, carbs_g: 76.5, fat_g: 2.8, fiber_g: 4.6,
    aa: { his: 184, ile: 306, leu: 598, lys: 276, sit: 251, aaa: 644, thr: 265, trp: 92, val: 424 } },
  { id: "farina_di_riso_bianco", name: "Farina di riso bianco", note: "", category: "Cereali e pseudocereali",
    kcal: 366, protein_g: 6, carbs_g: 80.1, fat_g: 1.4, fiber_g: 2.4,
    aa: { his: 149, ile: 244, leu: 488, lys: 207, sit: 251, aaa: 631, thr: 210, trp: 72, val: 348 } },
  { id: "riso_glutinoso_crudo", name: "Riso glutinoso (crudo)", note: "crudo", category: "Cereali e pseudocereali",
    kcal: 370, protein_g: 6.8, carbs_g: 81.7, fat_g: 0.6, fiber_g: 2.8,
    aa: { his: 160, ile: 294, leu: 563, lys: 246, sit: 300, aaa: 592, thr: 244, trp: 79, val: 416 } },
  { id: "farina_di_segale_integrale", name: "Farina di segale integrale", note: "", category: "Cereali e pseudocereali",
    kcal: 325, protein_g: 15.9, carbs_g: 68.6, fat_g: 2.2, fiber_g: 23.8,
    aa: { his: 233, ile: 353, leu: 857, lys: 338, sit: 199, aaa: 917, thr: 490, trp: 180, val: 498 } },
  { id: "farina_di_segale_bianca", name: "Farina di segale bianca", note: "", category: "Cereali e pseudocereali",
    kcal: 357, protein_g: 9.8, carbs_g: 76.7, fat_g: 1.3, fiber_g: 8,
    aa: { his: 147, ile: 235, leu: 556, lys: 210, sit: 113, aaa: 644, thr: 278, trp: 111, val: 323 } },
  { id: "farina_di_segale_semi_integrale", name: "Farina di segale semi-integrale", note: "", category: "Cereali e pseudocereali",
    kcal: 349, protein_g: 10.9, carbs_g: 75.4, fat_g: 1.5, fiber_g: 11.8,
    aa: { his: 159, ile: 253, leu: 611, lys: 212, sit: 136, aaa: 671, thr: 341, trp: 123, val: 348 } },
  { id: "segale_chicco", name: "Segale (chicco)", note: "", category: "Cereali e pseudocereali",
    kcal: 338, protein_g: 10.3, carbs_g: 75.9, fat_g: 1.6, fiber_g: 15.1,
    aa: { his: 189, ile: 208, leu: 563, lys: 286, sit: 153, aaa: 635, thr: 289, trp: 108, val: 317 } },
  { id: "alga_nori_crudo", name: "Alga nori (cruda)", note: "crudo", category: "Altro",
    kcal: 35, protein_g: 5.8, carbs_g: 5.1, fat_g: 0.3, fiber_g: 0.3,
    aa: { his: 140, ile: 259, leu: 501, lys: 222, sit: 245, aaa: 527, thr: 232, trp: 43, val: 402 } },
  { id: "spirulina_secco", name: "Spirulina (secca)", note: "secco", category: "Altro",
    kcal: 290, protein_g: 57.5, carbs_g: 23.9, fat_g: 7.7, fiber_g: 3.6,
    aa: { his: 1085, ile: 3209, leu: 4947, lys: 3025, sit: 1811, aaa: 5361, thr: 2970, trp: 929, val: 3512 } },
  { id: "semi_di_albero_del_pane", name: "Semi di albero del pane", note: "", category: "Frutta secca e semi",
    kcal: 168, protein_g: 5.3, carbs_g: 32, fat_g: 2.3, fiber_g: 4.8,
    aa: { his: 148, ile: 317, leu: 403, lys: 408, sit: 152, aaa: 961, thr: 276, trp: 88, val: 383 } },
  { id: "semi_di_albero_del_pane_crudo", name: "Semi di albero del pane (crudi)", note: "crudo", category: "Frutta secca e semi",
    kcal: 191, protein_g: 7.4, carbs_g: 29.2, fat_g: 5.6, fiber_g: 5.2,
    aa: { his: 207, ile: 443, leu: 563, lys: 570, sit: 212, aaa: 1341, thr: 385, trp: 123, val: 535 } },
  { id: "semi_di_breadnut_secco", name: "Semi di breadnut (secchi)", note: "secco", category: "Frutta secca e semi",
    kcal: 367, protein_g: 8.6, carbs_g: 79.4, fat_g: 1.7, fiber_g: 14.9,
    aa: { his: 132, ile: 488, leu: 935, lys: 376, sit: 185, aaa: 1041, thr: 335, trp: 234, val: 834 } },
  { id: "semi_di_breadnut_crudo", name: "Semi di breadnut (crudi)", note: "crudo", category: "Frutta secca e semi",
    kcal: 217, protein_g: 6, carbs_g: 46.3, fat_g: 1, fiber_g: 0,
    aa: { his: 91, ile: 338, leu: 647, lys: 260, sit: 128, aaa: 721, thr: 232, trp: 162, val: 578 } },
  { id: "semi_di_cotone", name: "Semi di cotone", note: "", category: "Frutta secca e semi",
    kcal: 332, protein_g: 49.8, carbs_g: 36.1, fat_g: 1.4, fiber_g: 0,
    aa: { his: 1570, ile: 1796, leu: 3404, lys: 2529, sit: 2116, aaa: 4899, thr: 1843, trp: 752, val: 2557 } },
  { id: "semi_di_cotone_tostato", name: "Semi di cotone (tostati)", note: "tostato", category: "Frutta secca e semi",
    kcal: 506, protein_g: 32.6, carbs_g: 21.9, fat_g: 36.3, fiber_g: 5.5,
    aa: { his: 1027, ile: 1174, leu: 2226, lys: 1654, sit: 1384, aaa: 3203, thr: 1205, trp: 492, val: 1672 } },
  { id: "semi_di_loto_secco", name: "Semi di loto (secchi)", note: "secco", category: "Frutta secca e semi",
    kcal: 332, protein_g: 15.4, carbs_g: 64.5, fat_g: 2, fiber_g: 0,
    aa: { his: 430, ile: 765, leu: 1215, lys: 985, sit: 468, aaa: 1142, thr: 747, trp: 221, val: 991 } },
  { id: "semi_di_cartamo_secco", name: "Semi di cartamo (secchi)", note: "secco", category: "Frutta secca e semi",
    kcal: 517, protein_g: 16.2, carbs_g: 34.3, fat_g: 38.5, fiber_g: 0,
    aa: { his: 452, ile: 717, leu: 1154, lys: 534, sit: 595, aaa: 1337, thr: 586, trp: 183, val: 1025 } },
  { id: "semi_di_cartamo", name: "Semi di cartamo", note: "", category: "Frutta secca e semi",
    kcal: 342, protein_g: 35.6, carbs_g: 48.7, fat_g: 2.4, fiber_g: 0,
    aa: { his: 995, ile: 1579, leu: 2540, lys: 1176, sit: 1310, aaa: 2943, thr: 1290, trp: 403, val: 2258 } },
  { id: "sesamo", name: "Farina di sesamo", note: "", category: "Frutta secca e semi",
    kcal: 526, protein_g: 30.8, carbs_g: 26.6, fat_g: 37.1, fiber_g: 0,
    aa: { his: 906, ile: 1324, leu: 2358, lys: 987, sit: 1637, aaa: 2921, thr: 1278, trp: 674, val: 1719 } },
  { id: "sesamo_secco", name: "Sesamo (secco)", note: "secco", category: "Frutta secca e semi",
    kcal: 631, protein_g: 20.5, carbs_g: 11.7, fat_g: 61.2, fiber_g: 11.6,
    aa: { his: 550, ile: 750, leu: 1500, lys: 650, sit: 1320, aaa: 1730, thr: 730, trp: 330, val: 980 } },
  { id: "semi_di_sisymbrium_secco", name: "Semi di sisymbrium (secchi)", note: "secco", category: "Frutta secca e semi",
    kcal: 318, protein_g: 12.1, carbs_g: 58.3, fat_g: 4.6, fiber_g: 0,
    aa: { his: 325, ile: 650, leu: 1234, lys: 806, sit: 556, aaa: 1003, thr: 689, trp: 266, val: 705 } },
  { id: "semi_di_girasole", name: "Farina di semi di girasole", note: "", category: "Frutta secca e semi",
    kcal: 326, protein_g: 48.1, carbs_g: 35.8, fat_g: 1.6, fiber_g: 5.2,
    aa: { his: 1333, ile: 2403, leu: 3500, lys: 1977, sit: 1995, aaa: 3872, thr: 1959, trp: 735, val: 2775 } },
  { id: "semi_di_girasole_secco", name: "Semi di girasole (secchi)", note: "secco", category: "Frutta secca e semi",
    kcal: 584, protein_g: 20.8, carbs_g: 20, fat_g: 51.5, fiber_g: 8.6,
    aa: { his: 632, ile: 1139, leu: 1659, lys: 937, sit: 945, aaa: 1835, thr: 928, trp: 348, val: 1315 } },
  { id: "semi_di_girasole_tostato_a_secco", name: "Semi di girasole (tostati)", note: "tostato a secco", category: "Frutta secca e semi",
    kcal: 582, protein_g: 19.3, carbs_g: 24.1, fat_g: 49.8, fiber_g: 9,
    aa: { his: 536, ile: 967, leu: 1408, lys: 795, sit: 803, aaa: 1557, thr: 788, trp: 295, val: 1116 } },
  { id: "semi_di_anguria_secco", name: "Semi di anguria (secchi)", note: "secco", category: "Frutta secca e semi",
    kcal: 557, protein_g: 28.3, carbs_g: 15.3, fat_g: 47.4, fiber_g: 0,
    aa: { his: 775, ile: 1342, leu: 2149, lys: 887, sit: 1272, aaa: 3047, thr: 1112, trp: 390, val: 1556 } },
  { id: "semola_arricchito", name: "Semola", note: "arricchito", category: "Cereali e pseudocereali",
    kcal: 360, protein_g: 12.7, carbs_g: 72.8, fat_g: 1.1, fiber_g: 3.9,
    aa: { his: 257, ile: 490, leu: 867, lys: 243, sit: 556, aaa: 949, thr: 335, trp: 162, val: 540 } },
  { id: "farina_di_sorgo", name: "Farina di sorgo", note: "", category: "Cereali e pseudocereali",
    kcal: 359, protein_g: 8.4, carbs_g: 76.6, fat_g: 3.3, fiber_g: 6.6,
    aa: { his: 167, ile: 309, leu: 1085, lys: 174, sit: 310, aaa: 666, thr: 312, trp: 106, val: 387 } },
  { id: "sorgo_chicco", name: "Sorgo (chicco)", note: "", category: "Cereali e pseudocereali",
    kcal: 329, protein_g: 10.6, carbs_g: 72.1, fat_g: 3.5, fiber_g: 6.7,
    aa: { his: 246, ile: 433, leu: 1491, lys: 229, sit: 296, aaa: 867, thr: 346, trp: 124, val: 561 } },
  { id: "farina_di_soia", name: "Farina di soia", note: "", category: "Legumi",
    kcal: 327, protein_g: 51.5, carbs_g: 33.9, fat_g: 1.2, fiber_g: 17.5,
    aa: { his: 1268, ile: 2281, leu: 3828, lys: 3129, sit: 1391, aaa: 4231, thr: 2042, trp: 683, val: 2346 } },
  { id: "farina_di_soia_crudo", name: "Farina di soia (cruda)", note: "crudo", category: "Legumi",
    kcal: 434, protein_g: 37.8, carbs_g: 31.9, fat_g: 20.7, fiber_g: 9.6,
    aa: { his: 931, ile: 1675, leu: 2812, lys: 2298, sit: 1022, aaa: 3108, thr: 1500, trp: 502, val: 1724 } },
  { id: "farina_di_soia_panello_crudo", name: "Farina di soia (panello) (cruda)", note: "crudo", category: "Legumi",
    kcal: 337, protein_g: 49.2, carbs_g: 35.9, fat_g: 2.4, fiber_g: 0,
    aa: { his: 1212, ile: 2180, leu: 3660, lys: 2991, sit: 1330, aaa: 4046, thr: 1952, trp: 653, val: 2243 } },
  { id: "concentrato_proteico_di_soia", name: "Concentrato proteico di soia", note: "", category: "Legumi",
    kcal: 328, protein_g: 63.6, carbs_g: 25.4, fat_g: 0.5, fiber_g: 5.5,
    aa: { his: 1578, ile: 2942, leu: 4917, lys: 3929, sit: 1700, aaa: 5579, thr: 2474, trp: 835, val: 3064 } },
  { id: "isolato_proteico_di_soia", name: "Isolato proteico di soia", note: "", category: "Legumi",
    kcal: 335, protein_g: 88.3, carbs_g: 0, fat_g: 3.4, fiber_g: 0,
    aa: { his: 2303, ile: 4253, leu: 6783, lys: 5327, sit: 2176, aaa: 7815, thr: 3137, trp: 1116, val: 4098 } },
  { id: "salsa_di_soia_tamari", name: "Salsa di soia (tamari)", note: "", category: "Legumi",
    kcal: 60, protein_g: 10.5, carbs_g: 5.6, fat_g: 0.1, fiber_g: 0.8,
    aa: { his: 215, ile: 487, leu: 735, lys: 731, sit: 274, aaa: 876, thr: 407, trp: 181, val: 524 } },
  { id: "salsa_di_soia_shoyu", name: "Salsa di soia (shoyu)", note: "", category: "Legumi",
    kcal: 53, protein_g: 8.1, carbs_g: 4.9, fat_g: 0.6, fiber_g: 0.8,
    aa: { his: 174, ile: 318, leu: 537, lys: 381, sit: 215, aaa: 597, thr: 271, trp: 96, val: 332 } },
  { id: "semi_di_soia_verdi_edamame_cotto_bollito_sgocciolato", name: "Semi di soia verdi (edamame) (cotti)", note: "cotto, bollito, sgocciolato", category: "Legumi",
    kcal: 141, protein_g: 12.4, carbs_g: 11.1, fat_g: 6.4, fiber_g: 4.2,
    aa: { his: 332, ile: 543, leu: 883, lys: 739, sit: 263, aaa: 1002, thr: 492, trp: 150, val: 549 } },
  { id: "semi_di_soia_verdi_edamame_crudo", name: "Semi di soia verdi (edamame) (crudi)", note: "crudo", category: "Legumi",
    kcal: 147, protein_g: 13, carbs_g: 11.1, fat_g: 6.8, fiber_g: 4.2,
    aa: { his: 348, ile: 570, leu: 926, lys: 775, sit: 275, aaa: 1050, thr: 516, trp: 157, val: 576 } },
  { id: "germogli_di_soia_germogliato_cotto_al_vapore", name: "Germogli di soia", note: "germogliato, cotto al vapore", category: "Legumi",
    kcal: 81, protein_g: 8.5, carbs_g: 6.5, fat_g: 4.5, fiber_g: 0.8,
    aa: { his: 225, ile: 375, leu: 607, lys: 486, sit: 191, aaa: 724, thr: 325, trp: 103, val: 401 } },
  { id: "spaghetti_proteici_cotto_arricchito", name: "Spaghetti proteici (cotti)", note: "cotto, arricchito", category: "Farine, pane e pasta",
    kcal: 164, protein_g: 8.9, carbs_g: 30.9, fat_g: 0.2, fiber_g: 2,
    aa: { his: 169, ile: 319, leu: 557, lys: 191, sit: 349, aaa: 611, thr: 228, trp: 103, val: 354 } },
  { id: "spaghetti_proteici_secco_arricchito", name: "Spaghetti proteici (secchi)", note: "secco, arricchito", category: "Farine, pane e pasta",
    kcal: 374, protein_g: 21.8, carbs_g: 65.7, fat_g: 2.2, fiber_g: 2.4,
    aa: { his: 415, ile: 784, leu: 1369, lys: 470, sit: 857, aaa: 1502, thr: 561, trp: 254, val: 871 } },
  { id: "spaghetti_agli_spinaci_secco", name: "Spaghetti agli spinaci (secchi)", note: "secco", category: "Farine, pane e pasta",
    kcal: 372, protein_g: 13.4, carbs_g: 74.8, fat_g: 1.6, fiber_g: 10.6,
    aa: { his: 271, ile: 516, leu: 911, lys: 273, sit: 577, aaa: 997, thr: 360, trp: 170, val: 572 } },
  { id: "farro_spelta_crudo", name: "Farro (spelta) (crudo)", note: "crudo", category: "Cereali e pseudocereali",
    kcal: 338, protein_g: 14.6, carbs_g: 70.2, fat_g: 2.4, fiber_g: 10.7,
    aa: { his: 360, ile: 552, leu: 1070, lys: 409, sit: 588, aaa: 1114, thr: 443, trp: 132, val: 681 } },
  { id: "teff_crudo", name: "Teff (crudo)", note: "crudo", category: "Cereali e pseudocereali",
    kcal: 367, protein_g: 13.3, carbs_g: 73.1, fat_g: 2.4, fiber_g: 8,
    aa: { his: 301, ile: 501, leu: 1068, lys: 376, sit: 664, aaa: 1156, thr: 510, trp: 139, val: 686 } },
  { id: "tofu_essiccato_koyadofu_secco_surgelato", name: "Tofu essiccato (koyadofu)", note: "secco, surgelato", category: "Legumi",
    kcal: 477, protein_g: 52.5, carbs_g: 10, fat_g: 30.3, fiber_g: 7.2,
    aa: { his: 1394, ile: 2376, leu: 3644, lys: 3157, sit: 1276, aaa: 3938, thr: 1956, trp: 747, val: 2418 } },
  { id: "tofu_extra_sodo", name: "Tofu extra sodo", note: "", category: "Legumi",
    kcal: 83, protein_g: 10, carbs_g: 1.2, fat_g: 5.3, fiber_g: 1,
    aa: { his: 249, ile: 490, leu: 804, lys: 510, sit: 155, aaa: 887, thr: 453, trp: 135, val: 503 } },
  { id: "tofu_sodo", name: "Tofu sodo", note: "", category: "Legumi",
    kcal: 78, protein_g: 9, carbs_g: 2.9, fat_g: 4.2, fiber_g: 0.9,
    aa: { his: 225, ile: 444, leu: 728, lys: 462, sit: 140, aaa: 804, thr: 411, trp: 123, val: 455 } },
  { id: "tofu_fritto", name: "Tofu fritto", note: "", category: "Legumi",
    kcal: 270, protein_g: 18.8, carbs_g: 8.9, fat_g: 20.2, fiber_g: 3.9,
    aa: { his: 499, ile: 852, leu: 1306, lys: 1131, sit: 458, aaa: 1412, thr: 701, trp: 268, val: 867 } },
  { id: "tofu_duro", name: "Tofu duro", note: "", category: "Legumi",
    kcal: 145, protein_g: 12.7, carbs_g: 4.4, fat_g: 10, fiber_g: 0.6,
    aa: { his: 346, ile: 682, leu: 1118, lys: 709, sit: 215, aaa: 1234, thr: 630, trp: 188, val: 699 } },
  { id: "tofu_fermentato_fuyu", name: "Tofu fermentato (fuyu)", note: "", category: "Legumi",
    kcal: 116, protein_g: 8.9, carbs_g: 4.4, fat_g: 8, fiber_g: 0,
    aa: { his: 237, ile: 404, leu: 619, lys: 537, sit: 217, aaa: 670, thr: 332, trp: 127, val: 411 } },
  { id: "tofu_morbido", name: "Tofu morbido", note: "", category: "Legumi",
    kcal: 61, protein_g: 7.2, carbs_g: 1.2, fat_g: 3.7, fiber_g: 0.2,
    aa: { his: 191, ile: 324, leu: 498, lys: 431, sit: 175, aaa: 538, thr: 268, trp: 102, val: 331 } },
  { id: "pomodori_secchi_secco", name: "Pomodori secchi", note: "secco", category: "Altro",
    kcal: 258, protein_g: 14.1, carbs_g: 55.8, fat_g: 3, fiber_g: 12.3,
    aa: { his: 214, ile: 339, leu: 517, lys: 519, sit: 305, aaa: 608, thr: 357, trp: 104, val: 361 } },
  { id: "triticale", name: "Triticale", note: "", category: "Cereali e pseudocereali",
    kcal: 336, protein_g: 13.1, carbs_g: 72.1, fat_g: 2.1, fiber_g: 0,
    aa: { his: 311, ile: 479, leu: 911, lys: 365, sit: 479, aaa: 1021, thr: 405, trp: 157, val: 609 } },
  { id: "crusca_di_grano", name: "Crusca di grano", note: "", category: "Cereali e pseudocereali",
    kcal: 216, protein_g: 15.6, carbs_g: 64.5, fat_g: 4.3, fiber_g: 42.8,
    aa: { his: 430, ile: 486, leu: 928, lys: 600, sit: 605, aaa: 1031, thr: 500, trp: 282, val: 726 } },
  { id: "farina_di_grano_uso_industriale_arricchito", name: "Farina di grano (uso industriale) (9.7% proteine)", note: "arricchito", category: "Cereali e pseudocereali",
    kcal: 366, protein_g: 9.7, carbs_g: 76.2, fat_g: 1.5, fiber_g: 2.4,
    aa: { his: 197, ile: 327, leu: 627, lys: 260, sit: 393, aaa: 526, thr: 264, trp: 113, val: 390 } },
  { id: "farina_di_grano_tipo_00_arricchito", name: "Farina di grano tipo 00", note: "arricchito", category: "Cereali e pseudocereali",
    kcal: 364, protein_g: 10.3, carbs_g: 76.3, fat_g: 1, fiber_g: 2.7,
    aa: { his: 230, ile: 357, leu: 710, lys: 228, sit: 402, aaa: 832, thr: 281, trp: 127, val: 415 } },
  { id: "farina_di_grano_per_pane_arricchito", name: "Farina di grano per pane", note: "arricchito", category: "Cereali e pseudocereali",
    kcal: 361, protein_g: 12, carbs_g: 72.5, fat_g: 1.7, fiber_g: 2.4,
    aa: { his: 254, ile: 444, leu: 828, lys: 231, sit: 479, aaa: 919, thr: 320, trp: 139, val: 502 } },
  { id: "farina_di_grano_per_dolci_arricchito", name: "Farina di grano per dolci", note: "arricchito", category: "Cereali e pseudocereali",
    kcal: 362, protein_g: 8.2, carbs_g: 78, fat_g: 0.9, fiber_g: 1.7,
    aa: { his: 167, ile: 311, leu: 558, lys: 285, sit: 316, aaa: 622, thr: 227, trp: 118, val: 360 } },
  { id: "farina_di_grano_per_tortillas_arricchito", name: "Farina di grano per tortillas", note: "arricchito", category: "Cereali e pseudocereali",
    kcal: 405, protein_g: 9.7, carbs_g: 67.1, fat_g: 10.6, fiber_g: 0,
    aa: { his: 215, ile: 334, leu: 664, lys: 213, sit: 376, aaa: 777, thr: 263, trp: 119, val: 388 } },
  { id: "farina_di_grano_integrale", name: "Farina di grano integrale", note: "", category: "Cereali e pseudocereali",
    kcal: 340, protein_g: 13.2, carbs_g: 72, fat_g: 2.5, fiber_g: 10.7,
    aa: { his: 357, ile: 443, leu: 898, lys: 359, sit: 503, aaa: 957, thr: 367, trp: 174, val: 564 } },
  { id: "germe_di_grano", name: "Germe di grano", note: "", category: "Cereali e pseudocereali",
    kcal: 360, protein_g: 23.2, carbs_g: 51.8, fat_g: 9.7, fiber_g: 13.2,
    aa: { his: 643, ile: 847, leu: 1571, lys: 1468, sit: 914, aaa: 1632, thr: 968, trp: 317, val: 1198 } },
  { id: "grano_duro", name: "Grano duro", note: "", category: "Cereali e pseudocereali",
    kcal: 339, protein_g: 13.7, carbs_g: 71.1, fat_g: 2.5, fiber_g: 0,
    aa: { his: 322, ile: 533, leu: 934, lys: 303, sit: 507, aaa: 1038, thr: 366, trp: 176, val: 594 } },
  { id: "grano_tenero_rosso", name: "Grano tenero rosso", note: "", category: "Cereali e pseudocereali",
    kcal: 329, protein_g: 15.4, carbs_g: 68, fat_g: 1.9, fiber_g: 12.2,
    aa: { his: 330, ile: 541, leu: 1038, lys: 404, sit: 634, aaa: 1165, thr: 433, trp: 195, val: 679 } },
  { id: "grano_khorasan_kamut_cotto", name: "Grano khorasan (Kamut) (cotto)", note: "cotto", category: "Cereali e pseudocereali",
    kcal: 132, protein_g: 5.7, carbs_g: 27.6, fat_g: 0.8, fiber_g: 4.3,
    aa: { his: 147, ile: 220, leu: 432, lys: 161, sit: 217, aaa: 437, thr: 172, trp: 51, val: 267 } },
  { id: "grano_khorasan_kamut_crudo", name: "Grano khorasan (Kamut) (crudo)", note: "crudo", category: "Cereali e pseudocereali",
    kcal: 337, protein_g: 14.5, carbs_g: 70.6, fat_g: 2.1, fiber_g: 11.1,
    aa: { his: 379, ile: 566, leu: 1112, lys: 416, sit: 560, aaa: 1124, thr: 442, trp: 130, val: 687 } },
  { id: "grano_tenero", name: "Grano tenero", note: "", category: "Cereali e pseudocereali",
    kcal: 331, protein_g: 10.4, carbs_g: 74.2, fat_g: 1.6, fiber_g: 12.5,
    aa: { his: 256, ile: 396, leu: 763, lys: 315, sit: 474, aaa: 835, thr: 342, trp: 0, val: 498 } },
  { id: "grano_germogliato", name: "Grano germogliato", note: "", category: "Cereali e pseudocereali",
    kcal: 198, protein_g: 7.5, carbs_g: 42.5, fat_g: 1.3, fiber_g: 1.1,
    aa: { his: 196, ile: 287, leu: 507, lys: 245, sit: 250, aaa: 625, thr: 254, trp: 115, val: 361 } },
  { id: "riso_selvatico_crudo", name: "Riso selvatico (crudo)", note: "crudo", category: "Cereali e pseudocereali",
    kcal: 357, protein_g: 14.7, carbs_g: 74.9, fat_g: 1.1, fiber_g: 6.2,
    aa: { his: 384, ile: 618, leu: 1018, lys: 629, sit: 612, aaa: 1343, thr: 469, trp: 179, val: 858 } },
  { id: "fagioli_alati_crudo", name: "Fagioli alati (crudi)", note: "crudo", category: "Legumi",
    kcal: 74, protein_g: 5.9, carbs_g: 14.1, fat_g: 1.1, fiber_g: 0,
    aa: { his: 82, ile: 204, leu: 359, lys: 228, sit: 139, aaa: 314, thr: 182, trp: 116, val: 245 } },
  { id: "fagioli_alati_secco_cotto_bollito", name: "Fagioli alati (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 147, protein_g: 10.6, carbs_g: 14.9, fat_g: 5.8, fiber_g: 0,
    aa: { his: 241, ile: 448, leu: 762, lys: 652, sit: 275, aaa: 881, thr: 360, trp: 233, val: 467 } },
  { id: "fagioli_alati_secco_crudo", name: "Fagioli alati (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 409, protein_g: 29.7, carbs_g: 41.7, fat_g: 16.3, fiber_g: 25.9,
    aa: { his: 790, ile: 1468, leu: 2497, lys: 2136, sit: 901, aaa: 2886, thr: 1179, trp: 762, val: 1530 } },
  { id: "fagioli_lunghi_secco_cotto_bollito", name: "Fagioli lunghi (cotti)", note: "secco, cotto, bollito", category: "Legumi",
    kcal: 118, protein_g: 8.3, carbs_g: 21.1, fat_g: 0.5, fiber_g: 3.8,
    aa: { his: 257, ile: 337, leu: 635, lys: 561, sit: 209, aaa: 752, thr: 316, trp: 102, val: 395 } },
  { id: "fagioli_lunghi_secco_crudo", name: "Fagioli lunghi (secchi)", note: "secco, crudo", category: "Legumi",
    kcal: 347, protein_g: 24.3, carbs_g: 61.9, fat_g: 1.3, fiber_g: 11,
    aa: { his: 755, ile: 989, leu: 1864, lys: 1646, sit: 615, aaa: 2207, thr: 926, trp: 300, val: 1160 } },
];;;;;;
const FOOD_MAP = Object.fromEntries(FOODS.map((f) => [f.id, f]));

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
const AMAZON_ASSOCIATE_TAG = "vegamino-21"; // <-- sostituisci con il tuo tag reale
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
   REGISTRO RICERCHE SENZA RISULTATI (demo con storage persistente)
   In produzione questo corrisponde a un piccolo backend/DB (es. una
   tabella Supabase con inserimento pubblico e lettura riservata).
--------------------------------------------------------- */
const MISS_LOG_KEY = "vegamino:search-misses";

async function logSearchMiss(term) {
  const clean = term.trim().toLowerCase();
  if (!clean) return;
  try {
    let entries = [];
    try {
      const res = await window.storage.get(MISS_LOG_KEY, true);
      entries = res ? JSON.parse(res.value) : [];
    } catch (e) {
      entries = [];
    }
    const idx = entries.findIndex((e) => e.term === clean);
    if (idx >= 0) {
      entries[idx].count += 1;
      entries[idx].lastSeen = new Date().toISOString();
    } else {
      entries.push({ term: clean, count: 1, lastSeen: new Date().toISOString() });
    }
    entries.sort((a, b) => b.count - a.count);
    if (entries.length > 200) entries = entries.slice(0, 200);
    await window.storage.set(MISS_LOG_KEY, JSON.stringify(entries), true);
  } catch (e) {
    // Il logging non deve mai bloccare la ricerca: fallisce in silenzio.
  }
}

async function loadSearchMisses() {
  try {
    const res = await window.storage.get(MISS_LOG_KEY, true);
    return res ? JSON.parse(res.value) : [];
  } catch (e) {
    return [];
  }
}

/* Nessun pulsante pubblico mostra questo registro: è consultabile solo da
   console del browser (window.vegaminoAdmin.getSearchMisses()), così i
   visitatori del sito non lo vedono. Attenzione: in questo prototipo è
   comunque "sicurezza per oscurità", non un vero controllo di accesso —
   nel progetto reale la lettura va ristretta lato server (RLS su Supabase
   o una route admin protetta da password), come spiegato in chat. */
if (typeof window !== "undefined") {
  window.vegaminoAdmin = { getSearchMisses: loadSearchMisses };
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
  const REFERENCE = REFERENCE_SETS.adult.values;

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
      return [...prev, id];
    });
  }

  const selectedFoods = selectedIds.map((id) => FOOD_MAP[id]);

  return (
    <div style={{ background: C.bg, minHeight: "100%", color: C.text, fontFamily: "IBM Plex Sans, sans-serif" }} className="vgm-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;1,500&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
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
                      Questo termine viene registrato, così sappiamo quali alimenti aggiungere in futuro.
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
                        <span style={{ color: C.mustard, fontSize: 12, fontWeight: 600 }}>{displayGrams[i]} g</span>
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
