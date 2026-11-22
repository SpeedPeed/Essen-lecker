// Holt echte Packungspreise von heisse-preise.io und schreibt prices.json (nur unsere Zutaten).
// Aufruf: node scripts/prices.js [lokale-datei.json]
const fs = require('fs');
const D = require('../data.js');
const SRC = 'https://heisse-preise.io/data/latest-canonical.json';
const STORES = ['billa', 'spar'];
// shortcut: nur BILLA wird bei heisse-preise.io täglich aktualisiert (SPAR zuletzt 09/2026, HOFER/MPREIS/UNIMARKT älter) – weitere Märkte ergänzen, sobald deren Daten wieder aktuell sind.

// Zutat → [Muss-Regex, Ausschluss-Regex, min, max] (Menge in der Einheit aus data.js)
const X = 'bio|demeter|zurück zum ursprung|ja! natürlich|natur\\*pur|vegan|laktosefrei|baby|kotányi|purina|hund|katze';
const RULES = {
  erdaepfel: ['erdäpfel|kartoffel', 'süß|chips|püree|knödel|teig|pommes|rösti|wedges|puffer|salat|gnocchi|kroketten', 1500, 2500],
  zwiebel: ['^(\\S+ )?zwiebel', '\\d+ ?kg|rot|frühling|röst|gemüse|suppe|chips|würfel|perl|gewürz|creme', 500, 3000],
  knoblauch: ['^(\\S+ )?knoblauch(?! ?(salz|paste|öl|granulat|pulver|würz|sauce|dip|creme|butter|baguette|aufstrich))', 'schwarz|bär|stangerl|brot', 1, 3],
  karotten: ['karotte|möhre', 'saft|bio|baby|salat|bunt|mais|erbs|gelb', 500, 2000],
  paradeiser: ['paradeiser|tomate', 'geschält|dose|passiert|getrocknet|mark|sauce|ketchup|saft|gehackt|pesto|suppe|chips|aufstrich|würfel|cocktail|cherry|dattel|mozzarella|frito|creme|mix|fleisch', 400, 1000],
  paprika: ['paprika.*(mix|trio|3)|(mix|trio).*paprika', 'pulver|gewürz|chips|creme|aufstrich|würstel|wurst|sauce|füll|grill|mild|sweet', 3, 3],
  zucchini: ['^(\\S+ )?zucchini', 'creme|aufstrich|nudel|spaghetti|suppe|chips|grill', 1, 1000],
  melanzani: ['melanzani|aubergine', 'creme|aufstrich|grill|dip', 1, 1000],
  karfiol: ['karfiol|blumenkohl', 'tk|tiefkühl|rahm|reis|creme|suppe|wings|gratin', 1, 1],
  brokkoli: ['brokkoli|broccoli', 'pizza|basen|schlemmer|filet|iglo|erntefrisch|tk|tiefkühl|creme|suppe|gratin|rahm|bällchen|röschen', 300, 600],
  weisskraut: ['weißkraut|weisskraut|krautkopf', 'salat|sauer|rot|chinakraut|gekocht|burger|bbq|efko', 1, 1500],
  salat: ['häuptelsalat|kopfsalat|eissalat|eisbergsalat', 'mix|schale|dressing', 1, 1],
  gurke: ['salatgurke|^(\\S+ )?gurke$', 'essig|glas|salat|scheiben|snack|mini|senf|delikatess|gewürz', 1, 1],
  champignons: ['champignon', 'dose|glas|creme|sauce|suppe|braun|riesen|geschnitten|tk|tiefkühl|pastete|gefüllt|pilz', 200, 500],
  lauch: ['(^|\\s)(lauch|porree)', 'zwiebel|creme|suppe', 1, 1],
  zitrone: ['zitrone', 'saft|limo|tee|eis|kuchen|schale|essig|aroma|duft|pfeffer|creme|joghurt|torte|kekse|waffel|bonbon|wasser|gras|sauce|melisse|thymian|öl|dressing|zest|getränk', 3, 8],
  petersilie: ['petersilie', 'tk|tiefkühl|getrocknet|wurzel|gefrier|dose|glas|streuer', 1, 1],
  schnittlauch: ['schnittlauch', 'tk|tiefkühl|getrocknet|gefrier|topfen|aufstrich|frischkäse|streuer|dose', 1, 1],
  koriander: ['koriander', 'gemahlen|samen|getrocknet|tk|tiefkühl|ganz|streuer|gewürz|pulver', 1, 1],
  ingwer: ['^(\\S+ )?ingwer', 'kichererbse|tee|shot|saft|bier|ale|limo|gemahlen|kandiert|eingelegt|paste|kekse|sirup|getränk|zitrone|gewürz|pulver|bonbon|honig|kurkuma|curcuma|wasser|sushi|streuer|frucht|schoko|minze|limette|apfel|karotte|orange|kürbis|pflaume|zimt|mango', 50, 300],
  fruehlingszwiebel: ['frühlingszwiebel|jungzwiebel', 'tk|getrocknet|dip|creme|aufstrich|frischkäse', 1, 1],
  kuerbis: ['hokkaido', 'suppe|creme|kern|öl|chips|püree|würfel', 1, 1500],
  semmeln: ['kaisersemmel|semmeln', 'knödel|brösel|würfel|toast|mohn|sesam|vollkorn|kürbis|dinkel|laugen|bio|schwarz|knusper|aufback|zum fertigbacken|fertig', 4, 10],
  tortillas: ['tortilla', 'chips|vollkorn|mais|corn|dip|nacho|bio|wrap.*(dinkel|vollkorn)|integral|grill|klein|mini|kit|taco', 4, 8],
  schwarzbrot: ['bauernbrot|hausbrot|mischbrot', 'toast|vollkorn|dinkel|bio|knödel|chips|scheiben|knäcke|mini', 400, 1000],
  feta: ['schafkäse|feta|hirtenkäse', 'oliven|kräuter|würfel|creme|aufstrich|mariniert|pikant|knoblauch|chili|paprika|tomate|salat|spinat|gefüllt|getrocknet|pfeffer|teig', 150, 250],
  emmentaler: ['emmentaler.*gerieben|gerieben.*emmentaler', '', 150, 250],
  bergkaese: ['bergkäse.*gerieben|gerieben.*bergkäse|reibkäse|käse.*gerieben', 'parmesan|grana|pecorino|mozzarella|vegan|pizza', 150, 250],
  mozzarella: ['mozzarella', 'mini|perle|kugeln|gerieben|light|di bufala|büffel|sticks|pizza|tomate|sticks|snack|burrata|stracciatella|gerieben|scheiben|panier|aufstrich|baguette|kleine|maxi|block|stange|sticks', 100, 130],
  parmesan: ['parmesan|grana padano|parmigiano|hartkäse', 'alami|knorr|spaghetteria|gerieben|chips|dressing|sauce|creme|pesto|ravioli|gnocchi|cracker|kekse|riegel|snack|streu|frico|crisps|risotto|knödel', 80, 200],
  frankfurter: ['frankfurter|wiener würstel|würstel', 'hähnchen|huhn|geflügel|pute|gulasch|kartoffel|berner|senf|käse|dose|glas|grill|debreziner|bratw|hühner|pute|kalb|vegan|veggie|vegetar|mini|cocktail|kabanos|knacker|bärlauch|chili|scharf|ohne', 250, 400],
  topfen: ['topfen', 'mager|strudel|golatsch|creme|knödel|kuchen|torte|tasche|schnitte|kräuter|vanille|aufstrich|palatschinke|dessert|nockerl|mousse|bällchen|plunder|zitrone|schoko|frucht|erdbeer|marille|schlagobers|sauer|cheesecake|laktose|bröselig|ziege|schaf|polster|stern|kipferl|zopf|oster|mohn|nuss|kokos|beere|kirsche|mango|himbeer|heidelbeer|pfirsich|banane|joghurt|protein|high|skyr|quark|ohne', 250, 250],
  schlagobers: ['schlagobers|schlagrahm', 'sprüh|spray|dose|ersatz|pflanz|vegan|zum kochen|kochobers|haltbar|uht|sahne(?!.*obers)|torte|kuchen|creme|dessert|eis|kaffee|steif|haf|soja|kokos|mandel', 200, 250],
  sauerrahm: ['sauerrahm', 'dip|kräuter|knoblauch|creme|leicht|light|sauce|chips|zwiebel|schnittlauch', 200, 250],
  milch: ['vollmilch|frischmilch|heumilch|^(\\S+ )?milch \\d', 'schoko|kakao|kaffee|reis|hafer|soja|mandel|kokos|laktose|haltbar|esl|h-milch|mager|leicht|drink|shake|eis|kondens|pulver|butter|vanille|erdbeer|bio|ziegen|schaf|latte|creme|joghurt|schnitte|brötchen|riegel|semmel|kipferl|zopf|brot|ohne gentechnik.*h|tee|reis', 1000, 1000],
  butter: ['butter', 'schmalz|milch|keks|kekse|croissant|kipferl|brioche|creme|kräuter|knoblauch|streich|vegan|aufstrich|cookies|toffee|caramel|karamell|schoko|brezel|zopf|nuss|erdnuss|mandel|cashew|sauce|reis|blätterteig|teig|kuchen|light|pflanz|gesalzen|salz|bohnen|huhn|chicken|popcorn|fisch|lachs|schnitten|waffel|tropf|kokos|honig|zimt|vanille|pistazie|muffin|scheiben|gebäck|alpen|würfel|portion|mini|keks', 250, 250],
  eier: ['eier', 'nudel|nockerl|likör|bio|bodenhaltung|mais|schoko|ostern|oster|gefärbt|bunt|gekocht|wachtel|salat|spätzle|teigwaren|pasta|kekse|aufstrich|kinder|überraschung|tagliatelle|fleckerl|spaghetti|makkaroni|hörnchen|band|suppe|flecken|spiral|farfalle|penne|lasagne|fusilli|nester|tortellini|ravioli|zwieback|biskuit|gnocchi|creme|tiefkühl|mayon|omelett|pulver|gebäck|kuchen', 10, 10],
  joghurt: ['naturjoghurt|joghurt natur', '0\\.1|griechisch|stich|drink|trink|frucht|erdbeer|vanille|0,1|mager|laktose|soja|kokos|hafer|bio|schaf|ziege|griech|protein|skyr|mango|heidel|pfirsich|kirsch|himbeer|marille|müsli|honig|zitrone|banane|kaffee|schoko|pistazie|nuss|mandel|cracker|dressing|dip|sauce|knoblauch|kräuter|gurke|creme', 400, 500],
  tofu: ['tofu', 'suppe|kichererbse|smoked|spice|omami|geräuchert|räucher|mariniert|seiden|würstel|wurst|burger|aufstrich|curry|basilikum|kräuter|paprika|bratling|nuggets|sticks|schnitzel|balls|bällchen|sesam|mandel|nuss|chili|teriyaki|knoblauch|oliven|tomate|pesto|bio', 150, 400],
  spaetzle: ['spätzle|nockerl', 'trocken|getrocknet|käse|vegan|spinat|kräuter|bärlauch|zwiebel|speck|pfanne|mehl|knödel|schupf|grieß|leber|topfen|marillen|dinkel|vollkorn|fertig', 400, 600],
  gnocchi: ['gnocchi', 'kartoffel.*mehl|füll|gefüllt|tomate|käse|spinat|pesto|kürbis|bärlauch|süßkartoffel|dinkel|vollkorn|vegan|sugo|sauce|pfanne|fertig|mini', 400, 600],
  faschiertes: ['faschiertes.*gemischt|gemischtes faschiert|faschiertes rind.*schwein|faschiertes vom (rind|schwein) (und|&)', 'bio|laibchen|ćevap|cevap|burger|bällchen|knödel|lasagne|sauce|sugo|vegan|pute|huhn', 400, 600],
  rindsgulasch: ['rind.*gulasch|gulasch.*rind|rindsgulasch|gulaschfleisch', 'dose|glas|suppe|fertig|konserve|sauce|gewürz|würfel|pulver|bio|kalb|schwein|pute|huhn|kessel|eintopf|pfanne|knödel|nockerl|nudeln|spätzle|tiefkühl|tk|vegan|veggie', 400, 1000],
  huhn: ['hühnerbrust|hühnerfilet|hendlbrust|hendlfilet|hähnchenbrust|hühnerbrustfilet', 'iglo|pfanne|inzersdorfer|wellness|bio|wurst|schinken|aufschnitt|scheiben|gegrillt|gebraten|paniert|nuggets|sticks|streifen.*(knusp|panier)|knusp|curry|teriyaki|mariniert|gewürzt|chili|paprika|kräuter|tandoori|bbq|gyros|kebab|wraps|salat|suppe|dose|konserve|tiefkühl|tk|vegan|veggie|innen|mini|cordon|gefüllt|schnitzel|spieße|spiess|aufstrich|pastete|katze|hund|futter|sous', 300, 1000],
  penne: ['penne', 'vollkorn|dinkel|bio|gluten|linsen|kichererbsen|erbsen|bohnen|protein|mini|rigate.*(bio|vollkorn)|sauce|sugo|fertig|pfanne|tiefkühl|tk|salat|gefüllt|lasagne|arrabbiata|carbonara|bolognese|pesto|tomate|käse', 500, 500],
  spaghetti: ['spaghetti', 'vollkorn|dinkel|bio|gluten|linsen|kichererbsen|erbsen|bohnen|protein|sauce|sugo|fertig|pfanne|tiefkühl|tk|salat|kürbis|zucchini|konjak|reis|glas|eis|carbonara|bolognese|napoli|arrabbiata|pesto|tomate|käse|kit|set|box|spaghettini|spaghettoni|zange|topf|dose', 500, 500],
  fleckerl: ['fleckerl', 'kraut|schinken|dinkel|vollkorn|bio|fertig|tiefkühl|tk|pfanne', 250, 500],
  reis: ['langkornreis|parboiled|spitzenreis|langkorn reis|reis langkorn', 'kochbeutel|beutel|bio|vollkorn|basmati|jasmin|wild|milch|risotto|natur.*vollkorn|express|minute|fertig|mikrowelle|pfanne|waffel|cracker|chips|kuchen|dessert|pudding|drink|essig|nudel|papier|sake|wein|mehl|stärke|sushi|curry|gemüse|mexikan|paella|tomate|huhn|8 ?min', 500, 1000],
  linsen: ['linsen', 'rot|rote|gelb|beluga|dose|glas|bio|chips|nudel|pasta|penne|spaghetti|fusilli|eintopf|suppe|dal|curry|salat|aufstrich|bratling|burger|kichererbsen|snack|waffel|cracker|fertig|gekocht|vorgekocht|tiefkühl', 400, 1000],
  roteLinsen: ['rote linsen|linsen,? rot', 'dose|glas|bio|chips|nudel|pasta|penne|spaghetti|fusilli|eintopf|suppe|dal|curry|salat|aufstrich|bratling|burger|snack|waffel|cracker|fertig|gekocht|vorgekocht', 400, 1000],
  couscous: ['couscous|cous cous', 'bio|vollkorn|salat|fertig|perl|gemüse|tomate|kräuter|minze|curry|orient|mediterran|pfanne|mix|beutel', 400, 1000],
  bohnen: ['schwarze bohnen', 'bio|chili|salat|eintopf|suppe|mais|kidney|pasta|nudel|chips|getrocknet|trocken|fermentiert|sauce|paste|bean|refried|mus|aufstrich|burger|bratling', 250, 450],
  kidney: ['kidney', 'bio|chili|salat|eintopf|suppe|mais|pasta|nudel|chips|getrocknet|trocken|sauce|aufstrich|burger|mix|mexi', 250, 450],
  kichererbsen: ['kichererbsen', 'bio|curry|salat|eintopf|suppe|pasta|nudel|penne|fusilli|spaghetti|chips|getrocknet|trocken|mehl|snack|geröstet|hummus|humus|aufstrich|burger|bratling|falafel|crunchy|cracker|waffel|linsen', 250, 450],
  mais: ['mais', 'bio|maiskeim|stärke|mehl|grieß|chips|popcorn|cornflakes|flakes|kolben|öl|tortilla|waffel|cracker|kuchen|brot|nudel|pasta|salat|baby|mini|polenta|creme|suppe|huhn|hendl|maishendl|poulard|keulen|filet|brust|schnitzel|tk|tiefkühl|mix|bohnen|erbsen|gemüse|paprika|pfanne|kölbchen|maize|maisk|bier|drink|toast', 250, 340],
  passata: ['passata|passierte (tomaten|paradeiser)|paradeiser passiert|tomaten passiert', 'bio|basilikum|kräuter|knoblauch|chili|zwiebel|oregano|sauce|sugo|ketchup|mark|würz|arrabbiata', 400, 700],
  dosenparadeiser: ['(tomaten|paradeiser).*(gehackt|stücke|stückig|würfel)|(gehackte|geschälte) (tomaten|paradeiser)|polpa', 'bio|basilikum|kräuter|knoblauch|chili|zwiebel|oregano|getrocknet|sauce|sugo|ketchup|mark|würz|arrabbiata|cherry|kirsch|olive|frisch|mozzarella|salat|pesto|chips|creme|aufstrich|suppe|paprika', 390, 420],
  paradeismark: ['paradeismark|tomatenmark', 'bio|tube|würz|ketchup|sauce|sugo|getrocknet|3-fach|dreifach|kräuter|knoblauch', 70, 220],
  kokosmilch: ['kokosmilch|kokosnussmilch|coconut milk', 'drink|light|fettreduziert|bio|joghurt|eis|creme|dessert|schoko|riegel|reis|curry|suppe|kaffee|getränk|pulver|keks|kekse|bonbon|haf|mandel|soja|trink|zum trinken|uht|barista', 330, 420],
  currypaste: ['currypaste|curry paste|curry-paste', 'grün|gelb|massaman|panang|bio|tikka|korma|madras|vindaloo|butter|tandoori|balti|jalfrezi|rogan', 50, 250],
  thunfisch: ['thunfisch', 'pikant|öl|olivenöl|creme|aufstrich|salat|sauce|pizza|steak|filet frisch|frisch|tiefkühl|tk|sushi|mais|bohnen|tomate|chili|paprika|zitrone|pfeffer|kräuter|curry|mexikan|mediterran|sandwich|toast|snack|katze|hund|futter|cat|chips|pastete|bio|mayo|wrap|sauce|zwiebel|gemüse', 120, 200],
  oliven: ['oliven', 'öl|grün|gefüllt|paprika|mandel|knoblauch|chili|kräuter|feta|schafkäse|käse|mariniert|bio|creme|tapenade|aufstrich|pesto|seife|brot|ciabatta|chips|cracker|snack|zitrone|kalamata|riesen|gourmet|mix|antipasti|pizza|nudel|pasta|salat|tomate', 100, 300],
  sojasauce: ['sojasauce|soja sauce|soy sauce|sojasoße|sojasosse', 'süß|sweet|teriyaki|knoblauch|chili|ingwer|reduziert|light|bio|glutenfrei|gluten|tamari|würz|pilz|mushroom|dunkel|dark|honig|sesam|wok|marinade|dip|snack|nüsse|kerne|chips|cracker|reis|nudel|edamame', 100, 300],
  erdnussmus: ['erdnussmus|erdnussbutter|peanut butter', 'bio|crunchy|creamy.*bio|schoko|kekse|cookies|riegel|bar|cup|flips|snack|eis|pulver|protein|drink|creme|aufstrich|kakao|honig|banane|marmelade|jelly|sauce|satay|curry|bällchen|cracker|reiswaffel|waffel|brezel|pop|lolly|bonbon|praline|reese|m&m|nuss.*mix|mandel|cashew|haselnuss|tahin|sesam|light|frei|kids', 200, 400],
  pesto: ['pesto.*basilikum|basilikum.*pesto|pesto genovese|pesto alla genovese', 'rot|rosso|bio|vegan|veggie|bärlauch|tomate|chili|ricotta|rucola|kürbis|paprika|walnuss|mandel|cashew|pistazie|frisch|kühl|gnocchi|nudel|pasta|ravioli|tortellini|aufstrich|creme|dip|mayo|soße|chips|cracker|brot|baguette|spaghetti|penne|fusilli|salat|frischkäse|käse', 150, 200],
  sesam: ['^(\\S+ )?sesam( |$)', 'schnitten|glutenfrei|wasa|pretzel|squeezed|öl|bio|schwarz|geröstet|paste|tahin|mus|riegel|crunch|krokant|knusper|brot|semmel|weckerl|stange|cracker|kekse|bagel|bun|burger|sauce|dressing|nudel|snack|chips|reis|waffel|honig|brezel|zopf|gebäck|croissant|stick|grissini|toast|mehl|samen.*mix|mix|kürbis|leinsamen|sonnenblumen|chia|hanf|mohn', 100, 250],
  bruehe: ['gemüsesuppe.*würfel|gemüse.*bouillon.*würfel|gemüsebrühe.*würfel|suppenwürfel.*gemüse|gemüse.*suppenwürfel', 'bio|vegan|klar|hefe|ohne|frei|reduziert|pulver|granulat|paste|flüssig|fond|glas|dose|instant|becher|tasse|klare|nudel|knödel|grieß|frittaten|einlage|huhn|hühner|rind|fleisch|pilz|fisch', 6, 12],
  erbsen: ['erbsen', 'zucker|kicher|mais|karotten|gemüse|mix|dose|glas|getrocknet|trocken|schäl|split|gelb|grün.*bio|bio|nudel|pasta|chips|snack|wasabi|protein|mehl|suppe|eintopf|püree|creme|risotto|pfanne|knödel|reis|crunchy|geröstet|snap|zuckerschoten|schoten|edamame', 400, 1000],
  spinat: ['blattspinat|spinat', 'rahm|cremespinat|stangen|frisch|baby|salat|knödel|nockerl|nudel|pasta|ravioli|tortellini|lasagne|gnocchi|pizza|strudel|lachs|tasche|creme|suppe|feta|schafkäse|käse|ricotta|topfen|kroketten|laibchen|burger|bratling|wrap|tortilla|blätterteig|pide|börek|burek|knusper|mix|gemüse|pfanne|smoothie|saft|spätzle|chips|kräuter|zwiebel|pesto|aufstrich|quiche|dip|sauce|omelett|eier|wildspinat|junger|portionen|portion|gehackt|passiert|püree', 400, 1000],
  wokgemuese: ['wok', 'pfanne|sauce|soße|nudel|noodle|reis|huhn|hühner|hendl|garnele|shrimp|rind|schwein|ente|tofu|teriyaki|curry|sweet|chili|kit|box|set|öl|würz|gewürz|marinade|paste|bio|asia|frisch|kühl|fertig|thai|mie|udon|ramen|instant|becher|cup|topf|wokpfanne|wender|löffel|spatel', 500, 1000],
  lachs: ['lachsfilet|lachs filet|lachsportion', 'räucher|geräuchert|graved|gebeizt|kalt|aufstrich|creme|dip|filet.*(frisch|natur.*frisch)|frisch|kühl|bio|wildlachs.*(dose|glas)|dose|glas|forelle|ersatz|vegan|lachsersatz|lachsschinken|schinken|wurst|katze|hund|futter|sushi|wrap|salat|nudel|pasta|lasagne|pizza|quiche|tasche|strudel|bagel|sandwich|brötchen|toast|burger|bratling|laibchen|stäbchen|nuggets|panier|knusper|backfisch|sauce|soße|pesto|kaviar|rogen|chips|snack|happen|carpaccio|tatar|tartar|terrine|pastete|mousse|rillettes|cracker|kroketten|frikadellen|fischstäbchen|spieße|spiess|würfel|stücke|streifen|scheiben|kräuter|zitrone|pfeffer|teriyaki|honig|senf|dill|spinat|gemüse|reis|nudeln|gratin|ofen|grill|tasche|rolle|roll', 200, 500],
  garnelen: ['garnelen|shrimps|crevetten|riesengarnelen|king prawns|prawns', 'provencale|chips|cracker|snack|salat|sauce|soße|cocktail|paste|nudel|pasta|reis|pfanne|pizza|sushi|wrap|suppe|dim sum|frühlingsrolle|spring roll|tempura|panier|knusper|chili|knoblauch|kräuter|mariniert|gegrillt|spieße|spiess|bio|vegan|frisch|kühl|glas|dose|lake|getrocknet|curry|teriyaki|gemüse|tasche|ravioli|tortellini|dumpling|gyoza|wan tan|wonton|krabben|nordsee|cocktailgarnelen', 150, 500],
};

const norm = p => {
  let { unit, quantity: q } = p;
  if (unit === 'kg') { unit = 'g'; q *= 1000; } else if (unit === 'l') { unit = 'ml'; q *= 1000; } else if (unit === 'stück' || unit === 'kos') unit = 'stk';
  return { unit, q };
};
const ourUnit = u => (u === 'g' || u === 'ml') ? u : 'stk';

function pick(all, store, id) {
  const ing = D.INGREDIENTS[id], [re, ex, min, max] = RULES[id];
  const r = new RegExp(re, 'i'), x = new RegExp([ex, X].filter(Boolean).join('|'), 'i'), want = ourUnit(ing.unit);
  const fresh = store === 'billa';
  return all.filter(p => p.store === store && (!fresh || !p.unavailable) && (!p.isWeighted || want === 'g') && r.test(p.name) && !x.test(p.name))
    .map(p => ({ p, ...norm(p) }))
    .filter(c => c.unit === want && c.q >= min && c.q <= max && c.p.price > 0)
    .sort((a, b) => a.p.price / a.q - b.p.price / b.q || a.p.price - b.p.price)[0];
}

// Aktion = Preis in den letzten 14 Tagen um mind. 5 % gesunken (nur bei täglich aktuellen Daten sinnvoll).
function offerWas(p, today) {
  const [now, prev] = p.priceHistory, since = new Date(Date.parse(today) - 14 * 864e5).toISOString().slice(0, 10);
  return prev && now.date >= since && now.price < prev.price * 0.95 ? prev.price : null;
}

async function main() {
  const all = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2])) : await (await fetch(SRC)).json();
  const out = { source: 'heisse-preise.io', fetched: new Date().toISOString().slice(0, 10), stores: {} };
  for (const store of STORES) {
    const items = {};
    let latest = '';
    for (const id of Object.keys(RULES)) {
      const c = pick(all, store, id);
      if (!c) continue;
      const date = c.p.priceHistory[0].date;
      if (date > latest) latest = date;
      items[id] = { name: c.p.name, price: c.p.price, qty: c.q, date };
      const was = store === 'billa' && offerWas(c.p, out.fetched);
      if (was) items[id].was = was;
    }
    out.stores[store] = { asOf: store === 'billa' ? out.fetched : latest, items };
    console.error(store, Object.keys(items).length + '/' + Object.keys(RULES).length, 'Stand', out.stores[store].asOf);
  }
  fs.writeFileSync(__dirname + '/../prices.json', JSON.stringify(out, null, 1));
}
module.exports = { RULES, pick, offerWas };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
