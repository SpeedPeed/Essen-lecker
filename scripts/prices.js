// Holt echte Packungspreise von heisse-preise.io und schreibt prices.json (nur unsere Zutaten).
// Aufruf: node scripts/prices.js [lokale-datei.json]
const fs = require('fs');
const D = require('../data.js');
const { fetchAll, matchOffers } = require('./offers.js');
const SRC = 'https://heisse-preise.io/data/latest-canonical.json';
const STORES = ['billa', 'spar'];
// shortcut: nur BILLA wird bei heisse-preise.io täglich aktualisiert (SPAR zuletzt 09/2026, HOFER/MPREIS/UNIMARKT älter) – weitere Märkte ergänzen, sobald deren Daten wieder aktuell sind.

// Zutat → [Muss-Regex, Ausschluss-Regex, min, max] (Menge in der Einheit aus data.js)
const X = 'bio|alnatura|demeter|zurück zum ursprung|ja! natürlich|natur\\*pur|vegan|laktosefrei|baby|kotányi|purina|hund|katze';
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
  bergkaese: ['bergkäse.*gerieben|gerieben.*bergkäse|reibkäse|käse.*gerieben', 'parmesan|grana|pecorino|mozzarella|vegan|pizza|cheddar|gouda|edamer|tilsiter|mix', 150, 250],
  mozzarella: ['mozzarella', 'mini|perle|kugeln|gerieben|light|di bufala|büffel|sticks|pizza|tomate|sticks|snack|burrata|stracciatella|gerieben|scheiben|panier|aufstrich|baguette|kleine|maxi|block|stange|sticks', 100, 130],
  parmesan: ['parmesan|grana padano|parmigiano|hartkäse', 'alami|knorr|spaghetteria|gerieben|chips|dressing|sauce|creme|pesto|ravioli|gnocchi|cracker|kekse|riegel|snack|streu|frico|crisps|risotto|knödel', 80, 200],
  frankfurter: ['frankfurter|wiener würstel|würstel', 'hähnchen|huhn|geflügel|pute|gulasch|kartoffel|berner|senf|käse|dose|glas|grill|debreziner|bratw|hühner|pute|kalb|vegan|veggie|vegetar|mini|cocktail|kabanos|knacker|bärlauch|chili|scharf|ohne', 250, 400],
  topfen: ['topfen', 'mager|strudel|golatsch|creme|knödel|kuchen|torte|tasche|schnitte|kräuter|vanille|aufstrich|palatschinke|dessert|nockerl|mousse|bällchen|plunder|zitrone|schoko|frucht|erdbeer|marille|schlagobers|sauer|cheesecake|laktose|bröselig|ziege|schaf|polster|stern|kipferl|zopf|oster|mohn|nuss|kokos|beere|kirsche|mango|himbeer|heidelbeer|pfirsich|banane|joghurt|protein|high|skyr|quark|ohne', 250, 250],
  schlagobers: ['schlagobers|schlagrahm', 'sprüh|spray|dose|ersatz|pflanz|vegan|zum kochen|kochobers|haltbar|uht|sahne(?!.*obers)|torte|kuchen|creme|dessert|eis|kaffee|steif|haf|soja|kokos|mandel', 200, 250],
  sauerrahm: ['sauerrahm', 'dip|kräuter|knoblauch|creme|leicht|light|sauce|chips|zwiebel|schnittlauch', 200, 250],
  milch: ['h-milch|vollmilch|frischmilch|heumilch|^(\\S+ )?milch \\d', 'schoko|kakao|kaffee|reis|hafer|soja|mandel|kokos|laktose|haltbar|esl|mager|leicht|drink|shake|eis|kondens|pulver|butter|vanille|erdbeer|bio|ziegen|schaf|latte|creme|joghurt|schnitte|brötchen|riegel|semmel|kipferl|zopf|brot|ohne gentechnik.*h|tee|reis', 1000, 1000],
  butter: ['butter', 'toast|stollen|schmalz|milch|keks|kekse|croissant|kipferl|brioche|creme|kräuter|knoblauch|streich|vegan|aufstrich|cookies|toffee|caramel|karamell|schoko|brezel|zopf|nuss|erdnuss|mandel|cashew|sauce|reis|blätterteig|teig|kuchen|light|pflanz|gesalzen|salz|bohnen|huhn|chicken|popcorn|fisch|lachs|schnitten|waffel|tropf|kokos|honig|zimt|vanille|pistazie|muffin|scheiben|gebäck|alpen|würfel|portion|mini|keks', 250, 250],
  eier: ['eier', 'nudel|nockerl|likör|bio|bodenhaltung|mais|schoko|ostern|oster|gefärbt|bunt|gekocht|wachtel|salat|spätzle|teigwaren|pasta|kekse|aufstrich|kinder|überraschung|tagliatelle|fleckerl|spaghetti|makkaroni|hörnchen|band|suppe|flecken|spiral|farfalle|penne|lasagne|fusilli|nester|tortellini|ravioli|zwieback|biskuit|gnocchi|creme|tiefkühl|mayon|omelett|pulver|gebäck|kuchen', 10, 10],
  joghurt: ['naturjoghurt|joghurt natur', '0\\.1|griechisch|stich|drink|trink|frucht|erdbeer|vanille|0,1|mager|laktose|soja|kokos|hafer|bio|schaf|ziege|griech|protein|skyr|mango|heidel|pfirsich|kirsch|himbeer|marille|müsli|honig|zitrone|banane|kaffee|schoko|pistazie|nuss|mandel|cracker|dressing|dip|sauce|knoblauch|kräuter|gurke|creme', 400, 500],
  tofu: ['tofu', 'suppe|kichererbse|smoked|spice|omami|geräuchert|räucher|mariniert|seiden|würstel|wurst|burger|aufstrich|curry|basilikum|kräuter|paprika|bratling|nuggets|sticks|schnitzel|balls|bällchen|sesam|mandel|nuss|chili|teriyaki|knoblauch|oliven|tomate|pesto|bio', 150, 400],
  spaetzle: ['spätzle|nockerl', 'trocken|getrocknet|käse|vegan|spinat|kräuter|bärlauch|zwiebel|speck|pfanne|mehl|knödel|schupf|grieß|leber|topfen|marillen|dinkel|vollkorn|fertig', 400, 600],
  gnocchi: ['gnocchi', 'kartoffel.*mehl|füll|gefüllt|tomate|käse|spinat|pesto|kürbis|bärlauch|süßkartoffel|dinkel|vollkorn|vegan|sugo|sauce|pfanne|fertig|mini', 400, 600],
  faschiertes: ['gemischt(es)? faschiert|faschiertes.*gemischt|gemischtes faschiert|faschiertes rind.*schwein|faschiertes vom (rind|schwein) (und|&)', 'bio|laibchen|ćevap|cevap|burger|bällchen|knödel|lasagne|sauce|sugo|vegan|pute|huhn', 400, 600],
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
  speck: ['speckwürfel|speck würfel|würfelspeck|bauchspeck.*würfel', 'käse|knödel|chips|gekocht|bio|geräuchert.*scheiben|scheiben|tiroler.*(stück|scheiben)', 80, 250],
  schinken: ['(koch|bein|press|toast|hinter)schinken|schinken gekocht|^(\\S+ )?schinken$', 'roh|prosciutto|serrano|parma|pute|huhn|hühner|bio|geräuchert|schwarzwälder|vegan|veggie', 100, 250],
  knoedelbrot: ['knödelbrot|semmelwürfel|knödelwürfel', 'bio|vollkorn|dinkel|fertig|knödel(?!brot)', 200, 500],
  sauerkraut: ['sauerkraut', 'bio|saft|wein|speck|fleisch|roh.*bio|glas.*bio|salat|strudel|knödel|bratwurst|würstel', 400, 1000],
  apfelmus: ['apfelmus|apfelmark', 'bio|kinder|baby|quetsch|mango|banane|erdbeer|birne|zimt.*bio|ohne zucker.*bio', 350, 800],
  lasagne: ['lasagne(blätter|platten| blätter| platten)|lasagne$|lasagnette', 'bio|vollkorn|dinkel|fertig|bolognese|gemüse|spinat|tk|tiefkühl|vegan|veggie|lachs|al forno|käse|sauce|soße|gericht|portion', 250, 500],
  suppennudeln: ['suppennudeln|fadennudeln|suppen-nudeln|buchstaben', 'free from|glutenfrei|bio|vollkorn|dinkel|instant|huhn|hühner|rind|suppe mit|cup|becher|tasse|fertig', 200, 500],
  fischstaebchen: ['fischstäbchen', 'bio|vegan|veggie|mini|burger|wrap|käse|kinder', 300, 600],
  blaetterteig: ['blätterteig', 'bio|vegan|dinkel|vollkorn|tasche|gefüllt|strudel|schnecke|stange|kipferl|brezel|croissant|plunder|torte|apfel|topfen|spinat|schinken|käse|würstel|pizza|snack|mini|quadrate|eckerl', 250, 300],
  erbsen: ['erbsen', 'zucker|kicher|mais|karotten|gemüse|mix|dose|glas|getrocknet|trocken|schäl|split|gelb|grün.*bio|bio|nudel|pasta|chips|snack|wasabi|protein|mehl|suppe|eintopf|püree|creme|risotto|pfanne|knödel|reis|crunchy|geröstet|snap|zuckerschoten|schoten|edamame', 400, 1000],
  spinat: ['blattspinat|spinat', 'rahm|cremespinat|stangen|frisch|baby|salat|knödel|nockerl|nudel|pasta|ravioli|tortellini|lasagne|gnocchi|pizza|strudel|lachs|tasche|creme|suppe|feta|schafkäse|käse|ricotta|topfen|kroketten|laibchen|burger|bratling|wrap|tortilla|blätterteig|pide|börek|burek|knusper|mix|gemüse|pfanne|smoothie|saft|spätzle|chips|kräuter|zwiebel|pesto|aufstrich|quiche|dip|sauce|omelett|eier|wildspinat|junger|portionen|portion|gehackt|passiert|püree', 400, 1000],
  wokgemuese: ['wok', 'pfanne|sauce|soße|nudel|noodle|reis|huhn|hühner|hendl|garnele|shrimp|rind|schwein|ente|tofu|teriyaki|curry|sweet|chili|kit|box|set|öl|würz|gewürz|marinade|paste|bio|asia|frisch|kühl|fertig|thai|mie|udon|ramen|instant|becher|cup|topf|wokpfanne|wender|löffel|spatel', 500, 1000],
  lachs: ['lachsfilet|lachs filet|lachsportion', 'deluxe|forelle|räucher|geräuchert|graved|gebeizt|kalt|aufstrich|creme|dip|filet.*(frisch|natur.*frisch)|frisch|kühl|bio|wildlachs.*(dose|glas)|dose|glas|forelle|ersatz|vegan|lachsersatz|lachsschinken|schinken|wurst|katze|hund|futter|sushi|wrap|salat|nudel|pasta|lasagne|pizza|quiche|tasche|strudel|bagel|sandwich|brötchen|toast|burger|bratling|laibchen|stäbchen|nuggets|panier|knusper|backfisch|sauce|soße|pesto|kaviar|rogen|chips|snack|happen|carpaccio|tatar|tartar|terrine|pastete|mousse|rillettes|cracker|kroketten|frikadellen|fischstäbchen|spieße|spiess|würfel|stücke|streifen|scheiben|kräuter|zitrone|pfeffer|teriyaki|honig|senf|dill|spinat|gemüse|reis|nudeln|gratin|ofen|grill|tasche|rolle|roll', 200, 500],
  garnelen: ['garnelen|shrimps|crevetten|riesengarnelen|king prawns|prawns', 'provencale|chips|cracker|snack|salat|sauce|soße|cocktail|paste|nudel|pasta|reis|pfanne|pizza|sushi|wrap|suppe|dim sum|frühlingsrolle|spring roll|tempura|panier|knusper|chili|knoblauch|kräuter|mariniert|gegrillt|spieße|spiess|bio|vegan|frisch|kühl|glas|dose|lake|getrocknet|curry|teriyaki|gemüse|tasche|ravioli|tortellini|dumpling|gyoza|wan tan|wonton|krabben|nordsee|cocktailgarnelen', 150, 500],

  // Erweiterung: Zutaten der großen Rezeptsammlung
  rotkraut: ['rotkraut|blaukraut', 'glas|dose|apfel|fertig|gekocht|salat|tk|tiefkühl', 500, 1500],
  kohlrabi: ['kohlrabi', 'tk|tiefkühl|salat|mix|mini|broccoli|brokkoli', 1, 1],
  roteRueben: ['rote rüben|rote bete|rote beete', 'streifen|efko|saft|salat|chips|glas|dose|aufstrich|carpaccio|eingelegt|scheiben|würfel.*(essig)|essig', 300, 1000],
  sellerie: ['sellerie', 'geschnitten|stangen|staude|salz|salat|saft|chips|samen|gewürz|suppe|tk|tiefkühl', 300, 1000],
  fenchel: ['^(\\S+ )?fenchel', 'tee|samen|gewürz|salami|honig|bonbon', 1, 1],
  chinakohl: ['chinakohl|chinakraut', 'salat|kimchi', 1, 1],
  suesskartoffel: ['süßkartoffel|süsskartoffel', 'beneful|huhn|rind|lachs|mit |pommes|chips|püree|tk|tiefkühl|wedges|suppe|snack|creme|würfel', 500, 2000],
  avocado: ['avocado', 'öl|creme|dip|guacamole|aufstrich|mini|snack|maske|toast|sushi|salat', 1, 3],
  limette: ['limette', 'saft|limo|sirup|eis|blätter|tee|aroma|zitrone|gin|joghurt|chips|wasser|getränk|minze|ingwer|chili|pfeffer|salz|dressing|mayo|kekse|torte', 2, 6],
  basilikum: ['basilikum', 'getrocknet|tk|tiefkühl|pesto|öl|sauce|soße|streuer|paste|tomate|paradeiser|mozzarella|samen|gewürz|würz|gefrier|dip|creme|frischkäse|käse|nudel|pasta|chips|cracker|limo', 1, 1],
  rucola: ['rucola', 'pesto|salatmix|mix|pizza|käse|aufstrich|tomate|paradeiser|creme|chips|dip', 80, 200],
  aepfel: ['(^|\\s)äpfel|^(\\S+ )?apfel\\b', 'erdäpfel|erd|saft|mus|mark|chips|ring|kuchen|strudel|tee|essig|schorle|getrocknet|kompott|tasche|cider|most|riegel|joghurt|sirup|nektar|zimt|marmelade|gelee|baby|frucht|creme|torte|puree|püree|quetsch|knödel|rotkraut|blaukraut|keks|wein|limo|mini|snack|dörr|stück|scheiben|schnitz|pfannkuchen|kren|meerrettich|bonbon|gummi|kau|duft|shampoo|seife', 750, 2500],
  bananen: ['^(\\S+ )?bananen?\\b', 'chips|saft|milch|joghurt|getrocknet|brot|mini|kinder|smoothie|riegel|quetsch|schoko|keks|chip|nektar|shake|drink|eis|kuchen|baby|split|frucht', 700, 1500],
  spinatFrisch: ['babyspinat|jungspinat|blattspinat.*frisch|spinat.*frisch|baby spinat', 'tk|tiefkühl|salatmix|mix|rahm|creme|pizza|knödel|nockerl|tortellini|ravioli|strudel|lasagne|feta|käse', 100, 300],
  rotezwiebel: ['rote zwiebel|zwiebel rot|rote speisezwiebel', 'chips|gewürz|röst|creme|aufstrich|eingelegt|chutney|marmelade|konfitüre|confit|ring|würfel|dip|salat|baguette|brot|tk|tiefkühl', 300, 1500],
  chilischote: ['chilischote|chili schote|peperoni|pfefferoni|chili rot|chili grün|^(\\S+ )?chili$', 'pulver|flocken|gewürz|sauce|soße|öl|con|sin|carne|chips|getrocknet|eingelegt|glas|essig|salami|wurst|käse|creme|paste|gefüllt|mild|süß|sweet|frischkäse|pizza|würz', 1, 150],
  frischkaese: ['frischkäse', 'kräuter|knoblauch|schnittlauch|paprika|chili|honig|feige|lachs|meerrettich|kren|pfeffer|walnuss|tomate|olive|light|leicht|vegan|laktosefrei|ziege|schaf|dip|aufstrich|snack|balance|0,2|0\\.2|protein|mini|portion|mediterran|curry|feta|bärlauch|joghurt|fitline|zwiebel|gurke|rucola|basilikum|trüffel|mango|beere|erdbeer|preisel|cranberr|dattel|ananas|pfirsich|marille|kirsch|himbeer|balkan|grill|ofen|salz|würfel|rolle|taler|gourmet|schoko|kakao|zimt|vanille|rahm.*(stufe)', 150, 300],
  gouda: ['gouda', 'gerieben|laktosefrei|light|leicht|würfel|sticks|snack|mini|ziege|schaf|kräuter|pikant|chili|bärlauch|pfeffer|alt|block|stück|ganz|laib|kugel|vegan|räucher|geräuchert|bockshorn|kümmel|trüffel|pesto|tomate|basilikum|knoblauch|zwiebel|walnuss|honig|senf|scheibletten|toast', 100, 250],
  halloumi: ['halloumi|grillkäse', 'chili|kräuter|minze|vegan|burger|spieß|würfel|knoblauch|paprika|pfeffer|mediterran|bärlauch|tomate|honig|feige|mariniert|light|leicht|snack|sticks|fries|panko|paniert', 150, 300],
  ricotta: ['ricotta', 'sugo|pomodoro|ravioli|tortellini|pasta|nudel|spinat|cannelloni|cheesecake|kuchen|torte|salata|gnocchi|creme|dessert|tiramisu|zitrone|honig', 200, 300],
  hafermilch: ['haferdrink|hafer drink|hafer-drink|oat drink|oatly', 'barista|kakao|schoko|vanille|kaffee|latte|joghurt|kinder|protein|eis|riegel|flocken|keks|cappuccino|karamell|caramel|mandel|soja|reis|kokos|cashew|haselnuss|erbse|zimt|matcha|chai|banane|erdbeer|portion|mini|skinny|light|leicht|ohne zucker|zuckerfrei|calcium|cream|creme|kochen|cuisine|sahne|obers|fraiche', 900, 1100],
  pizzateig: ['pizzateig|pizza teig|pizza-teig|pizzaboden', 'vollkorn|dinkel|glutenfrei|tk|tiefkühl|salami|schinken|margherita|mischung|backmischung|mehl|kit|set|vegan|fertig|belegt|tomate|käse|mini|snack|hefe|flammkuchen|blech.*(xxl)', 300, 600],
  strudelteig: ['strudelteig|strudelblätter|filoteig|yufka', 'vollkorn|dinkel|gefüllt|apfel|topfen|gemüse|spinat|strudel mit|fertig|käse|fleisch|kraut|kürbis|lauch|schinken|tk|tiefkühl', 120, 500],
  tortellini: ['(tortellini|tortelloni|ravioli|girasoli|cappelletti).*(käse|formaggi|ricotta|formaggio)|(käse|formaggi|ricotta|formaggio).*(tortellini|tortelloni|ravioli|girasoli|cappelletti)', 'fleisch|schinken|prosciutto|rind|huhn|hühner|salami|speck|bolognese|lachs|garnel|pilz|steinpilz|trüffel|spinat|kürbis|tomate|paradeiser|vegan|vollkorn|dinkel|dose|getrocknet|suppe|sauce|soße|gericht|tk|tiefkühl|glutenfrei|chili|basilikum|pesto|walnuss|birne|ziegen|bärlauch|zucchini|paprika|gorgonzola|mozzarella|ricotta.*spinat|mascarpone|zitrone|pfeffer|aubergine|melanzani|artischocke|kräuter', 200, 500],
  schupfnudeln: ['schupfnudeln|bubespitzle|fingernudeln|kartoffelnudeln', 'kraut|sauerkraut|speck|pfanne|gericht|mohn|süß|tk|tiefkühl|glutenfrei|fertig|zimt|butter|bröseln|vanille|zwetschke|marille|apfel|schoko', 300, 600],
  raeuchertofu: ['räuchertofu|tofu geräuchert|geräucherter tofu|tofu.*(räucher|smoked|geräuchert)', 'kichererbse|würstel|wurst|aufstrich|mandel|sesam|nuss|burger|bratling|chili|curry|paprika|kräuter|basilikum|olive|tomate|knoblauch|pfeffer|schinken|speck|streifen|würfel|aufschnitt|scheiben|salami|teriyaki|bbq', 150, 250],
  schnitzelfleisch: ['schweinsschnitzel|schweineschnitzel|schnitzel vom schwein|schweinsschnitzerl|schnitzelfleisch|schwein.*schnitzel|schweinefleisch.*schnitzel|schweinsfilet', 'paniert|panier|gebacken|cordon|wiener art|gefüllt|gewürzt|mariniert|grill|tk|tiefkühl|vegan|veggie|pute|puten|hühner|hendl|huhn|kalb|kinder|mini|fertig|knusp|brot|semmel|gyros|kebab|steak.*(pfeffer)|pfeffer|natur.*(gewürzt)|bbq|kräuter|knoblauch|paprika|chili|zigeuner|jäger|rahm', 300, 800],
  hendlkeulen: ['hendlkeule|hühnerkeule|hähnchenkeule|hühnerhaxe|hendlhaxe|hühnerschenkel|hendlschenkel|hähnchenschenkel|hendlhaxerl|hühnerunterkeule|hendlunterkeule|hendl-keule|hühner-keule|drumsticks|hendl ?haxerl', 'paniert|gebacken|gegrillt|mariniert|bbq|grill|tk|tiefkühl|knusp|nuggets|wings|flügel|fertig|gewürzt|vegan|veggie|gebraten|brathendl|chili|paprika|kräuter|knoblauch|curry|tandoori|teriyaki|honig|senf|würz|gyros|kebab|spieß|filet', 600, 1500],
  putenbrust: ['putenbrust|putenschnitzel|truthahnbrust|putenfilet|truthahnschnitzel|putenbrustfilet', 'aufschnitt|schinken|scheiben|geräuchert|gegrillt|gebraten|paniert|mariniert|wurst|tk|tiefkühl|knusp|nuggets|curry|gyros|kebab|döner|gewürzt|kräuter|pfeffer|paprika|chili|knoblauch|honig|senf|bbq|teriyaki|würz|cordon|gefüllt|wiener|gebacken|streichwurst|pastete|salami|leberkäse|frankfurter|würstel|räucher|natur.*(gewürzt)|streifen|geschnetzelt|spieß|mini|kinder|aufschnitt|light|leicht|ofen|braten|roll', 300, 700],
  leberkaese: ['leberkäse|leberkas|fleischkäse|leberkässemmel', 'pizza|semmel|käseleberkäse|käse-leberkäse|käse leberkäse|scheiben|aufschnitt|pute|puten|hendl|huhn|veggie|vegan|mini|dose|fertig|chili|pikant|paprika|pfefferoni|spinat|bärlauch|kürbis|röst|toast|brot|burger', 200, 600],
  bratwurst: ['bratwurst|bratwürstel|rostbratwurst|nürnberger|bratwürste', 'curry|käse|vegan|veggie|pute|puten|hendl|huhn|grill.*set|mini|dose|glas|sauerkraut|fertig|semmel|pizza|chili|bärlauch|kalb|lamm|rind|wild|hirsch|reh|cevapcici|käsekrainer|krainer|debreziner|knacker|weißwurst|weisswurst|bio|scharf|pikant|kräuter|zwiebel|paprika|jalapeño|jalapeno|trüffel|whisky|bier|knoblauch|spieß|snack|sticks|cocktail', 200, 600],
  seelachs: ['seelachs|alaska-seelachs|alaska seelachs|kohlenfisch', 'paniert|panier|backfisch|schlemmer|bordelaise|toskana|stäbchen|burger|nuggets|knusp|räucher|geräuchert|dose|salat|aufstrich|mediterran|kräuter|zitrone|gratin|à la|a la|sauce|soße|crunch|sticks|gemüse|spinat|brokkoli|tomate|paradeiser|käse|knoblauch|senf|dill|curry|chili|teig|bier|filet.*(natur.*(sauce))|ofen|backofen|pfanne|schnitzel|creme|rahm|pesto|gourmet', 250, 600],
  haferflocken: ['haferflocken', 'müsli|riegel|keks|cookies|drink|glutenfrei|schoko|frucht|baby|kinder|porridge|instant|protein|beere|apfel|zimt|banane|honig|nuss|kakao|vanille|joghurt|kleie|mix|crunch|knusper|kerne|samen|chia|leinsamen|früchte|getreide.*mix|dinkel|roggen|gerste|reis|hirse|buchweizen|cups|becher|portion', 400, 1000],
  polenta: ['polenta|maisgrieß|maisgries', 'fertig|schnitten|kräuter|käse|tomate|steinpilz|glutenfrei|gebraten|grill|chips|cracker|snack|riegel|pizza|tk|tiefkühl|gnocchi|knödel|nockerl|brot|tortilla|mehl', 250, 1000],
  griess: ['weizengrieß|weizengries|hartweizengrieß|hartweizengries|^(\\S+ )?grieß$|^(\\S+ )?gries$|grieß fein|gries fein', 'mais|dinkel|brei|pudding|nockerl|suppe|schmarrn|kinder|baby|milch|vollkorn|instant|knödel|dessert|schoko|vanille|kakao|zimt|frucht|portion|becher|cups|schnitten|auflauf|koch', 400, 1000],
  bulgur: ['bulgur', 'salat|fertig|gericht|kräuter|tomate|paradeiser|gemüse|tasse|cup|kochbeutel|beutel.*(koch)|pfanne|würz|gewürz|mix|chili|paprika|zwiebel|minze|petersilie|tabouleh|tabbouleh|bowl|snack', 400, 1000],
  quinoa: ['^(\\S+ )?quinoa', 'activia|joghurt|brot|schär|salat|fertig|gericht|kräuter|tomate|paradeiser|gemüse|tasse|cup|riegel|chips|crunchy|pops|flocken|mehl|mix|kochbeutel|gepufft|bowl|snack|pfanne|chili|bulgur|reis|linsen|couscous|amaranth|chia|nudel|pasta|burger|bratling|knusper|müsli|cracker|waffel|pfann', 250, 600],
  reisnudeln: ['reisnudeln|reis nudeln|reisbandnudeln|rice noodles|glasnudeln|reis-nudeln|reisvermicelli', 'suppe|instant|cup|becher|pfanne|gericht|fertig|chili|huhn|hühner|curry|tom yum|vollkorn|salat|snack|chips|cracker|ente|rind|garnel|shrimp|gemüse|würz|gewürz|sauce|soße|pad thai|kit|set|box|bowl|mix|frühlingsrolle|spring', 150, 500],
  mienudeln: ['mie[- ]?nudeln|mie nudeln|wok-nudeln|woknudeln|chow mein|eiernudeln asia|asia.*eiernudeln', 'suppe|instant|cup|becher|pfanne|gericht|fertig|chili|huhn|hühner|curry|ente|rind|garnel|shrimp|vollkorn|udon|soba|reis|glas|yum|ramen|gemüse|würz|gewürz|sauce|soße|teriyaki|sweet|kit|set|box|bowl|mix|snack|chips|tk|tiefkühl|frisch|knoblauch|sesam|soja', 200, 600],
  weisseBohnen: ['weiße bohnen|weisse bohnen|cannellini|bohnen weiß|weiße riesenbohnen|riesenbohnen|weiße bohnenkerne|bohnen,? weiß', 'tomaten|paradeiser|sauce|soße|speck|baked|chili|salat|eintopf|suppe|getrocknet|trocken|grill|mexikan|kräuter|würz|gewürz|creme|aufstrich|dip|hummus|humus|püree|mus|nudel|pasta|knoblauch|zwiebel|paprika|gigantes|bbq', 300, 450],
  cashews: ['cashew', 'truffle|tasty|granola|creme|mus|butter|drink|joghurt|honig|salz|gesalzen|chili|wasabi|mix|riegel|schoko|karamell|caramel|cookie|geröstet.*(salz|würz)|würz|paprika|bbq|curry|käse|vegan|trail|studenten|pesto|aufstrich|kakao|zimt|vanille|ahorn|mango|cranberr|dattel|kokos|limette|zitrone|pfeffer|knoblauch|sesam|soja|teriyaki|trüffel|rosmarin|kräuter|dragee|zucker|glasiert|gebrannt|kandiert|snack|nuss.*mix|frucht|eis|torte|kuchen|keks|waffel', 150, 300],
  walnuesse: ['walnuss|walnüsse|walnusskerne', 'fülle|füllung|öl|brot|kuchen|torte|honig|schoko|karamell|riegel|mix|studenten|eis|likör|kipferl|keks|aufstrich|in schale|schale|ganz|pesto|käse|joghurt|frischkäse|creme|mus|gouda|camembert|brie|salami|wurst|schinken|kranz|strudel|stollen|beugel|zopf|kekse|cookie|cracker|müsli|granola|crunch|knusper|dragee|zucker|glasiert|kandiert|gebrannt|snack|frucht|cranberr|dattel|feige|rosine|apfel|birne|zimt|vanille|ahorn|chili|salz|gesalzen', 100, 300],
  erdnuesse: ['erdnüsse|erdnusskerne|^(\\S+ )?erdnuss$|erdnüsse geröstet|erdnüsse gesalzen', 'butter|mus|creme|schoko|flips|locken|honig|chili|wasabi|bbq|paprika|teig|mantel|mix|riegel|studenten|in schale|schale|sauce|soße|öl|snack|cracker|keks|eis|curry|karamell|caramel|zucker|dragee|backmischung|protein|knabber|cocktail|würz|gewürz|knoblauch|zwiebel|käse|sour|essig|rosmarin|pfeffer|limette|kokos|sesam|soja|teriyaki|thai|trüffel|ungesalzen.*bio', 150, 300],
  rosinen: ['rosinen|sultaninen|korinthen', 'schoko|joghurt|brot|kuchen|stollen|mix|studenten|müsli|rum|keks|cookie|riegel|snack|weck|schnecke|kipferl|zopf|striezel|gugelhupf|torte|strudel|knödel|schmarrn|reis|creme|eis|pudding|likör|wein|traube|cranberr|nuss|mandel|walnuss|hasel|cashew|pistazie|dattel|feige|marille|aprikose|pflaume|zwetschke|apfel|birne|banane|mango|ananas|papaya|kokos|ingwer|zimt|vanille|honig', 150, 500],
  broesel: ['semmelbrösel|paniermehl|^(\\S+ )?brösel$|bröseln$', 'panko|dinkel|vollkorn|glutenfrei|knödel|nockerl|würz|kräuter|käse|knusper|zimt|mohn|nuss|butter|backmischung|panade.*(würz)|süß|zucker|keks|kuchen|torte|strudel', 300, 1000],
  tahini: ['tahin|tahini|sesammus|sesampaste|sesam mus|sesam-mus', 'salat|kichererbse|hummus|humus|aufstrich|sauce|soße|dressing|halva|halwa|helva|schoko|kakao|honig|riegel|creme|dip|dattel|zimt|vanille|nuss|mandel|erdnuss|cashew|kokos|mix|snack|keks|cracker|brot|bagel|würz|gewürz|chili|knoblauch|zitrone|kräuter', 200, 400],
  getrTomaten: ['getrocknete tomaten|tomaten getrocknet|getrocknete paradeiser|pomodori secchi|sonnengetrocknete tomaten|tomaten.*sonnengetrocknet|soft tomaten', 'pesto|aufstrich|creme|dip|sauce|soße|brot|ciabatta|focaccia|chips|cracker|käse|frischkäse|salami|wurst|nudel|pasta|gewürz|würz|mix|pulver|flocken|risotto|couscous|bulgur|pizza|tapenade|salat|antipasti|mozzarella|basilikum.*(pesto)|kräuter.*(salz)|salz|oliven|feta|schafkäse|ricotta|gnocchi|tortellini|ravioli|knödel|aufstrich|hummus|humus|snack|stick|grissini|taralli|wrap|tortilla|burger|bratling|reis', 150, 400],
  kapern: ['kapern', 'äpfel|apfel|beeren|beere|sauce|soße|creme|dip|butter|aufstrich|thunfisch|sardellen|oliven|mix|antipasti|frucht|tapenade|pesto|remoulade|mayo|dressing|senf|essig.*(gurken)|gurken|zwiebel|paprika|peperoni|pfefferoni|artischocke|tomate|paradeiser|knoblauch|chili|kräuter|zitrone|salz.*(meer)|wurst|salami|käse|schafkäse|feta', 50, 250],
  zartbitter: ['zartbitter|bitterschokolade|dunkle schokolade|edelbitter|kochschokolade|blockschokolade|backschokolade|zartbitterschokolade', 'nuss|haselnuss|mandel|orange|minze|mint|chili|meersalz|salz|karamell|caramel|kokos|keks|cookie|riegel|praline|drops|glasur|kuvertüre|joghurt|frucht|erdbeer|himbeer|kirsch|marzipan|nougat|crisp|crunch|knusper|waffel|mousse|pudding|creme|getränk|drink|eis|torte|kuchen|muffin|vegan|zucker ?frei|ohne zucker|mini|stick|kakao|ingwer|pfeffer|lebkuchen|weihnacht|advent|figur|cranberr|mango|maracuja|banane|apfel|birne|vanille|espresso|kaffee|cappuccino|rum|whisky|likör|limette|zitrone|honig|tropfen|selection|mix|chips|raspel|streusel|flocken|blätter|herz|kugel|taler|täfelchen|sticks|stäbchen|bites|pops|kekse|zwieback|lebkuchen|ecken|happen|schnitte|dragee|rosinen|cornflakes|reis|quinoa|chia|protein|keto|light|leicht|stevia|xylit|erythrit|99|90|85|81|80|75', 80, 200],
  pommes: ['pommes|frites', 'süßkartoffel|süsskartoffel|wedges|kroketten|rösti|herzoginnen|würz|gewürz|salz|chips|sauce|soße|mayo|ketchup|mix|curly|spiral|paprika|chili|käse|gourmet|steak|gerillt|waffel|kinder|smiley|mini|stick|rosmarin|trüffel|knoblauch|gewürzt|seasoned|crispy|extra|sweet|dip|gabel|schale|tüte|frittierfett|fett|öl|halb|teller', 600, 2500],
  beeren: ['beerenmischung|beerenmix|beeren-mix|beeren mix|waldbeeren|beerenauslese|beerenfrüchte|beeren-mischung|früchte.*beeren', 'saft|sirup|joghurt|müsli|tee|marmelade|konfitüre|gelee|eis|torte|kuchen|riegel|getrocknet|smoothie|drink|limo|nektar|schoko|keks|kompott|zubereitung|grütze|creme|dessert|mousse|wein|likör|essig|quetsch|pudding|auslese|frisch|topfen|quark|skyr|kefir|buttermilch|milch|shake|bowl|granola|crunch|knusper|cookie|muffin|waffel|schnitte|strudel|knödel|fruchtaufstrich|aufstrich|bonbon|gummi|frucht ?gummi|kaugummi|tee|sorbet|cassis|holunder', 250, 750],
  kaisergemuese: ['kaisergemüse|kaiser gemüse|gemüsemischung kaiser|kaiser-gemüse|brokkoli.*karfiol.*karotte|karfiol.*brokkoli.*karotte', 'rahm|sauce|soße|creme|pfanne|reis|nudel|suppe|gratin|auflauf|dose|glas|mexikan|asia|wok|italien|mediterran|grill|ofen|salat|chips|mais|paprika|kräuter|butter', 450, 1100],
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
  // Flugblatt-Aktionen (marktguru) drüberlegen; scheitert das, bleiben die Regalpreise.
  try {
    const mg = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3])) : await fetchAll();
    const regular = (store, id) => {
      const real = out.stores[store] && out.stores[store].items[id], ing = D.INGREDIENTS[id];
      if (real) return real.price / real.qty;
      const st = D.STORES.find(s => s.id === store);
      return ing.price * st.priceFactor / ing.packQty;
    };
    const offers = matchOffers(mg, RULES, X, regular, out.fetched);
    for (const [store, items] of Object.entries(offers)) {
      out.stores[store] ||= { asOf: out.fetched, offersOnly: true, items: {} };
      Object.assign(out.stores[store].items, items);
      console.error(store, Object.keys(items).length, 'Aktionen:', Object.keys(items).join(', '));
    }
    out.source += ' + marktguru.at';
  } catch (e) { console.error('Aktionen übersprungen:', e.message); }
  fs.writeFileSync(__dirname + '/../prices.json', JSON.stringify(out, null, 1));
}
module.exports = { RULES, pick, offerWas };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
