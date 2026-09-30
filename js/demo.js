/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — demo.js  (version MaxiCoffee)
   Données de démonstration : une enseigne de machines à café,
   cafés et accessoires (MaxiCoffee) avec 35 produits illustrés,
   6 fournisseurs fictifs, 4 emplacements, 4 mois d'historique
   RÉALISTE généré par le vrai moteur de mouvements (stock avant/
   après cohérent), commandes (livraison partielle, une en route
   et une en retard)
   et inventaires. L'état final correspond exactement au tableau
   « Produits et références » fourni (stock, seuil, valeur, niveau).
   Les photos sont les illustrations 01 à 35, dessinées en SVG
   directement dans ce fichier (aucune image externe à charger).
   Tout est marqué « demo: true » et peut être supprimé en un clic
   sans toucher aux données réelles.
   ██████████████████████████████████████████████████████████████ */
"use strict";

/* ═════════ ILLUSTRATIONS MAXICOFFEE (identiques aux images 01 à 35) ═════════
   Encapsulées dans MC_ART pour ne créer aucune variable globale en conflit. */
const MC_ART = (() => {
  const W = 1024;
  const INOX = `<linearGradient id="inox" x1="0" x2="1"><stop offset="0" stop-color="#6f7780"/><stop offset=".18" stop-color="#e9edf1"/><stop offset=".45" stop-color="#aab2ba"/><stop offset=".7" stop-color="#f4f6f8"/><stop offset="1" stop-color="#737b84"/></linearGradient>
  <linearGradient id="inoxV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset="1" stop-color="#8d959e"/></linearGradient>
  <linearGradient id="gold" x1="0" x2="1"><stop offset="0" stop-color="#9c7424"/><stop offset=".35" stop-color="#f4d999"/><stop offset=".65" stop-color="#d4a94f"/><stop offset="1" stop-color="#8a651d"/></linearGradient>
  <linearGradient id="blk" x1="0" x2="1"><stop offset="0" stop-color="#0d0d0f"/><stop offset=".35" stop-color="#3a3a40"/><stop offset=".6" stop-color="#1c1c20"/><stop offset="1" stop-color="#060607"/></linearGradient>
  <linearGradient id="cream" x1="0" x2="1"><stop offset="0" stop-color="#cdbfa6"/><stop offset=".4" stop-color="#fbf5ea"/><stop offset="1" stop-color="#bfb09a"/></linearGradient>
  <linearGradient id="wood" x1="0" x2="1"><stop offset="0" stop-color="#4a2a17"/><stop offset=".4" stop-color="#9a6337"/><stop offset="1" stop-color="#3d2212"/></linearGradient>
  <linearGradient id="glass" x1="0" x2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".10"/><stop offset=".2" stop-color="#ffffff" stop-opacity=".45"/><stop offset=".35" stop-color="#ffffff" stop-opacity=".08"/><stop offset="1" stop-color="#ffffff" stop-opacity=".18"/></linearGradient>
  <linearGradient id="coffee" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b3b1c"/><stop offset="1" stop-color="#1e0f06"/></linearGradient>
  <radialGradient id="crema" cx=".4" cy=".4" r=".7"><stop offset="0" stop-color="#e2b27a"/><stop offset="1" stop-color="#8a4f22"/></radialGradient>
  <linearGradient id="shine" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;

  const bg = hue => `<defs>${INOX}
  <radialGradient id="bgr" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="hsl(${hue},32%,24%)"/><stop offset=".6" stop-color="hsl(${hue},30%,12%)"/><stop offset="1" stop-color="hsl(${hue},28%,6%)"/></radialGradient>
  <radialGradient id="glow" cx=".78" cy=".2" r=".6"><stop offset="0" stop-color="#e7c877" stop-opacity=".30"/><stop offset="1" stop-color="#e7c877" stop-opacity="0"/></radialGradient>
  <radialGradient id="floor" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".7"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
  <rect width="${W}" height="${W}" fill="url(#bgr)"/><rect width="${W}" height="${W}" fill="url(#glow)"/>
  <rect x="0" y="790" width="${W}" height="234" fill="#000" opacity=".22"/><line x1="0" y1="790" x2="${W}" y2="790" stroke="#e7c877" stroke-opacity=".18" stroke-width="2"/>
  <ellipse cx="512" cy="792" rx="330" ry="34" fill="url(#floor)"/>`;

  const bean = (x, y, r = 22, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot})"><ellipse rx="${r}" ry="${r * 0.72}" fill="#5a2f14"/><ellipse rx="${r}" ry="${r * 0.72}" fill="url(#shine)" opacity=".5"/><path d="M${-r * .85} 0 C ${-r * .3} ${-r * .25}, ${r * .3} ${r * .25}, ${r * .85} 0" stroke="#231005" stroke-width="${r * .14}" fill="none" stroke-linecap="round"/></g>`;
  const beans = (list) => list.map(b => bean(...b)).join('');
  const cup = (x, y, s = 1, fill = 'url(#cream)') => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="62" rx="70" ry="12" fill="#cbbfae"/><path d="M-48 0 H48 L40 50 Q0 62 -40 50 Z" fill="${fill}"/><path d="M46 12 q30 4 22 22 q-6 14 -26 10" stroke="#e8dcc8" stroke-width="8" fill="none"/><ellipse cx="0" cy="0" rx="48" ry="9" fill="url(#crema)"/></g>`;
  const steam = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})" stroke="#f4d999" stroke-width="6" fill="none" stroke-linecap="round" opacity=".7"><path d="M-18 0 c-14 -22 14 -34 0 -58"/><path d="M4 -4 c-14 -22 14 -34 0 -62"/><path d="M26 0 c-14 -22 14 -34 0 -56"/></g>`;
  const txt = (x, y, t, size, fill = '#f6f3ec', weight = 700, family = 'Georgia,serif', extra = '') => `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="middle" ${extra}>${t}</text>`;

  const D = {
    espresso() {
      return `<rect x="300" y="250" width="424" height="120" rx="18" fill="url(#inox)"/>
      <rect x="300" y="360" width="424" height="330" rx="10" fill="url(#blk)"/>
      <rect x="310" y="690" width="404" height="70" rx="12" fill="url(#inox)"/>
      <rect x="330" y="702" width="364" height="44" rx="8" fill="#2b2f33"/>${[...Array(10)].map((_, i) => `<rect x="${342 + i * 35}" y="712" width="22" height="24" rx="3" fill="#6f7780"/>`).join('')}
      <circle cx="620" cy="310" r="38" fill="#0f1012" stroke="url(#gold)" stroke-width="7"/><circle cx="620" cy="310" r="30" fill="#f7f1e3"/><path d="M620 310 L640 292" stroke="#b3261e" stroke-width="5" stroke-linecap="round"/><circle cx="620" cy="310" r="5" fill="#222"/>
      <circle cx="380" cy="310" r="16" fill="#e7c877"/><circle cx="440" cy="310" r="16" fill="#3a3a40" stroke="#888" stroke-width="2"/><circle cx="500" cy="310" r="16" fill="#3a3a40" stroke="#888" stroke-width="2"/>
      <rect x="440" y="370" width="150" height="46" rx="8" fill="url(#inox)"/><rect x="455" y="416" width="120" height="30" rx="6" fill="url(#inox)"/>
      <path d="M575 424 L760 442 q14 2 12 16 q-2 12 -16 10 L575 450 Z" fill="url(#blk)" stroke="#555" stroke-width="2"/>
      <rect x="495" y="446" width="12" height="22" fill="#9aa2aa"/><rect x="525" y="446" width="12" height="22" fill="#9aa2aa"/>
      <path d="M650 380 L680 380 L676 560 q-2 18 -20 22" stroke="url(#inox)" stroke-width="12" fill="none" stroke-linecap="round"/>
      ${cup(515, 628, 1.05)}${steam(515, 600, .8)}`;
    },
    espressopro() {
      return `<rect x="232" y="240" width="560" height="100" rx="14" fill="url(#inox)"/>
      <rect x="232" y="330" width="560" height="360" rx="8" fill="url(#blk)"/>
      <rect x="245" y="690" width="534" height="68" rx="12" fill="url(#inox)"/>
      ${[380, 512, 644].map((x, i) => `<circle cx="${x}" cy="290" r="36" fill="#0f1012" stroke="url(#gold)" stroke-width="6"/><circle cx="${x}" cy="290" r="28" fill="#f7f1e3"/><path d="M${x} 290 l${[16, 20, -18][i]} -${[16, 8, 14][i]}" stroke="#b3261e" stroke-width="4" stroke-linecap="round"/>`).join('')}
      <rect x="250" y="340" width="524" height="10" fill="url(#gold)" opacity=".85"/>
      <rect x="420" y="360" width="184" height="50" rx="8" fill="url(#inox)"/><rect x="437" y="410" width="150" height="34" rx="6" fill="url(#inox)"/>
      <path d="M590 420 L770 400 q14 -2 16 12 q2 12 -12 14 L590 448 Z" fill="url(#wood)"/>
      <rect x="478" y="444" width="12" height="22" fill="#9aa2aa"/><rect x="532" y="444" width="12" height="22" fill="#9aa2aa"/>
      <path d="M285 360 L262 370 L270 580 q2 14 18 16" stroke="url(#inox)" stroke-width="12" fill="none" stroke-linecap="round"/>
      <path d="M740 360 L762 370 L754 560" stroke="url(#inox)" stroke-width="12" fill="none" stroke-linecap="round"/>
      <rect x="290" y="630" width="444" height="8" fill="#e7c877" opacity=".5"/>
      ${cup(512, 630, 1)}${steam(512, 600, .75)}`;
    },
    beantocup() {
      return `<path d="M330 250 H694 Q720 250 720 276 V760 H304 V276 Q304 250 330 250 Z" fill="url(#blk)"/>
      <rect x="360" y="226" width="160" height="34" rx="10" fill="#2a2a2e" stroke="#555" stroke-width="2"/>
      <rect x="566" y="226" width="96" height="30" rx="8" fill="#2a2a2e" stroke="#555" stroke-width="2"/>
      <rect x="364" y="290" width="296" height="150" rx="14" fill="#0b0c0e" stroke="url(#gold)" stroke-width="5"/>
      <rect x="378" y="304" width="268" height="122" rx="8" fill="#12161b"/>
      ${[0, 1, 2, 3].map(i => `<g transform="translate(${414 + i * 66} 350)"><circle r="22" fill="#1f2630" stroke="#e7c877" stroke-width="3"/><path d="M-9 -4 h18 l-3 14 h-12 z" fill="#f4d999"/></g>`).join('')}
      ${txt(512, 412, 'ESPRESSO · LUNGO · CAPPUCCINO · LATTE', 14, '#e7c877', 600, 'Arial,sans-serif')}
      <rect x="304" y="470" width="416" height="6" fill="url(#gold)" opacity=".8"/>
      <rect x="440" y="490" width="144" height="40" rx="10" fill="url(#inox)"/><rect x="480" y="530" width="18" height="24" fill="#9aa2aa"/><rect x="526" y="530" width="18" height="24" fill="#9aa2aa"/>
      <rect x="330" y="700" width="364" height="44" rx="10" fill="url(#inox)"/>
      ${cup(512, 640, 1)}${steam(512, 612, .7)}`;
    },
    capsulemachine() {
      return `<path d="M400 270 Q400 240 440 240 H600 Q640 240 640 280 L660 740 H380 Z" fill="#8a2030"/>
      <path d="M400 270 Q400 240 440 240 H600 Q640 240 640 280 L660 740 H380 Z" fill="url(#shine)" opacity=".45"/>
      <rect x="420" y="200" width="200" height="54" rx="26" fill="url(#inox)"/>
      <path d="M430 330 H610 V430 Q610 450 590 450 H450 Q430 450 430 430 Z" fill="#1b1b1e"/><rect x="480" y="450" width="80" height="30" rx="6" fill="url(#inox)"/>
      <circle cx="455" cy="300" r="12" fill="#f4d999"/><circle cx="585" cy="300" r="12" fill="#f4d999"/>
      <rect x="370" y="700" width="300" height="50" rx="12" fill="url(#inox)"/>
      ${cup(520, 650, .85)}${steam(520, 628, .6)}
      <g transform="translate(730 700)"><path d="M-40 0 L-30 -46 H30 L40 0 Z" fill="#6e2a2a"/><ellipse cx="0" cy="-46" rx="30" ry="8" fill="#b0802a"/><ellipse cx="0" cy="0" rx="44" ry="9" fill="#d4a94f"/></g>
      <g transform="translate(300 715) rotate(-12)"><path d="M-40 0 L-30 -46 H30 L40 0 Z" fill="#2c4f7a"/><ellipse cx="0" cy="-46" rx="30" ry="8" fill="#6a8fbf"/><ellipse cx="0" cy="0" rx="44" ry="9" fill="#d4a94f"/></g>`;
    },
    filter() {
      return `<rect x="560" y="230" width="150" height="530" rx="18" fill="url(#blk)"/>
      <path d="M330 230 H710 V330 H330 Q310 330 310 310 V250 Q310 230 330 230 Z" fill="url(#blk)"/>
      <rect x="590" y="360" width="90" height="220" rx="10" fill="#1b2a38" opacity=".9"/><rect x="590" y="460" width="90" height="120" rx="6" fill="#4d7ea8" opacity=".6"/>
      ${[0, 1, 2, 3].map(i => `<line x1="596" y1="${390 + i * 45}" x2="615" y2="${390 + i * 45}" stroke="#e7c877" stroke-width="3"/>`).join('')}
      <rect x="610" y="610" width="60" height="26" rx="6" fill="#0b0c0e" stroke="#e7c877" stroke-width="2"/>${txt(640, 629, '07:30', 16, '#e7c877', 600, 'Arial,sans-serif')}
      <rect x="320" y="330" width="220" height="40" fill="#1d1d20"/>
      <rect x="300" y="720" width="420" height="44" rx="10" fill="url(#inox)"/>
      <path d="M345 420 H515 L528 700 Q528 722 506 722 H354 Q332 722 332 700 Z" fill="url(#coffee)" opacity=".95"/>
      <path d="M340 400 H520 L535 710 Q535 730 510 730 H350 Q325 730 325 710 Z" fill="url(#glass)" stroke="#dfe6ec" stroke-opacity=".7" stroke-width="4"/>
      <path d="M338 400 L320 380 H540 L520 400" fill="url(#inox)"/>
      <path d="M530 470 q60 0 60 60 v60 q0 50 -60 50" stroke="#15151a" stroke-width="18" fill="none"/>
      <rect x="345" y="560" width="10" height="130" rx="5" fill="#fff" opacity=".25"/>`;
    },
    grinder() {
      return `<path d="M392 250 H632 L580 420 H444 Z" fill="#4a2a17" opacity=".25"/>
      ${beans([[450, 300, 18, 20], [490, 290, 18, -30], [530, 305, 18, 60], [575, 295, 18, 10], [470, 335, 18, 80], [512, 340, 18, -10], [555, 332, 18, 40], [490, 375, 17, 0], [530, 378, 17, 70], [505, 405, 16, -40]])}
      <path d="M392 250 H632 L580 420 H444 Z" fill="url(#glass)" stroke="#dfe6ec" stroke-opacity=".6" stroke-width="4"/>
      <rect x="382" y="232" width="260" height="26" rx="10" fill="url(#blk)"/>
      <rect x="420" y="420" width="184" height="330" rx="22" fill="url(#blk)"/>
      <rect x="420" y="440" width="184" height="12" fill="url(#gold)"/>
      <circle cx="512" cy="510" r="36" fill="url(#inox)"/><circle cx="512" cy="510" r="14" fill="#2a2a2e"/>${[...Array(12)].map((_, i) => `<line x1="${512 + 40 * Math.cos(i * Math.PI / 6)}" y1="${510 + 40 * Math.sin(i * Math.PI / 6)}" x2="${512 + 48 * Math.cos(i * Math.PI / 6)}" y2="${510 + 48 * Math.sin(i * Math.PI / 6)}" stroke="#e7c877" stroke-width="3"/>`).join('')}
      <rect x="490" y="570" width="44" height="26" rx="4" fill="url(#inox)"/>
      <rect x="455" y="620" width="114" height="110" rx="14" fill="url(#glass)" stroke="#dfe6ec" stroke-opacity=".6" stroke-width="3"/><rect x="462" y="668" width="100" height="56" rx="10" fill="#4a2a17"/>
      <rect x="400" y="740" width="224" height="30" rx="10" fill="url(#inox)"/>`;
    },
    handgrinder() {
      return `<rect x="410" y="470" width="204" height="280" rx="12" fill="url(#wood)"/>
      <rect x="420" y="600" width="184" height="16" fill="#2b170b" opacity=".6"/><rect x="450" y="640" width="124" height="70" rx="6" fill="#3a2010" stroke="url(#gold)" stroke-width="3"/><circle cx="512" cy="675" r="8" fill="url(#gold)"/>
      <path d="M430 470 Q430 400 512 392 Q594 400 594 470 Z" fill="url(#inox)"/>
      <rect x="500" y="330" width="24" height="70" fill="url(#inox)"/>
      <path d="M512 340 L690 300" stroke="url(#inox)" stroke-width="16" stroke-linecap="round"/>
      <rect x="672" y="236" width="34" height="74" rx="17" fill="url(#wood)"/>
      <circle cx="512" cy="336" r="16" fill="url(#gold)"/>
      <rect x="400" y="740" width="224" height="22" rx="6" fill="#2b170b"/>
      ${beans([[330, 760, 20, 30], [372, 772, 18, -20], [680, 766, 20, 60], [720, 752, 18, 10]])}`;
    },
    grinderpro() {
      return `<path d="M372 208 H652 L592 380 H432 Z" fill="#3a1d0c" opacity=".35"/>
      ${beans([[440, 250, 18, 10], [485, 240, 18, 60], [530, 252, 18, -20], [575, 244, 18, 40], [610, 256, 16, 70], [460, 290, 18, -40], [505, 295, 18, 20], [550, 292, 18, 80], [480, 332, 17, 0], [525, 336, 17, 50], [565, 330, 16, -10], [505, 364, 16, 30]])}
      <path d="M372 208 H652 L592 380 H432 Z" fill="url(#glass)" stroke="#dfe6ec" stroke-opacity=".6" stroke-width="4"/>
      <rect x="360" y="196" width="304" height="20" rx="8" fill="url(#blk)"/>
      <path d="M392 380 H632 L652 760 H372 Z" fill="url(#inox)"/>
      <rect x="440" y="410" width="144" height="70" rx="10" fill="#0b0c0e" stroke="url(#gold)" stroke-width="4"/>${txt(512, 456, '18,5 g', 32, '#e7c877', 700, 'Arial,sans-serif')}
      <circle cx="470" cy="508" r="10" fill="#2a2a2e"/><circle cx="512" cy="508" r="10" fill="#e7c877"/><circle cx="554" cy="508" r="10" fill="#2a2a2e"/>
      <rect x="486" y="540" width="52" height="40" rx="6" fill="#2a2a2e"/>
      <path d="M430 610 H594" stroke="#2a2a2e" stroke-width="10"/><path d="M440 612 L420 580 M584 612 L604 580" stroke="#2a2a2e" stroke-width="10" stroke-linecap="round"/>
      <rect x="455" y="625" width="114" height="30" rx="8" fill="url(#inox)" stroke="#555"/><path d="M569 636 L680 650" stroke="url(#blk)" stroke-width="18" stroke-linecap="round"/>
      <rect x="360" y="750" width="304" height="22" rx="8" fill="url(#blk)"/>`;
    },
    bag(origin, sub, color) {
      return `<path d="M372 250 H652 L668 740 Q668 760 648 760 H376 Q356 760 356 740 Z" fill="${color}"/>
      <path d="M372 250 H652 L668 740 Q668 760 648 760 H376 Q356 760 356 740 Z" fill="url(#shine)" opacity=".35"/>
      <path d="M372 250 L360 222 H664 L652 250 Z" fill="${color}" stroke="#000" stroke-opacity=".3" stroke-width="3"/>
      ${[...Array(18)].map((_, i) => `<line x1="${370 + i * 16}" y1="226" x2="${372 + i * 16}" y2="248" stroke="#000" stroke-opacity=".25" stroke-width="3"/>`).join('')}
      <circle cx="512" cy="300" r="18" fill="#111" opacity=".55"/><circle cx="512" cy="300" r="8" fill="#e7c877" opacity=".8"/>
      <rect x="392" y="380" width="240" height="250" rx="12" fill="#f6efe2" stroke="url(#gold)" stroke-width="6"/>
      ${txt(512, 430, 'CAFÉ EN GRAINS', 20, '#6b4a2a', 700, 'Arial,sans-serif', 'letter-spacing="3"')}
      <line x1="430" y1="448" x2="594" y2="448" stroke="#d4a94f" stroke-width="3"/>
      ${txt(512, 505, origin, origin.length > 6 ? 34 : 44, '#2a160a', 800)}
      ${txt(512, 548, sub, 28, '#6b4a2a', 400, 'Georgia,serif', 'font-style="italic"')}
      ${bean(512, 592, 20, 20)}
      ${beans([[300, 770, 22, 30], [340, 782, 20, -20], [700, 770, 22, 60], [740, 780, 19, 10], [722, 745, 18, 100]])}`;
    },
    brick() {
      return `<path d="M400 300 L600 300 L640 280 L440 280 Z" fill="#b0802a"/>
      <path d="M600 300 L640 280 L640 740 L600 760 Z" fill="#6e4a14"/>
      <rect x="400" y="300" width="200" height="460" fill="#c9962f"/>
      <rect x="400" y="300" width="200" height="460" fill="url(#shine)" opacity=".35"/>
      <path d="M400 300 L420 260 H620 L600 300" fill="#d4a94f" opacity=".7"/>
      <rect x="418" y="380" width="164" height="220" rx="8" fill="#1e1208"/>
      ${txt(500, 430, 'CAFÉ MOULU', 20, '#f4d999', 700, 'Arial,sans-serif', 'letter-spacing="2"')}
      ${txt(500, 490, 'Pur', 38, '#fbf5ea', 400, 'Georgia,serif', 'font-style="italic"')}
      ${txt(500, 536, 'Arabica', 40, '#fbf5ea', 800)}
      ${txt(500, 580, '250 g', 22, '#e7c877', 700, 'Arial,sans-serif')}
      ${[0, 1, 2, 3, 4].map(i => `<rect x="${430 + i * 30}" y="640" width="20" height="20" rx="4" fill="${i < 4 ? '#2a160a' : '#e8d3a8'}"/>`).join('')}${txt(500, 690, 'INTENSITÉ 4/5', 16, '#2a160a', 700, 'Arial,sans-serif')}
      <path d="M300 760 q40 -30 80 0 z" fill="#5a2f14"/><path d="M640 760 q40 -24 90 0 z" fill="#5a2f14"/>`;
    },
    capsbox(label, color) {
      const cap = (x, y, r = 0) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M-44 0 L-32 -54 H32 L44 0 Z" fill="${color}"/><path d="M-44 0 L-32 -54 H32 L44 0 Z" fill="url(#shine)" opacity=".5"/><ellipse cx="0" cy="-54" rx="32" ry="8" fill="#000" opacity=".35"/><ellipse cx="0" cy="0" rx="50" ry="10" fill="url(#gold)"/></g>`;
      return `<path d="M340 330 L620 330 L690 290 L410 290 Z" fill="${color}" opacity=".85"/>
      <path d="M620 330 L690 290 L690 600 L620 640 Z" fill="#000" opacity=".35"/><path d="M620 330 L690 290 L690 600 L620 640 Z" fill="${color}" opacity=".6"/>
      <rect x="340" y="330" width="280" height="310" fill="${color}"/><rect x="340" y="330" width="280" height="310" fill="url(#shine)" opacity=".25"/>
      <rect x="360" y="352" width="240" height="4" fill="url(#gold)"/>
      ${txt(480, 410, 'CAPSULES', 26, '#f4d999', 700, 'Arial,sans-serif', 'letter-spacing="4"')}
      ${txt(480, 470, label, 46, '#fbf5ea', 800)}
      ${txt(480, 510, 'compatibles · x10', 20, '#f4d999', 400, 'Georgia,serif', 'font-style="italic"')}
      <circle cx="480" cy="570" r="30" fill="none" stroke="url(#gold)" stroke-width="4"/>${bean(480, 570, 16, 25)}
      ${cap(350, 770, -8)}${cap(460, 775, 4)}${cap(640, 770, 10)}${cap(740, 760, -4)}`;
    },
    pods() {
      const pod = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse rx="70" ry="22" fill="#efe6d4"/><ellipse rx="52" ry="15" fill="#7a4a24"/><ellipse rx="52" ry="15" fill="url(#shine)" opacity=".3"/></g>`;
      return `<rect x="330" y="300" width="300" height="340" rx="10" fill="#f4ece0"/><path d="M630 300 L690 270 V610 L630 640 Z" fill="#cbbfae"/><path d="M330 300 L390 270 H690 L630 300 Z" fill="#fffaf2"/>
      <rect x="330" y="380" width="300" height="150" fill="#6b3b1c"/>
      ${txt(480, 432, 'DOSETTES ESE', 26, '#f4d999', 700, 'Arial,sans-serif', 'letter-spacing="3"')}
      ${txt(480, 485, 'Classico', 46, '#fbf5ea', 800)}
      ${txt(480, 518, '50 dosettes papier · 44 mm', 17, '#f4d999', 400, 'Arial,sans-serif')}
      ${pod(480, 590, .9)}
      ${pod(330, 760)}${pod(480, 772)}${pod(650, 760)}${pod(760, 740, .8)}`;
    },
    tamper() {
      return `<path d="M470 280 Q512 230 554 280 L570 520 H454 Z" fill="url(#wood)"/>
      <ellipse cx="512" cy="266" rx="46" ry="30" fill="#8a5630"/><ellipse cx="500" cy="258" rx="18" ry="8" fill="#fff" opacity=".18"/>
      <rect x="452" y="520" width="120" height="22" rx="4" fill="url(#gold)"/>
      <rect x="490" y="542" width="44" height="60" fill="url(#inox)"/>
      <path d="M392 602 H632 V700 Q632 720 612 720 H412 Q392 720 392 700 Z" fill="url(#inox)"/>
      <ellipse cx="512" cy="602" rx="120" ry="18" fill="#dfe4e9"/>
      ${txt(512, 670, '58 mm', 26, '#4c545c', 700, 'Arial,sans-serif')}
      <g transform="translate(700 740)"><ellipse rx="80" ry="18" fill="#2a2a2e"/><rect x="-80" y="-34" width="160" height="34" fill="url(#blk)"/><ellipse cy="-34" rx="80" ry="18" fill="#3a1d0c"/><ellipse cy="-34" rx="66" ry="13" fill="#5a2f14"/></g>
      <path d="M620 700 L840 690" stroke="url(#blk)" stroke-width="20" stroke-linecap="round"/>`;
    },
    pitcher() {
      return `<path d="M400 360 L610 360 L660 330 L680 344 L636 380 L660 720 Q662 752 630 752 H410 Q378 752 380 720 Z" fill="url(#inox)"/>
      <path d="M610 360 L660 330 L680 344 L636 380 Z" fill="#dfe4e9"/>
      <ellipse cx="505" cy="360" rx="105" ry="14" fill="#5d646c"/><ellipse cx="505" cy="362" rx="96" ry="10" fill="#f7f3ea"/>
      <path d="M400 420 Q300 430 310 540 Q318 640 392 650" stroke="url(#inox)" stroke-width="26" fill="none" stroke-linecap="round"/>
      <rect x="430" y="400" width="18" height="320" rx="9" fill="#fff" opacity=".35"/>
      ${[0, 1, 2].map(i => `<line x1="560" y1="${500 + i * 60}" x2="590" y2="${500 + i * 60}" stroke="#4c545c" stroke-width="4"/>`).join('')}${txt(612, 505, '600', 16, '#4c545c', 700, 'Arial,sans-serif')}
      <g transform="translate(760 700)"><ellipse cy="46" rx="80" ry="14" fill="#cbbfae"/><path d="M-60 -20 H60 L50 38 Q0 52 -50 38 Z" fill="url(#cream)"/><ellipse cy="-20" rx="60" ry="12" fill="#c28a52"/><path d="M-28 -22 q28 -18 28 6 q0 -24 28 -6 q-12 16 -28 14 q-16 2 -28 -14" fill="#fbf5ea"/></g>`;
    },
    knockbox() {
      return `<path d="M362 420 H662 L640 752 H384 Z" fill="url(#inox)"/>
      <ellipse cx="512" cy="420" rx="150" ry="36" fill="#4c545c"/><ellipse cx="512" cy="424" rx="136" ry="28" fill="#2b170b"/>
      ${[[470, 420], [520, 428], [560, 418]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="30" ry="12" fill="#3d2212"/>`).join('')}
      <rect x="370" y="396" width="284" height="20" rx="10" fill="url(#blk)"/>
      <rect x="410" y="460" width="16" height="270" rx="8" fill="#fff" opacity=".3"/>
      <rect x="370" y="740" width="284" height="20" rx="8" fill="url(#blk)"/>
      <g transform="translate(560 300) rotate(20)"><rect x="-70" y="-26" width="140" height="44" rx="10" fill="url(#inox)"/><path d="M60 -8 L230 -20 q14 0 14 14 q0 14 -14 14 L60 16 Z" fill="url(#blk)"/><ellipse cx="0" cy="-26" rx="70" ry="10" fill="#4a2a17"/></g>`;
    },
    scale() {
      return `<path d="M290 640 L734 640 L760 720 L264 720 Z" fill="#1c1c20"/><rect x="264" y="720" width="496" height="34" rx="8" fill="url(#blk)"/>
      <path d="M300 640 L724 640 L744 700 L280 700 Z" fill="#26262b"/>
      <rect x="330" y="712" width="200" height="34" rx="6" fill="#0b0c0e" stroke="#e7c877" stroke-width="2"/>${txt(380, 737, '36,2 g', 22, '#e7c877', 700, 'Arial,sans-serif')}${txt(480, 737, '0:28', 22, '#f4d999', 700, 'Arial,sans-serif')}
      <circle cx="600" cy="729" r="10" fill="#e7c877"/><circle cx="650" cy="729" r="10" fill="#555"/>
      ${cup(512, 580, 1.1, 'url(#cream)')}
      <g transform="translate(512 300)"><rect x="-90" y="0" width="180" height="80" rx="10" fill="url(#inox)"/><rect x="-26" y="80" width="52" height="30" fill="url(#inox)"/><rect x="-18" y="110" width="10" height="30" fill="#9aa2aa"/><rect x="8" y="110" width="10" height="30" fill="#9aa2aa"/></g>
      <path d="M500 450 v110 M524 450 v110" stroke="#4a2410" stroke-width="7" stroke-linecap="round"/>`;
    },
    cups() {
      return `<path d="M250 480 H774 L744 760 H280 Z" fill="#141416"/><rect x="250" y="440" width="524" height="46" fill="#1e1e22"/>
      <rect x="250" y="440" width="524" height="8" fill="url(#gold)"/>
      <rect x="265" y="470" width="494" height="260" rx="8" fill="#6b1f24"/>
      ${[350, 512, 674].map(x => `<ellipse cx="${x}" cy="660" rx="72" ry="18" fill="#4a1519"/>${cup(x, 590, .95)}`).join('')}
      <path d="M250 440 L300 250 H724 L774 440" fill="#1c1c20" stroke="#e7c877" stroke-opacity=".6" stroke-width="3"/>
      ${txt(512, 360, 'ESPRESSO', 40, '#e7c877', 700, 'Georgia,serif', 'letter-spacing="6"')}${txt(512, 400, '6 tasses porcelaine', 22, '#f6f3ec', 400, 'Georgia,serif', 'font-style="italic"')}`;
    },
    frother() {
      return `<rect x="380" y="700" width="264" height="56" rx="20" fill="url(#blk)"/><circle cx="512" cy="728" r="10" fill="#e7c877"/>
      <path d="M410 330 H614 L604 690 Q604 706 588 706 H436 Q420 706 420 690 Z" fill="url(#blk)"/>
      <path d="M614 380 q70 10 70 90 q0 90 -74 100" stroke="#1c1c20" stroke-width="30" fill="none"/>
      <rect x="400" y="300" width="224" height="40" rx="14" fill="url(#inox)"/><rect x="480" y="280" width="64" height="24" rx="8" fill="#2a2a2e"/>
      <rect x="430" y="370" width="14" height="300" rx="7" fill="#fff" opacity=".18"/>
      ${[0, 1].map(i => `<line x1="560" y1="${440 + i * 80}" x2="590" y2="${440 + i * 80}" stroke="#e7c877" stroke-width="4"/>`).join('')}
      <g transform="translate(280 690)"><ellipse cy="60" rx="70" ry="12" fill="#cbbfae"/><path d="M-60 -30 H60 L50 50 Q0 62 -50 50 Z" fill="url(#glass)" stroke="#e8dcc8" stroke-width="3"/><path d="M-56 0 H56 L50 50 Q0 62 -50 50 Z" fill="#b87a44"/><path d="M-58 -26 H58 L57 0 H-57 Z" fill="#fbf5ea"/></g>`;
    },
    press() {
      return `<path d="M420 360 H600 V740 H420 Z" fill="url(#coffee)" opacity=".95"/><rect x="420" y="360" width="180" height="40" fill="#b87a44"/>
      <rect x="410" y="320" width="200" height="430" rx="8" fill="url(#glass)" stroke="#dfe6ec" stroke-opacity=".7" stroke-width="4"/>
      <rect x="396" y="300" width="228" height="470" rx="10" fill="none" stroke="url(#inox)" stroke-width="10" stroke-dasharray="4 0"/>
      <rect x="392" y="296" width="236" height="20" fill="url(#inox)"/><rect x="392" y="750" width="236" height="24" fill="url(#inox)"/>
      <path d="M404 300 V770 M616 300 V770" stroke="url(#inox)" stroke-width="10"/>
      <path d="M404 520 H616" stroke="url(#inox)" stroke-width="10"/>
      <path d="M400 296 Q512 240 624 296 Z" fill="url(#inox)"/><rect x="505" y="200" width="14" height="60" fill="url(#inox)"/><circle cx="512" cy="196" r="20" fill="url(#gold)"/>
      <rect x="420" y="340" width="180" height="10" fill="url(#inox)"/>
      <path d="M624 360 q90 0 90 90 v130 q0 90 -90 90" stroke="url(#blk)" stroke-width="30" fill="none"/>
      <path d="M392 310 L360 300" stroke="url(#inox)" stroke-width="10" stroke-linecap="round"/>`;
    },
    moka() {
      return `<path d="M410 520 L614 520 L650 760 H374 Z" fill="url(#inox)"/>
      ${[0, 1, 2, 3, 4, 5, 6].map(i => `<line x1="${410 + i * 34}" y1="530" x2="${392 + i * 40}" y2="750" stroke="#6f7780" stroke-width="2" opacity=".6"/>`).join('')}
      <rect x="398" y="500" width="228" height="32" fill="url(#inox)"/><rect x="398" y="500" width="228" height="8" fill="#6f7780"/>
      <path d="M420 500 L400 290 H624 L604 500 Z" fill="url(#inox)"/>
      ${[0, 1, 2, 3, 4, 5].map(i => `<line x1="${426 + i * 34}" y1="490" x2="${410 + i * 38}" y2="300" stroke="#6f7780" stroke-width="2" opacity=".6"/>`).join('')}
      <path d="M400 290 L382 262 L420 280 Z" fill="url(#inox)"/>
      <path d="M396 270 Q512 222 628 270 L624 292 H400 Z" fill="url(#inox)"/><rect x="498" y="228" width="28" height="22" rx="6" fill="#1c1c20"/>
      <path d="M624 310 H700 Q716 310 716 326 V440 Q716 470 690 470 L612 470" stroke="#1c1c20" stroke-width="26" fill="none"/>
      ${steam(380, 240, .8)}${cup(760, 700, .8)}`;
    },
    dripper() {
      return `<g transform="translate(512 0)"><path d="M-120 330 H120 L50 520 H-50 Z" fill="url(#cream)"/>
      ${[-60, -20, 20, 60].map(x => `<path d="M${x} 340 L${x * 0.4} 510" stroke="#bfb09a" stroke-width="3"/>`).join('')}
      <ellipse cy="330" rx="120" ry="20" fill="#e8dcc8"/><ellipse cy="332" rx="104" ry="14" fill="#f6efe2"/><path d="M-104 332 L-40 300 L40 300 L104 332" fill="#fbf7ef"/>
      <rect x="-70" y="515" width="140" height="18" rx="6" fill="url(#cream)"/>
      <path d="M-110 540 H110 L96 752 Q96 768 80 768 H-80 Q-96 768 -96 752 Z" fill="url(#glass)" stroke="#dfe6ec" stroke-opacity=".7" stroke-width="4"/>
      <path d="M-100 650 H100 L96 752 Q96 768 80 768 H-80 Q-96 768 -96 752 Z" fill="url(#coffee)" opacity=".9"/>
      <path d="M0 533 v110" stroke="#5a2f14" stroke-width="5"/></g>
      <g transform="translate(760 700)"><path d="M-70 -120 L70 -120 L30 60 H-30 Z" fill="#fbf7ef" stroke="#e0d6c4" stroke-width="3"/><path d="M-60 -110 L60 -110 L24 50 H-24 Z" fill="#f4ecdf" stroke="#e0d6c4" stroke-width="2"/></g>`;
    },
    kettle() {
      return `<path d="M440 640 Q330 600 290 470 Q270 390 226 340" stroke="url(#inox)" stroke-width="20" fill="none" stroke-linecap="round"/><path d="M380 440 Q380 380 440 380 H584 Q644 380 644 440 L660 740 H364 Z" fill="url(#blk)"/>
      <ellipse cx="512" cy="382" rx="100" ry="16" fill="#2a2a2e"/><rect x="492" y="330" width="40" height="40" rx="10" fill="url(#gold)"/>
      <path d="M644 420 q100 20 96 150 q-4 120 -80 140" stroke="url(#wood)" stroke-width="30" fill="none"/>
      <rect x="410" y="420" width="14" height="300" rx="7" fill="#fff" opacity=".2"/>
      <rect x="350" y="740" width="324" height="30" rx="12" fill="url(#blk)"/>
      <rect x="470" y="600" width="84" height="36" rx="6" fill="#0b0c0e" stroke="#e7c877" stroke-width="2"/>${txt(512, 626, '93 °C', 20, '#e7c877', 700, 'Arial,sans-serif')}
      ${steam(226, 320, .6)}`;
    },
    bottle(label, color) {
      return `<rect x="486" y="226" width="52" height="40" rx="8" fill="#e8e8ea"/><rect x="480" y="250" width="64" height="30" rx="6" fill="${color}"/>
      <path d="M490 280 H534 Q534 330 600 360 Q620 370 620 400 V740 Q620 762 598 762 H426 Q404 762 404 740 V400 Q404 370 424 360 Q490 330 490 280 Z" fill="#eef4f8"/>
      <path d="M490 280 H534 Q534 330 600 360 Q620 370 620 400 V740 Q620 762 598 762 H426 Q404 762 404 740 V400 Q404 370 424 360 Q490 330 490 280 Z" fill="url(#shine)" opacity=".6"/>
      <rect x="404" y="440" width="216" height="250" fill="${color}"/>
      ${txt(512, 500, label, label.length > 9 ? 28 : 34, '#ffffff', 800, 'Arial,sans-serif', 'letter-spacing="1"')}
      ${txt(512, 540, 'liquide universel', 22, '#dcecf7', 400, 'Georgia,serif', 'font-style="italic"')}
      <path d="M512 568 q-30 40 0 64 q30 -24 0 -64" fill="#dcecf7"/>
      ${txt(512, 672, '500 ml', 22, '#ffffff', 700, 'Arial,sans-serif')}
      <rect x="420" y="400" width="14" height="330" rx="7" fill="#fff" opacity=".5"/>
      ${[[700, 760], [736, 740], [320, 752]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="14" fill="#9fd2f0" opacity=".55"/>`).join('')}`;
    },
    tablets() {
      return `<path d="M400 360 H624 V740 Q624 760 604 760 H420 Q400 760 400 740 Z" fill="#f4f6f8"/><path d="M400 360 H624 V740 Q624 760 604 760 H420 Q400 760 400 740 Z" fill="url(#shine)" opacity=".5"/>
      <rect x="390" y="300" width="244" height="70" rx="12" fill="#1a6b5a"/><rect x="390" y="300" width="244" height="70" rx="12" fill="url(#shine)" opacity=".3"/>
      <rect x="400" y="440" width="224" height="220" fill="#1a6b5a"/>
      ${txt(512, 500, 'PASTILLES', 32, '#fff', 800, 'Arial,sans-serif')}${txt(512, 536, 'nettoyage groupe', 22, '#d8f0e8', 400, 'Georgia,serif', 'font-style="italic"')}
      ${txt(512, 600, '100 × 2 g', 30, '#f4d999', 700, 'Arial,sans-serif')}
      ${[[290, 760], [330, 745], [700, 762], [740, 748], [712, 725]].map(([x, y]) => `<g transform="translate(${x} ${y})"><ellipse rx="26" ry="12" fill="#e9eef2"/><ellipse cy="-4" rx="26" ry="10" fill="#ffffff"/></g>`).join('')}`;
    },
    cartridge() {
      return `<rect x="440" y="260" width="144" height="46" rx="12" fill="#2c4f7a"/><rect x="470" y="230" width="84" height="36" rx="8" fill="#1c3656"/>
      <path d="M432 300 H592 L584 740 Q584 760 564 760 H460 Q440 760 440 740 Z" fill="#3b6ea5"/>
      <path d="M432 300 H592 L584 740 Q584 760 564 760 H460 Q440 760 440 740 Z" fill="url(#shine)" opacity=".45"/>
      ${[...Array(9)].map((_, i) => `<rect x="444" y="${330 + i * 22}" width="136" height="10" rx="5" fill="#1c3656" opacity=".7"/>`).join('')}
      <rect x="440" y="560" width="144" height="120" fill="#f6efe2"/>${txt(512, 604, 'FILTRE', 24, '#1c3656', 800, 'Arial,sans-serif')}${txt(512, 634, 'anti-calcaire', 18, '#3b6ea5', 400, 'Georgia,serif', 'font-style="italic"')}
      <path d="M512 648 q-12 16 0 24 q12 -8 0 -24" fill="#3b6ea5"/>
      ${[[330, 740], [370, 700], [690, 730], [650, 760]].map(([x, y]) => `<path d="M${x} ${y} q-22 30 0 46 q22 -16 0 -46" fill="#9fd2f0" opacity=".55"/>`).join('')}`;
    },
    brush() {
      return `<g transform="rotate(-28 512 520)"><rect x="300" y="490" width="300" height="56" rx="28" fill="url(#blk)"/><rect x="330" y="506" width="120" height="8" rx="4" fill="url(#gold)"/><circle cx="330" cy="518" r="10" fill="#2a2a2e"/>
      <rect x="596" y="494" width="40" height="48" fill="url(#inox)"/>
      <rect x="636" y="470" width="110" height="96" rx="10" fill="#e8e0d0"/>
      ${[...Array(12)].map((_, i) => `<line x1="${644 + i * 9}" y1="470" x2="${644 + i * 9}" y2="420" stroke="#f1e9d9" stroke-width="5"/>`).join('')}</g>
      <g transform="translate(420 690)"><rect x="-130" y="-40" width="220" height="60" rx="10" fill="url(#inox)"/><path d="M90 -20 L270 -40 q14 0 14 14 q0 14 -14 14 L90 10 Z" fill="url(#blk)"/><rect x="-100" y="20" width="160" height="30" rx="6" fill="url(#inox)"/></g>`;
    },
    gasket() {
      const ring = (x, y, r, s) => `<g transform="translate(${x} ${y})"><ellipse rx="${r}" ry="${r * s}" fill="none" stroke="#141416" stroke-width="${r * .22}"/><ellipse rx="${r}" ry="${r * s}" fill="none" stroke="#3a3a40" stroke-width="${r * .08}" transform="translate(0 -${r * .04})"/></g>`;
      return `${ring(512, 460, 180, .95)}${ring(360, 690, 90, .4)}${ring(664, 700, 90, .4)}
      <rect x="410" y="740" width="204" height="44" rx="8" fill="#f6efe2" stroke="url(#gold)" stroke-width="3"/>${txt(512, 770, 'Ø 58 × 9 mm', 22, '#2a160a', 700, 'Arial,sans-serif')}`;
    },
    teatin() {
      return `<rect x="400" y="330" width="224" height="430" rx="16" fill="#2f5d3a"/><rect x="400" y="330" width="224" height="430" rx="16" fill="url(#shine)" opacity=".35"/>
      <rect x="392" y="290" width="240" height="70" rx="14" fill="url(#gold)"/>
      <rect x="420" y="430" width="184" height="220" rx="10" fill="#f6efe2"/>
      <path d="M512 470 q-50 30 -20 90 q40 -10 20 -90" fill="#4c8a52"/><path d="M512 470 q50 30 20 90 q-40 -10 -20 -90" fill="#6aa86e"/><path d="M512 480 V560" stroke="#2f5d3a" stroke-width="3"/>
      ${txt(512, 600, 'SENCHA', 30, '#2f5d3a', 800)}${txt(512, 630, 'thé vert bio · 100 g', 18, '#6b4a2a', 400, 'Georgia,serif', 'font-style="italic"')}
      <g transform="translate(730 700)"><ellipse cy="46" rx="70" ry="12" fill="#cbbfae"/><path d="M-56 -20 H56 L46 38 Q0 50 -46 38 Z" fill="url(#cream)"/><ellipse cy="-20" rx="56" ry="10" fill="#a7b35a"/></g>
      ${[[300, 760, 20], [335, 772, -30]].map(([x, y, r]) => `<path transform="translate(${x} ${y}) rotate(${r})" d="M0 -18 q18 18 0 36 q-18 -18 0 -36" fill="#4c8a52"/>`).join('')}`;
    },
    choco() {
      return `<path d="M372 260 H652 L668 740 Q668 760 648 760 H376 Q356 760 356 740 Z" fill="#3b1f12"/>
      <path d="M372 260 H652 L668 740 Q668 760 648 760 H376 Q356 760 356 740 Z" fill="url(#shine)" opacity=".3"/>
      <path d="M372 260 L360 232 H664 L652 260 Z" fill="#2b150b"/>
      <path d="M356 470 Q512 420 668 470 V560 Q512 510 356 560 Z" fill="url(#gold)"/>
      ${txt(512, 360, 'CHOCOLAT', 40, '#f4d999', 800, 'Georgia,serif', 'letter-spacing="3"')}${txt(512, 400, 'en poudre', 26, '#fbf5ea', 400, 'Georgia,serif', 'font-style="italic"')}
      ${txt(512, 522, '1 kg', 34, '#2b150b', 800, 'Arial,sans-serif')}
      <g transform="translate(512 650)"><ellipse cy="40" rx="80" ry="12" fill="#2b150b"/><path d="M-62 -10 H62 L52 34 Q0 46 -52 34 Z" fill="url(#cream)"/><ellipse cy="-10" rx="62" ry="12" fill="#6b3b1c"/></g>
      <path d="M700 770 q40 -40 90 0 z" fill="#6b3b1c"/>`;
    },
    syrup() {
      return `<rect x="488" y="210" width="48" height="60" rx="6" fill="url(#blk)"/><rect x="478" y="200" width="68" height="20" rx="4" fill="url(#gold)"/>
      <path d="M492 270 H532 V330 Q600 360 600 420 V740 Q600 762 578 762 H446 Q424 762 424 740 V420 Q424 360 492 330 Z" fill="#c9a24a" opacity=".92"/>
      <path d="M492 270 H532 V330 Q600 360 600 420 V740 Q600 762 578 762 H446 Q424 762 424 740 V420 Q424 360 492 330 Z" fill="url(#glass)"/>
      <rect x="424" y="470" width="176" height="210" fill="#fbf5ea"/>
      ${txt(512, 520, 'SIROP', 26, '#6b4a2a', 800, 'Arial,sans-serif', 'letter-spacing="4"')}${txt(512, 572, 'Vanille', 40, '#2a160a', 800, 'Georgia,serif', 'font-style="italic"')}
      <path d="M470 610 q42 -30 84 0" stroke="#d4a94f" stroke-width="4" fill="none"/><path d="M490 630 q22 -18 44 0 q-22 18 -44 0" fill="#e7c877"/>
      ${txt(512, 664, '70 cl', 20, '#6b4a2a', 700, 'Arial,sans-serif')}
      <rect x="440" y="420" width="12" height="300" rx="6" fill="#fff" opacity=".4"/>
      <g transform="translate(720 680) rotate(20)"><path d="M-8 -80 q-6 90 4 150 M8 -80 q6 90 -4 150" stroke="#3a2010" stroke-width="10" fill="none" stroke-linecap="round"/></g>
      <g transform="translate(300 700)"><path d="M-10 -40 q20 0 30 30 q-30 10 -40 -10 z" fill="#f6efe2"/><path d="M10 -40 q-20 0 -30 30 q30 10 40 -10 z" fill="#efe3c8"/><circle r="8" fill="#e7c877"/></g>`;
    }
  };

  const HUE = { 'Machines à café': 24, 'Moulins à café': 30, 'Cafés en grains': 22, 'Cafés moulus et capsules': 18, 'Accessoires barista': 34, 'Méthodes douces': 28, 'Entretien et détartrage': 205, 'Thés et chocolats': 110, };
  function productSVG(row) {
    const [name, sku, cat, , , , , , , ill] = row;
    const [k, ...args] = ill.split(':');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${bg(HUE[cat] ?? 24)}${D[k](...args)}
    <text x="512" y="880" font-family="Arial,sans-serif" font-size="20" fill="#e7c877" opacity=".75" text-anchor="middle" letter-spacing="3">${sku}</text></svg>`;
  }
  return { svg: productSVG };
})();

/* Générateur pseudo-aléatoire déterministe (même démo à chaque chargement) */
function seededRandom(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/* Photo de démonstration : l'illustration MaxiCoffee du produit (SVG, sans fichier externe) */
function demoPhoto(row) {
  return new Blob([MC_ART.svg(row)], { type: 'image/svg+xml' });
}

async function loadDemoData() {
  if (S.products.some(p => p.demo)) throw new Error('Les données de démonstration sont déjà chargées.');
  const rnd = seededRandom(20260929);
  const R = (a, b) => a + rnd() * (b - a);
  const today = todayISO();
  const DAYS = 120;
  const WIN = DAYS - 13;          // 2 dernières semaines : le stock converge vers l'état final prévu du catalogue
  const start = addDays(today, -DAYS);
  const at = (day, h = 9, m = 0) => { const d = new Date(day + 'T12:00:00'); d.setHours(h, m, 0, 0); return d.toISOString(); };

  /* ---- Référentiels : catégories MaxiCoffee ---- */
  const cats = [['Machines à café', 'Expresso manuelles, automatiques, capsules et filtre', 24], ['Moulins à café', 'Moulins électriques, manuels et professionnels', 30],
  ['Cafés en grains', 'Pure origines, assemblages et décaféinés', 22], ['Cafés moulus et capsules', 'Café moulu, capsules compatibles et dosettes ESE', 18],
  ['Accessoires barista', 'Tasseurs, pichets, balances, tasses', 34], ['Méthodes douces', 'Piston, italienne, dripper, bouilloires', 28],
  ['Entretien et détartrage', 'Détartrants, pastilles, filtres, pièces SAV', 205], ['Thés et chocolats', 'Thés, chocolats en poudre et sirops', 110]]
    .map(([name, description, hue], i) => ({ id: uid('cat'), name, description, color: i + 1, hue, createdAt: at(start), demo: true }));
  const C = n => cats.find(c => c.name === n);

  /* ---- Emplacements : réutilisés s'ils existent déjà (même nom), sinon créés ---- */
  const locs = [];
  const LOC = {};
  [['Showroom boutique', 'Boutique', 'Présentoirs, bar de dégustation et comptoir'],
  ['Entrepôt logistique', 'Plateforme', 'Rayonnages A à H — préparation des commandes web'],
  ['Réserve torréfaction', 'Atelier torréfaction', 'Cafés en grains et moulus, à l\'abri de la lumière'],
  ['Atelier SAV', 'Service après-vente', 'Pièces détachées et produits d\'entretien']].forEach(([name, site, description]) => {
    let l = S.locations.find(x => norm(x.name) === norm(name));
    if (!l) { l = { id: uid('loc'), name, site, description, createdAt: at(start), demo: true }; locs.push(l); }
    LOC[name] = l;
  });

  /* ---- Fournisseurs (fictifs) ---- */
  const sups = [
    ['Expresso Équipements Pro (démo)', 'Julien Morel', '04 94 00 00 01', 'commandes@expresso-equipements-demo.fr', '12 avenue des Métiers\n83300 Draguignan', '', '', '30 jours fin de mois', 5],
    ['Torréfaction du Var (démo)', 'Sandra Nguyen', '04 94 00 00 02', 'pro@torrefaction-var-demo.fr', 'ZI de la Palud\n83600 Fréjus', '', '', 'À réception de facture', 3],
    ['Capsul\'Sud Distribution (démo)', 'Marc Aubert', '04 91 00 00 03', 'ventes@capsulsud-demo.fr', '8 boulevard de la Méditerranée\n13015 Marseille', '', '', '30 jours fin de mois', 4],
    ['Barista Accessoires Pro (démo)', 'Inès Garnier', '04 78 00 00 04', 'contact@barista-accessoires-demo.fr', '21 rue du Moulin\n69007 Lyon', '', '', '45 jours fin de mois', 6],
    ['Hygiène Café Services (démo)', 'Service clients', '04 94 00 00 05', 'service@hygiene-cafe-demo.fr', 'Chemin de Sainte-Anne\n83300 Draguignan', '', '', 'Comptant à la commande', 3],
    ['Maison des Thés et Chocolats (démo)', 'Claire Rossi', '04 93 00 00 06', 'pro@maison-thes-chocolats-demo.fr', '5 place du Marché\n06130 Grasse', '', '', '30 jours fin de mois', 5]
  ].map(([name, contact, phone, email, address, website, siret, paymentTerms, leadTime]) => ({ id: uid('sup'), name, contact, phone, email, address, website, siret, paymentTerms, leadTime, comments: 'Fournisseur fictif de démonstration.', status: 'active', createdAt: at(start), updatedAt: at(start), demo: true }));
  const SU = i => sups[i].id;

  /* Catalogue MaxiCoffee — identique au tableau et aux 35 images numérotées 01 à 35.
     [nom, sku, catégorie, emplacement, unité, prix achat HT, prix vente, STOCK FINAL, seuil, max, lot, conso/jour, stock initial, fournisseur, illustration] */
  const catalog = [
    ['Machine expresso manuelle 15 bars inox', 'MC-MAC-EXP15', 'Machines à café', 'Showroom boutique', 'pièce', 189, 349, 8, 3, 12, 2, 0.12, 9, 0, 'espresso'],
    ['Machine à grains automatique écran tactile', 'MC-MAC-AUTO', 'Machines à café', 'Entrepôt logistique', 'pièce', 489, 799, 2, 3, 8, 1, 0.07, 7, 0, 'beantocup'],
    ['Machine à capsules compacte', 'MC-MAC-CAPS', 'Machines à café', 'Showroom boutique', 'pièce', 69, 119, 14, 5, 20, 5, 0.28, 16, 0, 'capsulemachine'],
    ['Cafetière filtre programmable 1,25 L', 'MC-MAC-FILT', 'Machines à café', 'Entrepôt logistique', 'pièce', 42, 79, 11, 4, 16, 4, 0.16, 12, 0, 'filter'],
    ['Machine expresso double chaudière pro', 'MC-MAC-DCPRO', 'Machines à café', 'Showroom boutique', 'pièce', 1290, 2190, 2, 1, 4, 1, 0.03, 3, 0, 'espressopro'],
    ['Moulin électrique à meules coniques', 'MC-MOU-CONIQ', 'Moulins à café', 'Showroom boutique', 'pièce', 129, 229, 9, 3, 12, 3, 0.12, 10, 0, 'grinder'],
    ['Moulin manuel à manivelle', 'MC-MOU-MANU', 'Moulins à café', 'Entrepôt logistique', 'pièce', 34, 59, 22, 5, 15, 5, 0.08, 14, 0, 'handgrinder'],
    ['Moulin professionnel dosage à la demande', 'MC-MOU-PRO', 'Moulins à café', 'Entrepôt logistique', 'pièce', 690, 1190, 3, 1, 5, 1, 0.03, 4, 0, 'grinderpro'],
    ['Café en grains Brésil Santos 1 kg', 'MC-CAF-BRE1K', 'Cafés en grains', 'Réserve torréfaction', 'sachet', 11.9, 21.9, 17, 15, 80, 10, 1.3, 60, 1, 'bag:BRÉSIL:Santos:#2f6b4f'],
    ['Café en grains Éthiopie Sidamo 1 kg', 'MC-CAF-ETH1K', 'Cafés en grains', 'Réserve torréfaction', 'sachet', 16.5, 29.9, 0, 10, 50, 10, 0.6, 35, 1, 'bag:ÉTHIOPIE:Sidamo:#8a3b2e'],
    ['Café en grains Colombie Supremo 1 kg', 'MC-CAF-COL1K', 'Cafés en grains', 'Réserve torréfaction', 'sachet', 13.2, 24.5, 36, 12, 60, 10, 0.9, 45, 1, 'bag:COLOMBIE:Supremo:#b0802a'],
    ['Café en grains Assemblage Espresso Bar 1 kg', 'MC-CAF-ESP1K', 'Cafés en grains', 'Réserve torréfaction', 'sachet', 12.4, 22.9, 8, 10, 60, 10, 1.4, 50, 1, 'bag:ESPRESSO:Assemblage bar:#1d1d1f'],
    ['Café en grains Décaféiné Pérou 500 g', 'MC-CAF-DECA5', 'Cafés en grains', 'Réserve torréfaction', 'sachet', 8.9, 15.9, 19, 8, 40, 5, 0.4, 25, 1, 'bag:DÉCA:Pérou:#3a5a8c'],
    ['Café moulu Pur Arabica 250 g', 'MC-CAF-MOU25', 'Cafés moulus et capsules', 'Showroom boutique', 'sachet', 3.1, 5.9, 64, 30, 150, 24, 2.5, 110, 1, 'brick'],
    ['Capsules compatibles Intenso (boîte de 10)', 'MC-CAP-INT10', 'Cafés moulus et capsules', 'Entrepôt logistique', 'boîte', 2.35, 3.9, 14, 20, 120, 24, 2.8, 90, 2, 'capsbox:INTENSO:#6e2a2a'],
    ['Capsules compatibles Lungo (boîte de 10)', 'MC-CAP-LUN10', 'Cafés moulus et capsules', 'Entrepôt logistique', 'boîte', 2.35, 3.9, 72, 20, 120, 24, 2.6, 95, 2, 'capsbox:LUNGO:#2c4f7a'],
    ['Dosettes papier ESE Classico (boîte de 50)', 'MC-DOS-ESE50', 'Cafés moulus et capsules', 'Entrepôt logistique', 'boîte', 9.8, 17.9, 18, 6, 30, 6, 0.45, 22, 2, 'pods'],
    ['Tasseur inox 58 mm', 'MC-ACC-TAS58', 'Accessoires barista', 'Showroom boutique', 'pièce', 14.5, 29.9, 26, 8, 40, 10, 0.4, 30, 3, 'tamper'],
    ['Pichet à lait inox 600 ml', 'MC-ACC-PIC60', 'Accessoires barista', 'Showroom boutique', 'pièce', 9.9, 19.9, 12, 10, 40, 10, 0.5, 30, 3, 'pitcher'],
    ['Bac à marc inox', 'MC-ACC-BAC', 'Accessoires barista', 'Entrepôt logistique', 'pièce', 18, 34.9, 10, 4, 20, 4, 0.2, 14, 3, 'knockbox'],
    ['Balance de précision avec minuteur', 'MC-ACC-BAL', 'Accessoires barista', 'Showroom boutique', 'pièce', 22, 44.9, 13, 5, 25, 5, 0.25, 18, 3, 'scale'],
    ['Coffret 6 tasses expresso porcelaine', 'MC-ACC-TAS6', 'Accessoires barista', 'Entrepôt logistique', 'boîte', 15.5, 32, 21, 6, 30, 6, 0.3, 24, 3, 'cups'],
    ['Mousseur à lait électrique', 'MC-ACC-MOUS', 'Accessoires barista', 'Showroom boutique', 'pièce', 39, 79, 0, 4, 15, 4, 0.2, 12, 3, 'frother'],
    ['Cafetière à piston 1 L', 'MC-DOU-PIST1', 'Méthodes douces', 'Showroom boutique', 'pièce', 17.9, 34.9, 15, 5, 25, 5, 0.3, 20, 3, 'press'],
    ['Cafetière italienne 6 tasses', 'MC-DOU-ITA6', 'Méthodes douces', 'Showroom boutique', 'pièce', 19.5, 36.9, 17, 6, 30, 6, 0.35, 22, 3, 'moka'],
    ['Dripper conique céramique + 100 filtres', 'MC-DOU-DRIP', 'Méthodes douces', 'Showroom boutique', 'pièce', 12.9, 26.9, 14, 5, 25, 5, 0.3, 18, 3, 'dripper'],
    ['Bouilloire col de cygne 1 L', 'MC-DOU-BOUIL', 'Méthodes douces', 'Entrepôt logistique', 'pièce', 34, 69, 7, 3, 12, 3, 0.12, 9, 3, 'kettle'],
    ['Détartrant liquide universel 500 ml', 'MC-ENT-DET50', 'Entretien et détartrage', 'Entrepôt logistique', 'pièce', 5.4, 11.9, 23, 20, 100, 24, 1.1, 70, 4, 'bottle:DÉTARTRANT:#2f7fb0'],
    ['Pastilles de nettoyage groupe (boîte de 100)', 'MC-ENT-PAS10', 'Entretien et détartrage', 'Atelier SAV', 'boîte', 11.9, 24.9, 3, 4, 20, 4, 0.25, 14, 4, 'tablets'],
    ['Cartouche filtrante anti-calcaire', 'MC-ENT-CART', 'Entretien et détartrage', 'Entrepôt logistique', 'pièce', 8.2, 16.9, 48, 15, 80, 20, 0.9, 60, 4, 'cartridge'],
    ['Brosse de nettoyage groupe', 'MC-ENT-BROS', 'Entretien et détartrage', 'Atelier SAV', 'pièce', 4.3, 9.9, 25, 6, 40, 10, 0.3, 30, 4, 'brush'],
    ['Joint de porte-filtre 58 mm', 'MC-SAV-JOINT', 'Entretien et détartrage', 'Atelier SAV', 'pièce', 1.2, 4.9, 55, 20, 100, 25, 0.8, 70, 4, 'gasket'],
    ['Thé vert Sencha bio 100 g', 'MC-THE-SEN10', 'Thés et chocolats', 'Showroom boutique', 'pièce', 5.6, 11.9, 27, 8, 40, 10, 0.4, 32, 5, 'teatin'],
    ['Chocolat en poudre 1 kg', 'MC-CHO-1KG', 'Thés et chocolats', 'Entrepôt logistique', 'sachet', 7.8, 14.9, 40, 8, 30, 6, 0, 40, 5, 'choco'],
    ['Sirop saveur vanille 70 cl', 'MC-SIR-VAN70', 'Thés et chocolats', 'Showroom boutique', 'pièce', 4.9, 9.5, 16, 6, 24, 6, 0.4, 20, 5, 'syrup']
  ];

  /* ---- Produits (copies de travail) ---- */
  const prods = []; const meta = new Map(); const media = [];
  catalog.forEach((c, i) => {
    const [name, sku, cat, locName, unit, buy, sell, target, min, max, lot, rate, init, sup, art] = c;
    const loc = LOC[locName];
    const ean = '37601234' + String(10001 + i * 7).padStart(5, '0');
    const p = { id: uid('prd'), name, sku, ean, description: `${name} — article de démonstration MaxiCoffee.`, categoryId: C(cat).id, supplierId: SU(sup), purchasePrice: buy, salePrice: sell, reserved: 0, minStock: min, maxStock: max, reorderQty: lot || null, unit, locationId: loc.id, stock: {}, photoId: null, status: 'active', createdAt: at(start, 8), updatedAt: at(start, 8), demo: true };
    const mid = uid('media');
    media.push({ id: mid, blob: demoPhoto([name, sku, cat, locName, unit, buy, target, min, max, art]), type: 'image/svg+xml', name: 'demo-' + sku, at: nowStamp(), demo: true });
    p.photoId = mid;
    prods.push(p);
    /* Certains produits accélèrent (hausse de consommation), un dort, d'autres filent vers la rupture */
    meta.set(p.id, { rate, init, target, loc, lot: lot || 1, buy, supIdx: sup, spike: i === 8 || i === 14, dormant: rate <= 0, starve: [1, 9, 11, 14, 22, 28].includes(i) });
  });
  prods[2].reserved = 2;                    // réservation client (machine à capsules)

  /* ---- Simulation jour par jour avec le moteur réel (makeMovement) ---- */
  let counters = clone(COUNTERS);
  const movements = [], orders = [], inventories = [], journal = [];
  const nextMv = () => { const r = nextNumbers(counters, 'mv'); counters = r.counters; return r.out[0]; };
  const push = (p, o) => { const mv = makeMovement(p, { ...o, allowNegative: false }, nextMv()); mv.at = mv.date; mv.demo = true; mv.operatorName = (SESSION_OP?.name || 'Démo'); movements.push(mv); return mv; };
  prods.forEach(p => { const m = meta.get(p.id); push(p, { type: 'initial', delta: m.init, locId: m.loc.id, unitCost: p.purchasePrice, comment: 'Stock initial (démonstration)', date: at(start, 8, 5) }); });
  const pending = [];   // commandes en cours de simulation
  const reasons = ['Vente boutique', 'Vente en ligne', 'Vente en ligne', 'Vente boutique', 'Vente professionnelle', 'Dégustation showroom'];
  const recips = ['Client comptoir', 'Commande web', 'Café Le Grand Bleu (pro)', 'Client Martin', 'Restaurant L\'Olivier (pro)', 'Hôtel des Arcades (pro)'];
  const saleReason = () => reasons[Math.floor(rnd() * reasons.length)];
  const sale = (p, q, day) => {
    const reason = saleReason();
    return push(p, { type: 'out', delta: -q, locId: p.locationId, reason, recipient: reason.startsWith('Vente') ? recips[Math.floor(rnd() * recips.length)] : '', date: at(day, 9 + Math.floor(rnd() * 8), Math.floor(rnd() * 59)), docRef: reason.startsWith('Vente') ? 'TK-' + (1000 + movements.length) : '' });
  };
  const openOrder = (day, supIdx, lines) => {
    const r = nextNumbers(counters, 'orders'); counters = r.counters;
    const lead = sups[supIdx].leadTime;
    const o = { id: uid('ord'), number: r.out[0], supplierId: SU(supIdx), createdAt: at(day, 10), expectedDate: addDays(day, lead), lines: lines.map(l => ({ id: uid('ol'), productId: l.p.id, qty: l.qty, unitPrice: round2(l.price), received: 0 })),
      vatRate: 20, paymentTerms: sups[supIdx].paymentTerms, comments: 'Commande de démonstration.', status: 'sent', sentAt: at(day, 11), validatedAt: at(day, 10, 30),
      history: [{ at: at(day, 10), status: 'draft', by: 'Démo' }, { at: at(day, 10, 30), status: 'validated', by: 'Démo' }, { at: at(day, 11), status: 'sent', by: 'Démo' }], receptions: [], operatorId: SESSION_OP?.id || null, demo: true };
    const pd = { o, due: addDays(day, lead + Math.floor(R(0, 3))) };
    orders.push(o); pending.push(pd);
    return pd;
  };
  /* Quantité encore attendue (commandes qui arriveront avant aujourd'hui) */
  const incoming = p => sum(pending.filter(pd => !pd.hold), pd => sum(pd.o.lines.filter(l => l.productId === p.id), lineRemaining));
  const openDaysLeft = d => { let n = 0; for (let k = d; k <= DAYS; k++) if (new Date(addDays(start, k) + 'T12:00:00').getDay() !== 0) n++; return n; };

  for (let d = 1; d <= DAYS; d++) {
    const day = addDays(start, d);
    const dow = new Date(day + 'T12:00:00').getDay();
    if (dow === 0) continue;                        // fermé le dimanche

    /* Début de la période finale : les commandes qui n'arriveront pas avant aujourd'hui restent « en route »,
       et une commande de réassort est passée pour les produits dont le stock final prévu est supérieur */
    if (d >= WIN && !pending.winDone) {
      pending.winDone = true;
      pending.forEach(pd => { if (pd.due > today) pd.hold = true; });
      const bySup = new Map();
      prods.forEach(p => {
        const m = meta.get(p.id);
        const gap = productQty(p) + incoming(p) - m.target;
        if (gap >= 0) return;
        let qty = -gap + (m.dormant ? 0 : Math.round(m.rate * openDaysLeft(d) * 0.6));
        qty = Math.ceil(qty / m.lot) * m.lot;
        if (!bySup.has(m.supIdx)) bySup.set(m.supIdx, []);
        bySup.get(m.supIdx).push({ p, qty, price: m.buy });
      });
      bySup.forEach((lines, supIdx) => { const pd = openOrder(day, supIdx, lines); pd.due = addDays(day, Math.min(6, Math.max(2, sups[supIdx].leadTime))); });
    }

    /* Réceptions des commandes arrivées */
    for (const pd of pending.slice()) {
      if (pd.due > day || pd.hold) continue;
      const o = pd.o; const partial = o.number.endsWith('7') && !pd.done && d < WIN;
      const recId = uid('rec'); const items = [];
      o.lines.forEach(l => {
        const p = prods.find(x => x.id === l.productId);
        const q = partial ? Math.max(1, Math.floor(l.qty / 2)) : lineRemaining(l);
        if (q <= 0) return;
        const mv = push(p, { type: 'reception', delta: q, locId: p.locationId, unitCost: l.unitPrice, supplierId: o.supplierId, docRef: 'BL-' + o.number.slice(-4), date: at(day, 8, 30), orderId: o.id, orderLineId: l.id, receptionId: recId });
        l.received = round3((l.received || 0) + q); items.push({ lineId: l.id, qty: q, locId: mv.locId, movementId: mv.id });
      });
      o.receptions.push({ id: recId, at: at(day, 8, 30), date: at(day, 8, 30), docRef: 'BL-' + o.number.slice(-4), comment: partial ? 'Livraison incomplète : reliquat annoncé.' : '', by: 'Démo', items });
      const st = o.lines.every(l => lineRemaining(l) <= 0) ? 'received' : 'partial';
      o.status = st; o.history.push({ at: at(day, 8, 30), status: st, by: 'Démo' });
      if (st === 'received') pending.splice(pending.indexOf(pd), 1); else { pd.done = true; pd.due = addDays(day, 4); if (pd.due > today) pd.hold = true; }
    }

    /* Sorties quotidiennes (ventes boutique, web, professionnels) */
    prods.forEach(p => {
      const m = meta.get(p.id);
      if (m.dormant) return;
      const avail = p.stock[p.locationId] || 0;
      let q = 0;
      if (d < WIN) {
        let rate = m.rate * (dow === 6 ? 1.3 : 1);      // le samedi est une grosse journée en boutique
        if (m.spike && d > DAYS - 30) rate *= 2.2;
        const L = Math.exp(-rate); let k = 0, pr = 1; do { k++; pr *= rnd(); } while (pr > L && k < 60); q = k - 1;
      } else {
        /* Période finale : ventes réparties pour atteindre exactement le stock prévu aujourd'hui */
        const gap = productQty(p) + incoming(p) - m.target;
        const n = openDaysLeft(d);
        q = n <= 1 ? gap : Math.round(gap / n * R(0.4, 1.6));
      }
      q = Math.min(q, avail);
      if (q > 0) sale(p, q, day);
    });

    /* Réapprovisionnement automatique : commande groupée par fournisseur quand le seuil est atteint */
    if (d < WIN && dow >= 1 && dow <= 5) {
      const bySup = new Map();
      prods.forEach(p => {
        const m = meta.get(p.id); const q = productQty(p);
        if (m.starve && d > DAYS - 40) return;          // laisse filer vers la rupture
        if (p.minStock <= 0 || q > p.minStock) return;
        if (orders.some(o => ['sent', 'partial'].includes(o.status) && o.lines.some(l => l.productId === p.id && lineRemaining(l) > 0))) return;
        const target = p.maxStock || p.minStock * 3; let qty = Math.max(m.lot, Math.ceil(target - q)); qty = Math.ceil(qty / m.lot) * m.lot;
        if (!bySup.has(m.supIdx)) bySup.set(m.supIdx, []);
        bySup.get(m.supIdx).push({ p, qty, price: m.buy });
      });
      bySup.forEach((lines, supIdx) => openOrder(day, supIdx, lines));
    }

    /* Inventaire tournant validé il y a ~45 jours (Cafés en grains) */
    if (d === DAYS - 45) {
      const r = nextNumbers(counters, 'inventories'); counters = r.counters;
      const ids = prods.filter(p => p.categoryId === C('Cafés en grains').id);
      const inv = { id: uid('inv'), number: r.out[0], name: 'Inventaire tournant — Cafés en grains', scope: { type: 'category', value: C('Cafés en grains').id }, status: 'validated', createdAt: at(day, 7, 30), openedAt: at(day, 7, 45), reviewAt: at(day, 11), validatedAt: at(day, 11, 20), validatedBy: SESSION_OP?.name || 'Démo',
        lines: [], observations: 'Comptage réalisé avant ouverture. Écart sur l\'Éthiopie : sachets de dégustation ouverts au showroom.', attachments: [], history: [{ at: at(day, 7, 30), status: 'draft', by: 'Démo' }, { at: at(day, 7, 45), status: 'counting', by: 'Démo' }, { at: at(day, 11), status: 'review', by: 'Démo' }, { at: at(day, 11, 20), status: 'validated', by: 'Démo' }], adjustments: [], demo: true };
      ids.forEach((p, i) => Object.entries(p.stock).forEach(([l, q]) => {
        const diff = i === 1 ? -3 : i === 3 ? 6 : i === 0 ? -1 : 0;
        inv.lines.push({ id: uid('il'), productId: p.id, locId: l, theoretical: q, counted: Math.max(0, q + diff), note: diff ? (diff < 0 ? 'Manquant constaté' : 'Carton retrouvé en réserve') : '' });
        if (diff && Math.max(0, q + diff) !== q) { const mv = push(p, { type: 'inventory', delta: Math.max(0, q + diff) - q, locId: l, inventoryId: inv.id, docRef: inv.number, reason: diff > 0 ? 'Écart positif' : 'Écart négatif', date: at(day, 11, 20) }); inv.adjustments.push(mv.id); }
      }));
      inventories.push(inv);
    }
  }

  /* Filet de sécurité : garantit l'état final exact du catalogue (normalement aucun ajustement) */
  prods.forEach(p => {
    const m = meta.get(p.id); const diff = round3(m.target - productQty(p));
    if (diff) push(p, { type: 'adjust', delta: diff, locId: p.locationId, reason: 'Correction de saisie', comment: 'Mise en cohérence des données de démonstration', date: at(today, 8, 0) });
  });

  /* Une commande EN RETARD (accessoires barista) */
  const lateP = prods.filter(p => meta.get(p.id).supIdx === 3).slice(0, 2);
  const late = openOrder(addDays(today, -12), 3, lateP.map(p => ({ p, qty: 6, price: p.purchasePrice })));
  late.o.expectedDate = addDays(today, -4); late.hold = true;
  late.o.comments = 'Relance téléphonique à prévoir.';

  /* Une commande EN ROUTE pour le café en rupture (Éthiopie) : livraison attendue dans 3 jours */
  const eth = prods[9];
  const route = openOrder(addDays(today, -2), 1, [{ p: eth, qty: 30, price: eth.purchasePrice }]);
  route.o.expectedDate = addDays(today, 3); route.hold = true;
  route.o.comments = 'Réassort urgent : produit en rupture.';

  /* Un inventaire en cours de comptage (Accessoires barista) pour tester le module */
  {
    const r = nextNumbers(counters, 'inventories'); counters = r.counters;
    const ids = prods.filter(p => p.categoryId === C('Accessoires barista').id);
    const inv = { id: uid('inv'), number: r.out[0], name: 'Contrôle rayon Accessoires barista', scope: { type: 'category', value: C('Accessoires barista').id }, status: 'counting', createdAt: at(addDays(today, -1), 17), openedAt: at(addDays(today, -1), 17, 5), openedSeq: counters.mv,
      lines: [], observations: '', attachments: [], history: [{ at: at(addDays(today, -1), 17), status: 'draft', by: 'Démo' }, { at: at(addDays(today, -1), 17, 5), status: 'counting', by: 'Démo' }], adjustments: [], demo: true };
    ids.forEach((p, i) => Object.entries(p.stock).filter(([, q]) => q !== 0).forEach(([l, q]) => inv.lines.push({ id: uid('il'), productId: p.id, locId: l, theoretical: q, counted: i < 3 ? q - (i === 1 ? 1 : 0) : null, note: i === 1 ? 'Emballage abîmé' : '' })));
    inventories.push(inv);
  }

  /* Journal : événements marquants */
  prods.forEach(p => journal.push({ id: uid('jr'), at: p.createdAt, kind: 'product', text: `a créé le produit <b>${esc(p.name)}</b>`, ref: { type: 'product', id: p.id }, operatorName: 'Démo', demo: true }));
  orders.forEach(o => journal.push({ id: uid('jr'), at: o.createdAt, kind: 'order', text: `a créé la commande <b>${o.number}</b> (${esc(sups.find(s => s.id === o.supplierId).name)})`, ref: { type: 'order', id: o.id }, operatorName: 'Démo', demo: true }));
  inventories.forEach(v => journal.push({ id: uid('jr'), at: v.createdAt, kind: 'inventory', text: `a créé l'inventaire <b>${v.number}</b>`, ref: { type: 'inventory', id: v.id }, operatorName: 'Démo', demo: true }));
  orders.forEach(o => { if (o.status === 'partial' || o.status === 'received') o.receptions.forEach(rc => journal.push({ id: uid('jr'), at: rc.at, kind: 'reception', text: `a réceptionné la commande <b>${o.number}</b>`, ref: { type: 'order', id: o.id }, operatorName: 'Démo', demo: true })); });

  await commit({
    put: { categories: cats.map(({ hue, ...c }) => c), locations: locs, suppliers: sups, products: prods, movements, orders, inventories, journal, media },
    kv: { counters }
  }, { what: 'demo' });
  const sidx = S.journal.length;
  return { products: prods.length, movements: movements.length, orders: orders.length, sidx };
}

/* Suppression des données de démonstration (les données réelles sont conservées) */
function confirmRemoveDemo() {
  const n = { p: S.products.filter(p => p.demo).length, m: S.movements.filter(m => m.demo).length, o: S.orders.filter(o => o.demo).length };
  confirmDialog(`Supprimer les données de démonstration ? ${n.p} produits, ${n.m} mouvements, ${n.o} commandes et les fournisseurs, catégories, emplacements, inventaires et images fictifs seront effacés. Vos propres données sont conservées.`,
    async () => { const r = await removeDemoData(); toast(`Démonstration supprimée${r.kept ? ` (${r.kept} élément(s) fictif(s) conservé(s) car utilisé(s) par vos données)` : ''}.`, 'ok', 6000); }, { yes: 'Supprimer la démonstration' });
}
async function removeDemoData() {
  requireRight('demo', 'supprimer les données de démonstration');
  const demoProd = new Set(S.products.filter(p => p.demo).map(p => p.id));
  const del = { products: [...demoProd], movements: [], orders: [], inventories: [], journal: [], categories: [], locations: [], suppliers: [], media: [] };
  const put = { products: [], categories: [], locations: [], suppliers: [], inventories: [] };
  S.movements.forEach(m => { if (m.demo || demoProd.has(m.productId)) del.movements.push(m.id); });
  S.orders.forEach(o => { if (o.demo || o.lines.every(l => demoProd.has(l.productId))) del.orders.push(o.id); });
  S.inventories.forEach(v => { if (v.demo) del.inventories.push(v.id); else if (v.lines.some(l => demoProd.has(l.productId))) put.inventories.push({ ...clone(v), lines: v.lines.filter(l => !demoProd.has(l.productId)) }); });
  S.journal.forEach(j => { if (j.demo || (j.ref?.type === 'product' && demoProd.has(j.ref.id))) del.journal.push(j.id); });
  const realP = S.products.filter(p => !p.demo);
  const realMv = S.movements.filter(m => !del.movements.includes(m.id));
  const realOrd = S.orders.filter(o => !del.orders.includes(o.id));
  let kept = 0;
  /* Référentiels fictifs : supprimés sauf s'ils sont utilisés par des données réelles (alors conservés et « dé-marqués ») */
  S.categories.filter(c => c.demo).forEach(c => { if (realP.some(p => p.categoryId === c.id)) { put.categories.push({ ...c, demo: false }); kept++; } else del.categories.push(c.id); });
  S.suppliers.filter(s => s.demo).forEach(s => { if (realP.some(p => p.supplierId === s.id) || realOrd.some(o => o.supplierId === s.id) || realMv.some(m => m.supplierId === s.id)) { put.suppliers.push({ ...s, demo: false }); kept++; } else del.suppliers.push(s.id); });
  S.locations.filter(l => l.demo).forEach(l => { if (realP.some(p => (p.stock?.[l.id] || 0) !== 0 || p.locationId === l.id) || realMv.some(m => m.locId === l.id || m.toLocId === l.id)) { put.locations.push({ ...l, demo: false }); kept++; } else del.locations.push(l.id); });
  const media = await IDB.getAll('media');
  const usedPhotos = new Set(realP.map(p => p.photoId).filter(Boolean));
  media.forEach(m => { if (m.demo && !usedPhotos.has(m.id)) del.media.push(m.id); });
  del.media.forEach(forgetMediaURL);
  const alertSeen = Object.fromEntries(Object.entries(ALERT_SEEN).filter(([k]) => !demoProd.has(k.split(':')[1]) && !del.orders.includes(k.split(':')[1])));
  Object.keys(put).forEach(k => { if (!put[k].length) delete put[k]; });
  Object.keys(del).forEach(k => { if (!del[k].length) delete del[k]; });
  await commit({ del, put, kv: { alertSeen } }, { what: 'demo' });
  return { kept };
}

