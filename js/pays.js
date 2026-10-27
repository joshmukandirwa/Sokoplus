/* Pays d'Afrique : nom, monnaie locale et villes principales.
   Pour ajouter un pays ou une ville, il suffit d'ajouter une ligne ici. La RDC reste le pays par défaut. */
export const DEFAULT_COUNTRY = "CD";
export const OTHER_CITY = "Autre ville";
// [code, nom, monnaie, [villes]]
export const COUNTRIES = [
  ["CD", "RD Congo", "CDF", ["Kinshasa", "Lubumbashi", "Goma", "Bukavu", "Kisangani", "Mbuji-Mayi", "Kolwezi", "Likasi", "Matadi", "Butembo", "Uvira", "Kananga", "Tshikapa", "Bunia", "Mbandaka", "Beni", "Kalemie"]],
  ["RW", "Rwanda", "RWF", ["Kigali", "Gisenyi", "Butare", "Musanze", "Rusizi"]],
  ["BI", "Burundi", "BIF", ["Bujumbura", "Gitega", "Ngozi"]],
  ["UG", "Ouganda", "UGX", ["Kampala", "Entebbe", "Gulu", "Mbarara", "Jinja"]],
  ["KE", "Kenya", "KES", ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret"]],
  ["TZ", "Tanzanie", "TZS", ["Dar es Salaam", "Dodoma", "Arusha", "Mwanza", "Zanzibar"]],
  ["CG", "Congo-Brazzaville", "XAF", ["Brazzaville", "Pointe-Noire", "Dolisie"]],
  ["AO", "Angola", "AOA", ["Luanda", "Huambo", "Lobito", "Benguela"]],
  ["ZM", "Zambie", "ZMW", ["Lusaka", "Ndola", "Kitwe", "Livingstone"]],
  ["ZW", "Zimbabwe", "ZWL", ["Harare", "Bulawayo", "Mutare"]],
  ["MZ", "Mozambique", "MZN", ["Maputo", "Beira", "Nampula"]],
  ["MW", "Malawi", "MWK", ["Lilongwe", "Blantyre"]],
  ["ZA", "Afrique du Sud", "ZAR", ["Johannesburg", "Le Cap", "Durban", "Pretoria"]],
  ["NA", "Namibie", "NAD", ["Windhoek", "Walvis Bay"]],
  ["BW", "Botswana", "BWP", ["Gaborone", "Francistown"]],
  ["SZ", "Eswatini", "SZL", ["Mbabane", "Manzini"]],
  ["LS", "Lesotho", "LSL", ["Maseru"]],
  ["MG", "Madagascar", "MGA", ["Antananarivo", "Toamasina", "Mahajanga"]],
  ["MU", "Maurice", "MUR", ["Port-Louis"]],
  ["SC", "Seychelles", "SCR", ["Victoria"]],
  ["KM", "Comores", "KMF", ["Moroni"]],
  ["ET", "Éthiopie", "ETB", ["Addis-Abeba", "Dire Dawa", "Hawassa"]],
  ["ER", "Érythrée", "ERN", ["Asmara"]],
  ["DJ", "Djibouti", "DJF", ["Djibouti"]],
  ["SO", "Somalie", "SOS", ["Mogadiscio", "Hargeisa"]],
  ["SS", "Soudan du Sud", "SSP", ["Juba"]],
  ["SD", "Soudan", "SDG", ["Khartoum", "Omdurman"]],
  ["EG", "Égypte", "EGP", ["Le Caire", "Alexandrie", "Gizeh"]],
  ["LY", "Libye", "LYD", ["Tripoli", "Benghazi"]],
  ["TN", "Tunisie", "TND", ["Tunis", "Sfax", "Sousse"]],
  ["DZ", "Algérie", "DZD", ["Alger", "Oran", "Constantine"]],
  ["MA", "Maroc", "MAD", ["Casablanca", "Rabat", "Marrakech", "Tanger"]],
  ["MR", "Mauritanie", "MRU", ["Nouakchott"]],
  ["SN", "Sénégal", "XOF", ["Dakar", "Thiès", "Saint-Louis"]],
  ["GM", "Gambie", "GMD", ["Banjul", "Serrekunda"]],
  ["GW", "Guinée-Bissau", "XOF", ["Bissau"]],
  ["GN", "Guinée", "GNF", ["Conakry", "Kankan"]],
  ["SL", "Sierra Leone", "SLE", ["Freetown"]],
  ["LR", "Liberia", "LRD", ["Monrovia"]],
  ["CI", "Côte d'Ivoire", "XOF", ["Abidjan", "Bouaké", "Yamoussoukro", "San-Pédro"]],
  ["GH", "Ghana", "GHS", ["Accra", "Kumasi", "Tamale"]],
  ["TG", "Togo", "XOF", ["Lomé", "Kara"]],
  ["BJ", "Bénin", "XOF", ["Cotonou", "Porto-Novo", "Parakou"]],
  ["NG", "Nigéria", "NGN", ["Lagos", "Abuja", "Kano", "Port Harcourt", "Ibadan"]],
  ["NE", "Niger", "XOF", ["Niamey"]],
  ["BF", "Burkina Faso", "XOF", ["Ouagadougou", "Bobo-Dioulasso"]],
  ["ML", "Mali", "XOF", ["Bamako", "Sikasso"]],
  ["TD", "Tchad", "XAF", ["N'Djamena", "Moundou"]],
  ["CM", "Cameroun", "XAF", ["Douala", "Yaoundé", "Garoua", "Bafoussam"]],
  ["CF", "Centrafrique", "XAF", ["Bangui"]],
  ["GQ", "Guinée équatoriale", "XAF", ["Malabo", "Bata"]],
  ["GA", "Gabon", "XAF", ["Libreville", "Port-Gentil"]],
  ["ST", "Sao Tomé-et-Principe", "STN", ["São Tomé"]],
  ["CV", "Cap-Vert", "CVE", ["Praia", "Mindelo"]]
];
export const byCode = c => COUNTRIES.find(x => x[0] === c) || COUNTRIES[0];
export const countryName = c => byCode(c)[1];
export const citiesOf = c => [...byCode(c)[3], OTHER_CITY];
export const countryOf = it => it.country || DEFAULT_COUNTRY;   // les anciens articles sont tous en RDC

// Monnaies proposées au vendeur : celle de son pays, le dollar et l'euro.
// « FC » est conservé tel quel pour le franc congolais (anciens articles).
export const codeOf = cur => cur === "FC" ? "CDF" : cur;
export const storeCur = code => code === "CDF" ? "FC" : code;
export const currenciesOf = c => [...new Set([byCode(c)[2], "USD", "EUR"])].map(storeCur);
export const ALL_CURRENCIES = [...new Set([...COUNTRIES.map(x => x[2]), "USD", "EUR"])].map(storeCur);
const NAMES = { USD: "Dollars (USD)", EUR: "Euros (EUR)", FC: "Francs congolais (FC)", RWF: "Francs rwandais (RWF)", BIF: "Francs burundais (BIF)", XOF: "Francs CFA (XOF)", XAF: "Francs CFA (XAF)" };
export const curName = cur => NAMES[cur] || `${cur}`;
// Valeurs approximatives en dollars : elles servent seulement à classer des prix de monnaies différentes, jamais à afficher.
const PER_USD = { USD: 1, EUR: .92, FC: 2800, RWF: 1400, BIF: 2900, UGX: 3700, KES: 129, TZS: 2600, XAF: 600, XOF: 600, AOA: 912, ZMW: 27, ZWL: 26, MZN: 64, MWK: 1750, ZAR: 18, NAD: 18, BWP: 13.7, SZL: 18, LSL: 18, MGA: 4500, MUR: 45, SCR: 14, KMF: 450, ETB: 120, ERN: 15, DJF: 178, SOS: 570, SSP: 4500, SDG: 600, EGP: 48, LYD: 4.8, TND: 3.1, DZD: 134, MAD: 10, MRU: 40, GMD: 70, GNF: 8600, SLE: 23, LRD: 190, GHS: 15, NGN: 1500, STN: 22, CVE: 100 };
export const toUsd = (price, cur) => price / (PER_USD[cur] || 1);
export const decimalsOf = cur => (PER_USD[cur] || 1) >= 100 ? 0 : 2;
