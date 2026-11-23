import { fold } from './localized';
import type { Lang, Localized } from './types';

/**
 * Canonical ingredients with Dutch and English names. The key ties together
 * the same ingredient across recipes and languages for the ingredient index.
 * Extra entries (e.g. produced by translation at import time) are stored in
 * Dropbox as `ingredients.json` and merged in with `registerCatalogEntries`.
 */
export interface CatalogEntry {
  key: string;
  name: Required<Localized>;
  /** Extra spellings / plurals (any language). */
  synonyms?: string[];
}

// [key, nl, en, ...synonyms]
const BUILTIN: [string, string, string, ...string[]][] = [
  ['onion', 'ui', 'onion', 'uien', 'onions', 'ajuin', 'ajuinen', 'gele ui'],
  ['red-onion', 'rode ui', 'red onion', 'rode uien', 'red onions', 'rode ajuin'],
  ['shallot', 'sjalot', 'shallot', 'sjalotten', 'sjalotje', 'sjalotjes', 'shallots'],
  ['spring-onion', 'lente-ui', 'spring onion', 'lente-uitjes', 'lenteui', 'bosui', 'scallion', 'scallions', 'spring onions'],
  ['garlic', 'look', 'garlic', 'knoflook', 'lookteentjes', 'teentjes look', 'teentje look', 'knoflookteen'],
  ['leek', 'prei', 'leek', 'preien', 'leeks'],
  ['carrot', 'wortel', 'carrot', 'wortelen', 'wortels', 'worteltjes', 'carrots'],
  ['celery', 'selder', 'celery', 'selderij', 'bleekselder', 'stengels selder', 'celery stalks'],
  ['celeriac', 'knolselder', 'celeriac', 'knolselderij'],
  ['potato', 'aardappel', 'potato', 'aardappelen', 'aardappels', 'potatoes'],
  ['sweet-potato', 'zoete aardappel', 'sweet potato', 'zoete aardappelen', 'sweet potatoes'],
  ['tomato', 'tomaat', 'tomato', 'tomaten', 'tomatoes'],
  ['cherry-tomato', 'kerstomaat', 'cherry tomato', 'kerstomaatjes', 'kerstomaten', 'cherry tomatoes'],
  ['canned-tomatoes', 'tomatenblokjes', 'chopped tomatoes', 'gepelde tomaten', 'tomaten in blik', 'canned tomatoes', 'diced tomatoes'],
  ['tomato-paste', 'tomatenpuree', 'tomato paste', 'tomatenconcentraat'],
  ['bell-pepper', 'paprika', 'bell pepper', 'paprikas', 'paprika’s', 'bell peppers', 'rode paprika', 'red pepper'],
  ['chili', 'chilipeper', 'chili pepper', 'rode peper', 'chilipepers', 'chili', 'chillies', 'chilies', 'piment'],
  ['zucchini', 'courgette', 'courgette', 'courgettes', 'zucchini'],
  ['eggplant', 'aubergine', 'aubergine', 'aubergines', 'eggplant'],
  ['mushroom', 'champignon', 'mushroom', 'champignons', 'mushrooms', 'paddenstoelen'],
  ['spinach', 'spinazie', 'spinach', 'jonge spinazie', 'baby spinach'],
  ['lettuce', 'sla', 'lettuce', 'kropsla'],
  ['endive', 'witloof', 'Belgian endive', 'witlof', 'chicory', 'endive'],
  ['cabbage', 'kool', 'cabbage', 'witte kool', 'savooiekool', 'savoy cabbage'],
  ['red-cabbage', 'rode kool', 'red cabbage'],
  ['broccoli', 'broccoli', 'broccoli'],
  ['cauliflower', 'bloemkool', 'cauliflower'],
  ['brussels-sprouts', 'spruitjes', 'Brussels sprouts', 'spruiten'],
  ['green-beans', 'boontjes', 'green beans', 'sperziebonen', 'prinsessenbonen', 'haricots verts'],
  ['peas', 'erwten', 'peas', 'erwtjes', 'doperwten'],
  ['corn', 'maïs', 'corn', 'mais', 'sweetcorn'],
  ['cucumber', 'komkommer', 'cucumber'],
  ['avocado', 'avocado', 'avocado', 'avocados', 'avocado’s'],
  ['pumpkin', 'pompoen', 'pumpkin', 'butternut', 'butternut squash'],
  ['fennel', 'venkel', 'fennel'],
  ['asparagus', 'asperge', 'asparagus', 'asperges'],
  ['ginger', 'gember', 'ginger', 'verse gember'],
  ['lemon', 'citroen', 'lemon', 'citroenen', 'lemons'],
  ['lemon-juice', 'citroensap', 'lemon juice'],
  ['lime', 'limoen', 'lime', 'limoenen', 'limes'],
  ['orange', 'sinaasappel', 'orange', 'appelsien', 'appelsienen', 'sinaasappels', 'oranges'],
  ['apple', 'appel', 'apple', 'appels', 'apples'],
  ['pear', 'peer', 'pear', 'peren', 'pears'],
  ['banana', 'banaan', 'banana', 'bananen', 'bananas'],
  ['strawberry', 'aardbei', 'strawberry', 'aardbeien', 'strawberries'],
  ['raisins', 'rozijnen', 'raisins'],
  ['parsley', 'peterselie', 'parsley', 'platte peterselie', 'flat-leaf parsley'],
  ['chives', 'bieslook', 'chives'],
  ['basil', 'basilicum', 'basil'],
  ['thyme', 'tijm', 'thyme'],
  ['rosemary', 'rozemarijn', 'rosemary'],
  ['bay-leaf', 'laurier', 'bay leaf', 'laurierblad', 'laurierblaadjes', 'bay leaves'],
  ['coriander', 'koriander', 'coriander', 'cilantro', 'verse koriander'],
  ['mint', 'munt', 'mint', 'verse munt'],
  ['dill', 'dille', 'dill'],
  ['tarragon', 'dragon', 'tarragon'],
  ['oregano', 'oregano', 'oregano'],
  ['salt', 'zout', 'salt', 'zeezout', 'fleur de sel', 'sea salt'],
  ['pepper', 'peper', 'pepper', 'zwarte peper', 'black pepper', 'versgemalen peper'],
  ['salt-and-pepper', 'peper en zout', 'salt and pepper', 'zout en peper'],
  ['nutmeg', 'nootmuskaat', 'nutmeg', 'muskaatnoot'],
  ['paprika-powder', 'paprikapoeder', 'paprika powder', 'gerookt paprikapoeder', 'smoked paprika'],
  ['cumin', 'komijn', 'cumin', 'komijnpoeder', 'ground cumin'],
  ['curry-powder', 'currypoeder', 'curry powder', 'kerrie', 'kerriepoeder'],
  ['cinnamon', 'kaneel', 'cinnamon'],
  ['vanilla', 'vanille', 'vanilla', 'vanillestokje', 'vanillesuiker', 'vanilla extract'],
  ['mustard', 'mosterd', 'mustard', 'grove mosterd', 'dijon mustard'],
  ['butter', 'boter', 'butter', 'ongezouten boter', 'unsalted butter', 'roomboter'],
  ['olive-oil', 'olijfolie', 'olive oil', 'extra vierge olijfolie', 'extra virgin olive oil'],
  ['oil', 'olie', 'oil', 'zonnebloemolie', 'arachideolie', 'vegetable oil', 'sunflower oil'],
  ['vinegar', 'azijn', 'vinegar', 'wijnazijn', 'wine vinegar'],
  ['balsamic-vinegar', 'balsamicoazijn', 'balsamic vinegar', 'balsamico'],
  ['soy-sauce', 'sojasaus', 'soy sauce'],
  ['honey', 'honing', 'honey'],
  ['sugar', 'suiker', 'sugar', 'kristalsuiker', 'fijne suiker', 'caster sugar'],
  ['brown-sugar', 'bruine suiker', 'brown sugar', 'cassonade'],
  ['icing-sugar', 'bloemsuiker', 'icing sugar', 'poedersuiker', 'powdered sugar'],
  ['flour', 'bloem', 'flour', 'tarwebloem', 'all-purpose flour', 'patisseriebloem', 'meel'],
  ['self-raising-flour', 'zelfrijzende bloem', 'self-raising flour', 'self-rising flour'],
  ['cornstarch', 'maïzena', 'cornstarch', 'maizena', 'maiszetmeel', 'cornflour'],
  ['baking-powder', 'bakpoeder', 'baking powder'],
  ['yeast', 'gist', 'yeast', 'droge gist', 'verse gist', 'dry yeast'],
  ['breadcrumbs', 'paneermeel', 'breadcrumbs', 'panko'],
  ['bread', 'brood', 'bread', 'boterham', 'boterhammen'],
  ['rice', 'rijst', 'rice', 'basmatirijst', 'risottorijst', 'basmati rice', 'arborio rice'],
  ['pasta', 'pasta', 'pasta', 'spaghetti', 'penne', 'tagliatelle', 'macaroni', 'fusilli'],
  ['couscous', 'couscous', 'couscous'],
  ['lentils', 'linzen', 'lentils', 'rode linzen', 'red lentils'],
  ['chickpeas', 'kikkererwten', 'chickpeas'],
  ['beans', 'bonen', 'beans', 'witte bonen', 'kidneybonen', 'kidney beans', 'white beans'],
  ['oats', 'havermout', 'oats', 'havervlokken', 'rolled oats'],
  ['egg', 'ei', 'egg', 'eieren', 'eggs'],
  ['egg-yolk', 'eigeel', 'egg yolk', 'eidooier', 'eidooiers', 'egg yolks'],
  ['egg-white', 'eiwit', 'egg white', 'eiwitten', 'egg whites'],
  ['milk', 'melk', 'milk', 'volle melk', 'halfvolle melk', 'whole milk'],
  ['cream', 'room', 'cream', 'slagroom', 'kookroom', 'verse room', 'heavy cream', 'whipping cream'],
  ['sour-cream', 'zure room', 'sour cream', 'crème fraîche', 'creme fraiche'],
  ['yogurt', 'yoghurt', 'yogurt', 'griekse yoghurt', 'greek yogurt'],
  ['mascarpone', 'mascarpone', 'mascarpone'],
  ['cheese', 'kaas', 'cheese', 'geraspte kaas', 'grated cheese'],
  ['parmesan', 'parmezaan', 'Parmesan', 'parmezaanse kaas', 'parmigiano', 'parmigiano reggiano'],
  ['gruyere', 'gruyère', 'Gruyère', 'gruyere'],
  ['mozzarella', 'mozzarella', 'mozzarella', 'buffelmozzarella'],
  ['feta', 'feta', 'feta', 'fetakaas'],
  ['goat-cheese', 'geitenkaas', 'goat cheese', "goat's cheese"],
  ['stock', 'bouillon', 'stock', 'broth', 'kippenbouillon', 'groentebouillon', 'runderbouillon', 'chicken stock', 'vegetable stock', 'beef stock', 'bouillonblokje', 'bouillonblokjes', 'stock cube'],
  ['white-wine', 'witte wijn', 'white wine', 'droge witte wijn', 'dry white wine'],
  ['red-wine', 'rode wijn', 'red wine'],
  ['beer', 'bier', 'beer', 'bruin bier', 'donker bier', 'trappist', 'abdijbier', 'dark beer'],
  ['water', 'water', 'water'],
  ['chicken', 'kip', 'chicken', 'kippenfilet', 'kipfilet', 'kippenbouten', 'kippendijen', 'chicken breast', 'chicken thighs'],
  ['beef', 'rundvlees', 'beef', 'runderstoofvlees', 'stoofvlees', 'stewing beef', 'rundergehakt', 'ground beef'],
  ['minced-meat', 'gehakt', 'minced meat', 'gemengd gehakt', 'varkensgehakt', 'half-om-half', 'mince'],
  ['pork', 'varkensvlees', 'pork', 'varkenshaasje', 'varkenshaas', 'pork tenderloin'],
  ['bacon', 'spek', 'bacon', 'spekblokjes', 'spekjes', 'pancetta', 'lardons'],
  ['ham', 'ham', 'ham', 'gekookte ham', 'rauwe ham', 'prosciutto'],
  ['sausage', 'worst', 'sausage', 'worstjes', 'chipolata', 'sausages'],
  ['lamb', 'lamsvlees', 'lamb', 'lamskotelet', 'lamsbout'],
  ['salmon', 'zalm', 'salmon', 'zalmfilet', 'salmon fillet'],
  ['cod', 'kabeljauw', 'cod', 'kabeljauwfilet'],
  ['shrimp', 'garnalen', 'shrimp', 'grijze garnalen', 'scampi', 'prawns'],
  ['mussels', 'mosselen', 'mussels'],
  ['tuna', 'tonijn', 'tuna'],
  ['almonds', 'amandelen', 'almonds', 'amandelschilfers', 'flaked almonds'],
  ['walnuts', 'walnoten', 'walnuts'],
  ['hazelnuts', 'hazelnoten', 'hazelnuts'],
  ['pine-nuts', 'pijnboompitten', 'pine nuts'],
  ['chocolate', 'chocolade', 'chocolate', 'pure chocolade', 'dark chocolate', 'fondantchocolade'],
  ['cocoa', 'cacaopoeder', 'cocoa powder', 'cacao'],
  ['coconut-milk', 'kokosmelk', 'coconut milk'],
  ['capers', 'kappertjes', 'capers'],
  ['olives', 'olijven', 'olives', 'zwarte olijven', 'groene olijven'],
  ['gingerbread', 'peperkoek', 'gingerbread', 'ontbijtkoek'],
  ['fries', 'frietjes', 'fries', 'frieten', 'french fries'],
];

const entries = new Map<string, CatalogEntry>();
const lookup = new Map<string, string>(); // folded name -> key

function addEntry(entry: CatalogEntry) {
  entries.set(entry.key, entry);
  for (const s of [entry.name.nl, entry.name.en, ...(entry.synonyms ?? [])]) {
    const f = fold(s);
    if (f && !lookup.has(f)) lookup.set(f, entry.key);
  }
}

for (const [key, nl, en, ...synonyms] of BUILTIN) addEntry({ key, name: { nl, en }, synonyms });

/** Merge user/LLM-provided entries (stored in Dropbox). Later entries win for names. */
export function registerCatalogEntries(extra: CatalogEntry[]) {
  for (const e of extra) {
    const existing = entries.get(e.key);
    addEntry(existing ? { ...e, synonyms: [...(existing.synonyms ?? []), ...(e.synonyms ?? [])] } : e);
  }
}

export function catalogEntry(key: string): CatalogEntry | undefined {
  return entries.get(key);
}

export function allCatalogEntries(): CatalogEntry[] {
  return [...entries.values()];
}

// Adjectives that rarely change which ingredient it is.
const DESCRIPTORS = new Set(
  (
    'vers verse fijn fijne grof grove gehakte gesnipperde geraspte gemalen gedroogde gedroogd ' +
    'groot grote klein kleine middelgroot middelgrote rijpe biologische bio ongezouten gezouten ' +
    'fresh finely chopped minced ground dried large small medium ripe organic grated sliced diced ' +
    'whole halve half'
  ).split(' '),
);

/**
 * Map an ingredient name in any language to a catalog key.
 * Tries an exact match, then without descriptors, then the longest known
 * phrase contained in the name ("kleine rode ui" -> red-onion).
 */
export function ingredientKeyFor(name: string, _lang?: Lang): string | undefined {
  const folded = fold(name);
  if (!folded) return undefined;
  const exact = lookup.get(folded);
  if (exact) return exact;
  const words = folded.split(' ').filter((w) => !DESCRIPTORS.has(w));
  const stripped = words.join(' ');
  if (lookup.has(stripped)) return lookup.get(stripped);
  for (let len = words.length; len >= 1; len--) {
    for (let i = 0; i + len <= words.length; i++) {
      const phrase = words.slice(i, i + len).join(' ');
      const key = lookup.get(phrase);
      if (key) return key;
    }
  }
  return undefined;
}
