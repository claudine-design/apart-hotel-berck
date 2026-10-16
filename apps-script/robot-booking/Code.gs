/**
 * Robot Messages Booking — interface de validation (Apps Script)
 * ---------------------------------------------------------------
 * À coller dans un Apps Script LIÉ à un Google Sheet (Extensions > Apps Script).
 * Puis : exécuter une fois setup(), et déployer en Web App
 * (Exécuter en tant que : moi / Accès : tout le monde disposant du lien).
 *
 * Rôles :
 *  - doPost addProposals : le robot local pousse les propositions.
 *  - doGet  getLearning  : le robot lit l'historique d'apprentissage d'un appart.
 *  - doGet  (défaut)     : interface mobile de validation (?k=SECRET obligatoire).
 *  - Envoi Beds24 : UNIQUEMENT au clic de Claudine, si BEDS24_WRITE_REFRESH_TOKEN
 *    est renseigné dans les Script Properties. Sinon mode « copier/coller ».
 */

var TAB_PROPS = 'Propositions';
var TAB_HISTO = 'Historique';
var TAB_LOG = 'Log';

// [Contournement Cowork] script autonome lie au Sheet par ID (le script lie au Sheet echouait cote Google pour un compte secondaire).
// [REDACTION dépôt public] l'ID réel du Google Sheet est stocké dans la Script Property SHEET_ID.
var SHEET_ID = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || '<SHEET_ID_DANS_PROPRIETES_DU_SCRIPT>';
function activeSS_() { return SpreadsheetApp.openById(SHEET_ID); }

var COLS = ['id', 'genere_le', 'bookingId', 'msgId', 'propId', 'appart', 'voyageur',
            'arrivee', 'depart', 'categorie', 'besoin_claudine', 'note_interne',
            'option_type', 'option_detail',
            'question', 'conversation', 'proposition', 'reponse_finale', 'statut', 'traite_le',
            'langue', 'question_orig', 'urgence'];

// Calendrier des alertes draps/ménage (modifiable dans les Script Properties : CALENDRIER_DRAPS)
var CALENDRIER_DRAPS_DEFAUT = 'DRAP/ CHECK IN-OUT';
var OPTION_LABELS = {
  pack_linge: '🛏️ PACK LINGE',
  animal: '🐕 ANIMAL',
  arrivee_anticipee: '⏰ ARRIVÉE ANTICIPÉE',
  depart_tardif: '⏰ DÉPART TARDIF'
};

function setup() {
  var ss = activeSS_();
  if (!ss.getSheetByName(TAB_PROPS)) {
    ss.insertSheet(TAB_PROPS).appendRow(COLS);
  }
  if (!ss.getSheetByName(TAB_HISTO)) {
    ss.insertSheet(TAB_HISTO).appendRow(
      ['date', 'propId', 'appart', 'question', 'proposition', 'reponse_finale', 'action']);
  }
  if (!ss.getSheetByName(TAB_LOG)) {
    ss.insertSheet(TAB_LOG).appendRow(['date', 'quoi', 'detail']);
  }
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SECRET')) {
    props.setProperty('SECRET', Utilities.getUuid());
  }
  Logger.log('SECRET (à copier dans config.json du robot) : ' + props.getProperty('SECRET'));
}

function logRow(quoi, detail) {
  try {
    activeSS_().getSheetByName(TAB_LOG)
      .appendRow([new Date(), quoi, String(detail).slice(0, 800)]);
  } catch (e) {}
}

function secretOk(s) {
  return s && s === PropertiesService.getScriptProperties().getProperty('SECRET');
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- API robot ---------------- */

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ error: 'JSON invalide' });
  }
  if (!secretOk(body.secret)) return json({ error: 'secret' });

  if (body.action === 'addProposals') {
    var sheet = activeSS_().getSheetByName(TAB_PROPS);
    var existants = {};
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) existants[String(data[i][0])] = true;
    var n = 0;
    (body.items || []).forEach(function (it) {
      if (existants[String(it.id)]) return; // idempotent
      sheet.appendRow(COLS.map(function (c) {
        if (c === 'reponse_finale' || c === 'traite_le') return '';
        var v = it[c];
        return (v === null || v === undefined) ? '' : v;
      }));
      n++;
    });
    logRow('addProposals', n + ' ajoutée(s)');
    return json({ success: true, added: n });
  }
  // Actions de l'interface statique (GitHub Pages) — POST text/plain, pas de preflight CORS
  if (body.action === 'valider') {
    return json(apiValider(body.secret, body.id, String(body.texte || ''), !!body.cal));
  }
  if (body.action === 'rejeter') {
    return json(apiRejeter(body.secret, body.id));
  }
  // « Conversation lue / pas de réponse requise » : marque les messages voyageur
  // non lus de la résa comme LUS côté Beds24 (objectif : purger les notifs Pulse).
  if (body.action === 'marquerLu') {
    return json(apiMarquerLu(body.secret, body.id));
  }
  // Reformulation à la demande de Claudine (consigne tapée ou dictée dans l'app)
  if (body.action === 'reformuler') {
    return json(apiReformuler(body.secret, body.id, String(body.consigne || '')));
  }
  // Le PC pousse les fiches de connaissances (kb/*.md) vers l'onglet KB
  if (body.action === 'setKB') {
    var ss = activeSS_();
    var sheet = ss.getSheetByName('KB') || ss.insertSheet('KB');
    sheet.clearContents();
    sheet.appendRow(['slug', 'contenu', 'maj_le']);
    var fiches = body.fiches || {};
    var rows = Object.keys(fiches).map(function (slug) {
      return [slug, String(fiches[slug]).slice(0, 49500), new Date()];
    });
    if (rows.length) sheet.getRange(2, 1, rows.length, 3).setValues(rows);
    logRow('setKB', rows.length + ' fiche(s) reçue(s)');
    return json({ success: true, fiches: rows.length });
  }
  return json({ error: 'action inconnue' });
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'getLearning') {
    if (!secretOk(p.secret)) return json({ error: 'secret' });
    var sheet = activeSS_().getSheetByName(TAB_HISTO);
    var data = sheet.getDataRange().getValues();
    var items = [];
    for (var i = data.length - 1; i >= 1 && items.length < (Number(p.n) || 8); i--) {
      if (String(data[i][1]) !== String(p.propId)) continue;
      items.push({ question: data[i][3], proposition: data[i][4],
                   reponse_finale: data[i][5], action: data[i][6] });
    }
    return json({ items: items.reverse() });
  }
  // Liste des propositions en attente (pour l'interface statique GitHub Pages)
  if (p.action === 'list') {
    if (!secretOk(p.secret)) return json({ error: 'secret' });
    return json(apiList(p.secret));
  }
  // Scan cloud : déclenchable par HTTP (tests) — le régulier passe par le trigger 5 min
  if (p.action === 'scan') {
    if (!secretOk(p.secret)) return json({ error: 'secret' });
    return json(scanCloud());
  }
  // Installe (ou réinstalle) le déclencheur temporel du scan cloud
  if (p.action === 'installerTrigger') {
    if (!secretOk(p.secret)) return json({ error: 'secret' });
    return json(installerTriggerScan());
  }
  // Interface web
  if (!secretOk(p.k)) {
    return HtmlService.createHtmlOutput('<p style="font-family:sans-serif">Accès refusé — il manque la clé ?k=…</p>');
  }
  var t = HtmlService.createTemplateFromFile('Interface');
  t.secret = p.k;
  return t.evaluate()
    .setTitle('Messages Booking — validation')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ---------------- Fonctions interface (google.script.run) ---------------- */

function apiList(secret) {
  if (!secretOk(secret)) throw new Error('secret');
  var sheet = activeSS_().getSheetByName(TAB_PROPS);
  var data = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    COLS.forEach(function (c, j) { row[c] = data[i][j]; });
    row._row = i + 1;
    // en_attente = à valider ; courtoisie = sans réponse nécessaire, à marquer « lu »
    if (row.statut === 'en_attente' || row.statut === 'courtoisie') out.push(row);
  }
  out.sort(function (a, b) { return String(b.genere_le).localeCompare(String(a.genere_le)); });
  return { items: out, envoiActif: !!PropertiesService.getScriptProperties()
                                       .getProperty('BEDS24_WRITE_REFRESH_TOKEN') };
}

function findRow(id) {
  var sheet = activeSS_().getSheetByName(TAB_PROPS);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return { sheet: sheet, i: i + 1, values: data[i] };
  }
  return null;
}

function setCell(r, col, value) {
  r.sheet.getRange(r.i, COLS.indexOf(col) + 1).setValue(value);
}

function histo(r, reponseFinale, action) {
  activeSS_().getSheetByName(TAB_HISTO).appendRow([
    new Date(), r.values[COLS.indexOf('propId')], r.values[COLS.indexOf('appart')],
    r.values[COLS.indexOf('question')], r.values[COLS.indexOf('proposition')],
    reponseFinale || '', action]);
}

/** Valide et envoie (ou marque à envoyer manuellement si pas de token d'écriture).
 *  Si avecCalendrier=true et qu'une option est détectée : crée l'événement
 *  dans le calendrier DRAP/ CHECK IN-OUT le jour de l'arrivée. */
function apiValider(secret, id, texteFinal, avecCalendrier) {
  if (!secretOk(secret)) throw new Error('secret');
  var r = findRow(id);
  if (!r) throw new Error('proposition introuvable');
  var proposition = String(r.values[COLS.indexOf('proposition')] || '');
  var action = (texteFinal.trim() === proposition.trim()) ? 'validee' : 'modifiee';
  var bookingId = r.values[COLS.indexOf('bookingId')];

  // Claudine valide/édite en FRANÇAIS ; le voyageur reçoit sa langue.
  var langue = String(r.values[COLS.indexOf('langue')] || 'fr').toLowerCase();
  var texteEnvoye = texteFinal;
  if (langue && langue !== 'fr') {
    try {
      texteEnvoye = traduireDepuisFr(texteFinal, langue) || texteFinal;
    } catch (e) {
      logRow('traduction', bookingId + ' (' + langue + ') échec : ' + e.message + ' -> envoi en FR');
    }
  }
  var envoi = envoyerBeds24(bookingId, texteEnvoye);
  setCell(r, 'reponse_finale', texteFinal + (langue !== 'fr' ? '\n\n[envoyé en ' + langue + ' : ' + texteEnvoye + ']' : ''));
  setCell(r, 'traite_le', new Date());
  setCell(r, 'statut', envoi.ok ? 'envoyee' : 'a_envoyer_manuel');
  histo(r, texteFinal, action);
  if (envoi.ok) {
    try { marquerConversationLue(bookingId); } catch (e) {
      logRow('marquerLu', 'après envoi ' + bookingId + ' : ' + e.message);
    }
  }

  var calendrier = '';
  if (avecCalendrier) {
    try {
      calendrier = creerEventOption(r);
    } catch (e) {
      // Un souci de calendrier ne doit JAMAIS bloquer l'envoi du message déjà parti.
      calendrier = 'erreur calendrier : ' + e.message;
      logRow('calendrier', 'ERREUR ' + id + ' : ' + e.message);
    }
  }
  logRow('valider', id + ' -> ' + (envoi.ok ? 'envoyée via Beds24' : 'à envoyer manuellement (' + envoi.raison + ')') +
         (calendrier ? ' | calendrier: ' + calendrier : ''));
  return { envoyee: envoi.ok, raison: envoi.raison || '', calendrier: calendrier };
}

/** Événement tout-le-jour dans DRAP/ CHECK IN-OUT le jour d'arrivée du voyageur. */
function creerEventOption(r) {
  var type = String(r.values[COLS.indexOf('option_type')] || '');
  if (!type) return '';
  var label = OPTION_LABELS[type] || ('🔔 ' + type.toUpperCase());
  var appart = r.values[COLS.indexOf('appart')];
  var voyageur = r.values[COLS.indexOf('voyageur')];
  var detail = r.values[COLS.indexOf('option_detail')];
  var arrivee = r.values[COLS.indexOf('arrivee')];
  var depart = r.values[COLS.indexOf('depart')];
  var nomCal = PropertiesService.getScriptProperties().getProperty('CALENDRIER_DRAPS') || CALENDRIER_DRAPS_DEFAUT;
  var cals = CalendarApp.getCalendarsByName(nomCal);
  if (!cals.length) {
    logRow('calendrier', 'INTROUVABLE : ' + nomCal);
    return 'calendrier « ' + nomCal + ' » introuvable';
  }
  // Départ tardif → jour du DÉPART ; toutes les autres options → jour d'ARRIVÉE.
  var raw = (type === 'depart_tardif') ? depart : arrivee;
  var base = (raw instanceof Date) ? raw : new Date(String(raw).substring(0, 10) + 'T12:00:00');
  if (isNaN(base.getTime())) {
    logRow('calendrier', 'date invalide (' + type + ') : ' + raw);
    return 'date invalide';
  }
  // Événement journée entière posé sur LE bon jour (indépendant du fuseau).
  var d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  // Emoji devant le nom de l'appart pour signaler aux prestataires une option spéciale :
  //  arrivée anticipée / départ tardif → ⚠️ + ⏰ ; pack linge → ⚠️ seul.
  var prefixOption = (type === 'arrivee_anticipee' || type === 'depart_tardif') ? '⚠️⏰ '
                   : (type === 'pack_linge') ? '⚠️ ' : '';
  var titre = prefixOption + String(appart).toUpperCase() + ' — ' + label + ' — ' + voyageur + (detail ? ' (' + detail + ')' : '') + ' 💰?';
  cals[0].createAllDayEvent(titre, d, {
    description: 'Créé automatiquement par le robot messages Booking à la validation de la réponse.\n' +
                 '💰? = PAIEMENT À VÉRIFIER : le voyageur doit confirmer par message sur la plateforme ' +
                 'que le virement/PayPal est fait (l\'événement est créé sans attendre, pour l\'organisation).\n' +
                 'Résa ' + r.values[COLS.indexOf('bookingId')] + ' — séjour ' + arrivee + ' → ' +
                 r.values[COLS.indexOf('depart')] + '\nDétail : ' + (detail || '—')
  });
  return titre;
}

/**
 * À LANCER UNE FOIS dans l'éditeur Apps Script (menu ▶ Exécuter) après avoir collé
 * ce code : déclenche la demande d'autorisation Google Agenda et vérifie que le
 * calendrier cible existe. Regarder l'exécution (journal) : doit afficher « OK ».
 */
function _autoriserCalendrier() {
  var nomCal = PropertiesService.getScriptProperties().getProperty('CALENDRIER_DRAPS') || CALENDRIER_DRAPS_DEFAUT;
  var cals = CalendarApp.getCalendarsByName(nomCal);
  if (cals.length) {
    Logger.log('OK — calendrier trouvé : ' + nomCal + ' (' + cals[0].getId() + ')');
  } else {
    var noms = CalendarApp.getAllCalendars().map(function(c){ return c.getName(); });
    Logger.log('INTROUVABLE : « ' + nomCal + ' ». Calendriers disponibles : ' + noms.join(' | '));
  }
}

/** Bouton « ✓ Conversation lue » : marque lus les messages voyageur de la résa. */
function apiMarquerLu(secret, id) {
  if (!secretOk(secret)) throw new Error('secret');
  var r = findRow(id);
  if (!r) throw new Error('proposition introuvable');
  var bookingId = r.values[COLS.indexOf('bookingId')];
  var res = marquerConversationLue(bookingId);
  setCell(r, 'statut', 'lu');
  setCell(r, 'traite_le', new Date());
  histo(r, '', 'lu_sans_reponse');
  return { ok: true, marques: res.marques };
}

/** Marque LUS tous les messages voyageur non lus d'une résa (côté Beds24). */
function marquerConversationLue(bookingId) {
  var tok = beds24TokenEcriture();
  if (!tok) return { marques: 0, raison: 'pas de token écriture' };
  var resp = UrlFetchApp.fetch(
    'https://api.beds24.com/v2/bookings/messages?bookingId=' + Number(bookingId) +
    '&filter=unread&source=guest',
    { headers: { token: tok }, muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    logRow('marquerLu', 'GET échec HTTP ' + resp.getResponseCode());
    return { marques: 0, raison: 'HTTP ' + resp.getResponseCode() };
  }
  var data = (JSON.parse(resp.getContentText()).data) || [];
  if (!data.length) return { marques: 0 };
  var payload = data.map(function (m) { return { id: m.id, read: true }; });
  var post = UrlFetchApp.fetch('https://api.beds24.com/v2/bookings/messages', {
    method: 'post', contentType: 'application/json', headers: { token: tok },
    payload: JSON.stringify(payload), muteHttpExceptions: true });
  logRow('marquerLu', 'resa ' + bookingId + ' : ' + payload.length + ' message(s) -> HTTP ' +
         post.getResponseCode() + ' ' + post.getContentText().slice(0, 200));
  return { marques: payload.length };
}

/** Traduit un texte français vers la langue cible (code ISO) via Claude.
 *  Nécessite la Script Property ANTHROPIC_API_KEY. Renvoie null si indisponible. */
function traduireDepuisFr(texteFr, langue) {
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) { logRow('traduction', 'ANTHROPIC_API_KEY absente -> pas de traduction'); return null; }
  var noms = { de: 'allemand', en: 'anglais', nl: 'néerlandais', es: 'espagnol',
               it: 'italien', pt: 'portugais', pl: 'polonais' };
  var cible = noms[langue] || langue;
  var payload = {
    model: 'claude-sonnet-4-6', max_tokens: 800, temperature: 0,
    system: 'Tu es un traducteur. Traduis fidèlement le message d\'un hôte à son voyageur, ' +
            'en gardant le ton chaleureux, les smileys et la mise en forme. Réponds UNIQUEMENT ' +
            'avec la traduction, sans guillemets ni commentaire.',
    messages: [{ role: 'user', content: 'Traduis en ' + cible + ' :\n\n' + texteFr }]
  };
  var resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(payload), muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    logRow('traduction', 'HTTP ' + resp.getResponseCode() + ' ' + resp.getContentText().slice(0, 200));
    return null;
  }
  return JSON.parse(resp.getContentText()).content[0].text.trim();
}

function apiRejeter(secret, id) {
  if (!secretOk(secret)) throw new Error('secret');
  var r = findRow(id);
  if (!r) throw new Error('proposition introuvable');
  setCell(r, 'statut', 'rejetee');
  setCell(r, 'traite_le', new Date());
  histo(r, '', 'rejetee');
  return { ok: true };
}

/* ---------------- Envoi Beds24 (token ÉCRITURE, séparé du token lecture) ---------------- */

function beds24TokenEcriture() {
  var cache = CacheService.getScriptCache();
  var tok = cache.get('beds24_write_token');
  if (tok) return tok;
  var refresh = PropertiesService.getScriptProperties().getProperty('BEDS24_WRITE_REFRESH_TOKEN');
  if (!refresh) return null;
  var resp = UrlFetchApp.fetch('https://api.beds24.com/v2/authentication/token', {
    headers: { refreshToken: refresh }, muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    logRow('token', 'échec ' + resp.getResponseCode() + ' ' + resp.getContentText().slice(0, 200));
    return null;
  }
  tok = JSON.parse(resp.getContentText()).token;
  cache.put('beds24_write_token', tok, 21000); // ~6h (max cache), le token vit 24h
  return tok;
}

function envoyerBeds24(bookingId, message) {
  var tok = beds24TokenEcriture();
  if (!tok) return { ok: false, raison: 'pas de token écriture configuré' };
  var resp = UrlFetchApp.fetch('https://api.beds24.com/v2/bookings/messages', {
    method: 'post', contentType: 'application/json',
    headers: { token: tok },
    payload: JSON.stringify([{ bookingId: Number(bookingId), message: message }]),
    muteHttpExceptions: true });
  var code = resp.getResponseCode();
  var txt = resp.getContentText();
  logRow('envoi', 'resa ' + bookingId + ' HTTP ' + code + ' ' + txt.slice(0, 300));
  if (code >= 200 && code < 300) {
    try {
      var arr = JSON.parse(txt);
      var premier = Array.isArray(arr) ? arr[0] : arr;
      if (premier && premier.success === false) {
        return { ok: false, raison: JSON.stringify(premier.errors || premier).slice(0, 200) };
      }
    } catch (e) {}
    return { ok: true };
  }
  return { ok: false, raison: 'HTTP ' + code };
}

/* ============================================================================
   SCAN CLOUD — le robot tourne ICI (PC éteint), trigger toutes les 5 minutes.
   Léger pour tenir le quota Apps Script (~90 min/jour) : 1 appel Beds24
   « messages récents » par passage ; Claude uniquement s'il y a du nouveau.
   ============================================================================ */

var SCAN = {
  MAXAGE_JOURS: 2,                       // fenêtre des messages considérés
  CANAUX: ['booking', 'airbnb'],         // canaux lus
  CANAUX_REPONSE: ['booking'],           // canaux avec propositions de réponse
  MODEL: 'claude-sonnet-4-6',
  // [REDACTION dépôt public] destinataires du digest/alertes stockés dans la Script Property DIGEST_EMAILS (séparés par des virgules).
  EMAILS: (PropertiesService.getScriptProperties().getProperty('DIGEST_EMAILS') || '<EMAIL_DESTINATAIRE_1>,<EMAIL_DESTINATAIRE_2>').split(','),
  APP_URL: 'https://claudine-design.github.io/enquete-berck/messages-booking/',
  MAX_PAR_RUN: 6
};

function installerTriggerScan() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'scanCloud') { ScriptApp.deleteTrigger(t); n++; }
  });
  ScriptApp.newTrigger('scanCloud').timeBased().everyMinutes(5).create();
  logRow('trigger', 'scanCloud toutes les 5 min installé (' + n + ' ancien(s) supprimé(s))');
  return { ok: true, remplaces: n };
}

function scanCloud() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { skip: 'déjà en cours' };
  try { return scanCloudCore_(); }
  catch (e) { logRow('scan', 'ERREUR ' + e.message); return { error: e.message }; }
  finally { lock.releaseLock(); }
}

function scanCloudCore_() {
  var tok = beds24TokenEcriture();
  if (!tok) return { error: 'pas de token Beds24' };

  // 1. Messages récents (tous canaux, toutes propriétés) — 1 à 2 appels
  var msgs = [], page = 1;
  while (true) {
    var url = 'https://api.beds24.com/v2/bookings/messages?maxAge=' + SCAN.MAXAGE_JOURS +
              (page > 1 ? '&page=' + page : '');
    var r = JSON.parse(UrlFetchApp.fetch(url, { headers: { token: tok }, muteHttpExceptions: true }).getContentText());
    msgs = msgs.concat(r.data || []);
    if (r.pages && r.pages.nextPageExists && page < 5) { page++; } else { break; }
  }
  // 2. Grouper par résa ; retenir celles dont le DERNIER message est du voyageur
  var byBook = {};
  msgs.forEach(function (m) { (byBook[m.bookingId] = byBook[m.bookingId] || []).push(m); });
  var etat = chargerEtat_();
  var enAttente = [];
  Object.keys(byBook).forEach(function (bid) {
    var mm = byBook[bid].sort(function (a, b) { return String(a.time).localeCompare(String(b.time)); });
    var last = mm[mm.length - 1];
    if (last.source !== 'guest') return;
    if (etat.ids[String(last.id)]) return;
    enAttente.push({ bid: Number(bid), mm: mm, last: last });
  });

  // Premier passage : on marque l'existant comme vu, on ne génère rien (seed)
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SCAN_SEEDED')) {
    enAttente.forEach(function (c) { etat.nouveaux.push(String(c.last.id)); });
    sauverEtat_(etat);
    props.setProperty('SCAN_SEEDED', new Date().toISOString());
    logRow('scan', 'SEED cloud : ' + enAttente.length + ' conversation(s) marquée(s) vues');
    return { seed: enAttente.length };
  }
  if (!enAttente.length) {
    // Rien de nouveau, mais on nettoie quand même : Albert/Claudine a pu
    // répondre entre-temps à une proposition encore affichée dans l'app.
    var f0 = nettoyerObsoletes_(byBook);
    if (f0) logRow('scan', '0 nouvelle, ' + f0 + ' proposition(s) obsolète(s) retirée(s)');
    return { rien: true, obsoletes: f0 };
  }
  enAttente.sort(function (a, b) { return String(b.last.time).localeCompare(String(a.last.time)); });
  enAttente = enAttente.slice(0, SCAN.MAX_PAR_RUN);

  // 3. Détails des résas concernées (1 appel)
  var qs = enAttente.map(function (c) { return 'id=' + c.bid; }).join('&');
  var rb = JSON.parse(UrlFetchApp.fetch('https://api.beds24.com/v2/bookings?' + qs,
    { headers: { token: tok }, muteHttpExceptions: true }).getContentText());
  var byId = {};
  (rb.data || []).forEach(function (b) { byId[b.id] = b; });

  var kb = chargerKB_();
  var items = [], survAlertes = 0;
  enAttente.forEach(function (c) {
    var b = byId[c.bid] || {};
    var canal = String(b.channel || '').toLowerCase();
    if (SCAN.CANAUX.indexOf(canal) < 0) { etat.nouveaux.push(String(c.last.id)); return; }
    var slug = (kb.propmap || {})[String(b.propertyId)] || ('prop ' + b.propertyId);
    var voyageur = ((b.firstName || '') + ' ' + (b.lastName || '')).trim();

    if (SCAN.CANAUX_REPONSE.indexOf(canal) < 0) {
      // Surveillance seule (airbnb) : urgence uniquement
      var outU = claudeUrgence_(b, c.mm);
      var motif = outU && outU.urgence && outU.urgence.motif ? outU.urgence.motif : '';
      if (motif) {
        alerteUrgenceCloud_(slug, canal, voyageur, b, c.last, motif);
        survAlertes++;
      }
      etat.nouveaux.push(String(c.last.id));
      return;
    }
    // Canal avec réponse (booking) : génération complète
    var out = claudeGeneration_(b, c.mm, kb, slug);
    if (!out) return; // échec : on retentera au prochain passage
    var opt = out.option || {};
    var urg = out.urgence && out.urgence.motif ? out.urgence.motif : '';
    var item = {
      id: c.bid + '-' + c.last.id, bookingId: c.bid, msgId: c.last.id,
      propId: b.propertyId, appart: slug, voyageur: voyageur,
      arrivee: b.arrival, depart: b.departure,
      categorie: out.categorie || 'autre',
      besoin_claudine: !!out.besoin_claudine, note_interne: out.note_interne || '',
      option_type: opt.type || '', option_detail: opt.detail || '',
      question: (out.message_fr || c.last.message || '').trim(),
      question_orig: (c.last.message || '').trim(),
      langue: String(out.langue || 'fr').toLowerCase(),
      conversation: c.mm.slice(-12).map(function (m) {
        return '[' + String(m.time || '').slice(0, 16) + '] ' +
               (m.source === 'guest' ? 'VOYAGEUR' : 'HÔTE') + ' : ' +
               String(m.message || '').trim().slice(0, 500);
      }).join('\n'),
      proposition: out.reponse || '', reponse_finale: '', statut: 'en_attente',
      traite_le: '', urgence: urg,
      genere_le: Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd HH:mm')
    };
    items.push(item);
    if (urg) alerteUrgenceCloud_(slug, canal, voyageur, b, c.last, urg);
    etat.nouveaux.push(String(c.last.id));
  });

  // 4. Écrire les propositions + digest
  if (items.length) {
    var sheet = activeSS_().getSheetByName(TAB_PROPS);
    var existants = {};
    sheet.getDataRange().getValues().forEach(function (row, i) { if (i) existants[String(row[0])] = true; });
    items.forEach(function (it) {
      if (existants[String(it.id)]) return;
      sheet.appendRow(COLS.map(function (col) {
        var v = it[col]; return (v === null || v === undefined) ? '' : v;
      }));
    });
    envoyerDigestCloud_(items);
  }
  sauverEtat_(etat);
  // 5. Nettoyage : retirer les propositions devenues obsolètes (Albert/Claudine
  //    a déjà répondu ailleurs, ou le voyageur a renvoyé un nouveau message).
  var fermees = nettoyerObsoletes_(byBook);
  logRow('scan', items.length + ' proposition(s), ' + survAlertes + ' alerte(s) surveillance, ' +
         fermees + ' obsolète(s) retirée(s)');
  return { propositions: items.length, alertes: survAlertes, obsoletes: fermees };
}

/** Ferme les propositions en attente dont la conversation a AVANCÉ depuis
 *  (réponse déjà envoyée par Albert/Claudine via une autre voie, ou nouveau
 *  message du voyageur qui a généré une proposition plus récente). */
function nettoyerObsoletes_(byBook) {
  var sheet = activeSS_().getSheetByName(TAB_PROPS);
  var data = sheet.getDataRange().getValues();
  var iStatut = COLS.indexOf('statut'), iBook = COLS.indexOf('bookingId'),
      iMsg = COLS.indexOf('msgId'), iTraite = COLS.indexOf('traite_le'),
      iApp = COLS.indexOf('appart'), iVoy = COLS.indexOf('voyageur');
  var fermees = 0;
  for (var i = 1; i < data.length; i++) {
    var statut = String(data[i][iStatut]);
    if (statut !== 'en_attente' && statut !== 'courtoisie') continue;
    var mm = byBook[String(data[i][iBook])] || byBook[Number(data[i][iBook])];
    if (!mm || !mm.length) continue; // conversation hors fenêtre : on ne touche pas
    var last = mm[mm.length - 1];
    if (String(last.id) === String(data[i][iMsg])) continue; // toujours d'actualité
    // La conversation a bougé depuis cette proposition :
    // - dernier message = HÔTE (Albert/Claudine a répondu) -> plus rien à faire
    // - dernier message = VOYAGEUR plus récent -> une nouvelle proposition existe
    sheet.getRange(i + 1, iStatut + 1).setValue(
      last.source === 'guest' ? 'remplacee' : 'deja_repondu');
    sheet.getRange(i + 1, iTraite + 1).setValue(new Date());
    logRow('obsolete', data[i][iApp] + ' / ' + data[i][iVoy] +
           (last.source === 'guest' ? ' -> remplacée (nouveau message voyageur)'
                                     : ' -> déjà répondu (Albert/Claudine)'));
    fermees++;
  }
  return fermees;
}

/* ---------- état (messages déjà vus) : onglet ScanState ---------- */

function chargerEtat_() {
  var ss = activeSS_();
  var sheet = ss.getSheetByName('ScanState') || ss.insertSheet('ScanState');
  var ids = {};
  sheet.getDataRange().getValues().forEach(function (row) { if (row[0]) ids[String(row[0])] = true; });
  return { sheet: sheet, ids: ids, nouveaux: [] };
}

function sauverEtat_(etat) {
  if (!etat.nouveaux.length) return;
  var rows = etat.nouveaux.map(function (id) { return [id, new Date()]; });
  etat.sheet.getRange(etat.sheet.getLastRow() + 1, 1, rows.length, 2).setValues(rows);
  // purge : on garde ~4000 lignes récentes (>> fenêtre maxAge)
  var n = etat.sheet.getLastRow();
  if (n > 5000) etat.sheet.deleteRows(1, n - 4000);
}

/* ---------- connaissances (onglet KB, poussé depuis le PC) ---------- */

function chargerKB_() {
  var sheet = activeSS_().getSheetByName('KB');
  var kb = { fiches: {}, propmap: {}, commun: '', style: '' };
  if (!sheet) return kb;
  sheet.getDataRange().getValues().forEach(function (row, i) {
    if (!i || !row[0]) return;
    var slug = String(row[0]);
    if (slug === '_propmap') { try { kb.propmap = JSON.parse(row[1]); } catch (e) {} }
    else if (slug === '_commun') kb.commun = row[1];
    else if (slug === '_style-claudine') kb.style = row[1];
    else kb.fiches[slug] = row[1];
  });
  return kb;
}

/* ---------- appels Claude ---------- */

function claudeCall_(system, user, maxTokens) {
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) { logRow('scan', 'ANTHROPIC_API_KEY manquante'); return null; }
  var resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: SCAN.MODEL, max_tokens: maxTokens, temperature: 0.4,
      system: system, messages: [{ role: 'user', content: user }] }),
    muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    logRow('scan', 'claude HTTP ' + resp.getResponseCode() + ' ' + resp.getContentText().slice(0, 150));
    return null;
  }
  var txt = JSON.parse(resp.getContentText()).content[0].text;
  var m = txt.match(/\{[\s\S]*\}/);
  try { return m ? JSON.parse(m[0]) : null; } catch (e) { return null; }
}

var SYS_SCAN_URGENCE = 'Tu surveilles les messages de voyageurs (locations à Berck-sur-Mer). Détermine UNIQUEMENT si le DERNIER message du voyageur décrit une URGENCE qui ne peut pas attendre 1 heure : voyageur bloqué (clé absente de la boîte, code qui ne marche pas, impossible d\'entrer), panne majeure en cours (électricité, eau, chauffage en hiver, fuite), sécurité/santé (incendie, gaz, intrusion, blessure), ou voyageur sur place après 16h30 le jour de son arrivée sans ses codes. PAS urgent : questions, options, petites pannes (ampoule, TV, wifi), remerciements. Réponds UNIQUEMENT en JSON : {"urgence": null} OU {"urgence": {"motif": "résumé très court en français"}}';

function claudeUrgence_(b, mm) {
  var conv = mm.slice(-6).map(function (m) {
    return '[' + String(m.time || '').slice(0, 16) + '] ' +
           (m.source === 'guest' ? 'VOYAGEUR' : 'HÔTE') + ' : ' + String(m.message || '').trim().slice(0, 400);
  }).join('\n');
  return claudeCall_(SYS_SCAN_URGENCE,
    'Séjour du ' + b.arrival + ' au ' + b.departure + ' (aujourd\'hui : ' +
    Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd') + ').\nConversation récente :\n' + conv, 150);
}

var SYS_SCAN_GEN = 'Tu es l\'assistant de Claudine Podvin, hôte d\'appartements de standing à Berck-sur-Mer (marque Princesse d\'Opale). Tu prépares des PROPOSITIONS de réponses aux messages des voyageurs Booking. Claudine relit et valide chaque réponse avant envoi — vise une qualité envoyable telle quelle.\n\nStyle : chaleureux, courtois, quelques :-) comme Claudine, concis (2 à 6 phrases), signé « Claudine ».\n\nLANGUE : Claudine lit et valide TOUT en FRANÇAIS. Rédige TOUJOURS "reponse" en FRANÇAIS. Détecte la langue du dernier message du voyageur ("langue" : fr/de/en/nl/es/it...) et fournis "message_fr" (traduction française de son message) si pas français, sinon null.\n\nRègles impératives :\n1. Appuie-toi UNIQUEMENT sur les fiches fournies. Information absente = ne JAMAIS inventer : besoin_claudine=true.\n2. Jamais de promesse de remboursement, geste commercial, annulation, confirmation de disponibilité : besoin_claudine=true avec proposition prudente.\n3. Problème grave : empathie + « je reviens vers vous très vite » + besoin_claudine=true.\n4. CHAQUE message reçoit une réponse : besoin_reponse=true TOUJOURS. Simple politesse : réponse courte chaleureuse (categorie=courtoisie). Si tu ne sais pas quoi répondre : « Merci pour votre message, c\'est noté. » + besoin_claudine=true.\n5. Jamais de codes d\'accès, IBAN, téléphone, email dans la réponse. Options payantes : renvoyer vers « l\'IBAN ou le PayPal indiqué dans le message de bienvenue ».\n6. Le fichier « Ma façon de répondre » est prioritaire : si la situation y est décrite, suis sa structure à la lettre.\n7. URGENCE (champ "urgence") UNIQUEMENT si le dernier message ne peut pas attendre 1h : bloqué dehors/clé absente/code KO, panne majeure en cours, sécurité/santé, arrivée du jour sans codes après 16h30. Sinon null.\n\nRéponds UNIQUEMENT avec un objet JSON valide :\n{"besoin_reponse": true, "categorie": "question"|"demande"|"probleme"|"courtoisie"|"autre", "reponse": "texte EN FRANÇAIS", "langue": "fr"|"de"|"en"|..., "message_fr": "traduction ou null", "besoin_claudine": true/false, "note_interne": "1 phrase ou null", "option": null OU {"type": "pack_linge"|"animal"|"arrivee_anticipee"|"depart_tardif", "detail": "résumé court"}, "urgence": null OU {"motif": "résumé très court"}}';

function claudeGeneration_(b, mm, kb, slug) {
  var learning = '';
  try {
    var data = activeSS_().getSheetByName(TAB_HISTO).getDataRange().getValues();
    var ex = [];
    for (var i = data.length - 1; i >= 1 && ex.length < 6; i--) {
      if (String(data[i][1]) !== String(b.propertyId)) continue;
      var act = String(data[i][6] || ''), fin = String(data[i][5] || '');
      if (act === 'rejetee') ex.push('- Voyageur : « ' + data[i][3] + ' » → proposition REJETÉE (ne pas refaire) : « ' + data[i][4] + ' »');
      else if (fin) ex.push('- Voyageur : « ' + data[i][3] + ' » → réponse de Claudine : « ' + fin + ' »');
    }
    if (ex.length) learning = '\n\nEXEMPLES RÉCENTS (validés/corrigés par Claudine sur cet appartement) :\n' + ex.reverse().join('\n');
  } catch (e) {}
  var conv = mm.slice(-20).map(function (m) {
    return '[' + String(m.time || '').slice(0, 16) + '] ' +
           (m.source === 'guest' ? 'VOYAGEUR' : 'HÔTE') + ' : ' + String(m.message || '').trim().slice(0, 700);
  }).join('\n');
  var user = 'FICHES DE CONNAISSANCES :\n\n' + (kb.style || '') + '\n\n---\n\n' + (kb.commun || '') +
             '\n\n---\n\n' + (kb.fiches[slug] || '(fiche appartement absente)') + learning +
             '\n\nRÉSA : ' + ((b.firstName || '') + ' ' + (b.lastName || '')) + ', ' + (b.numAdult || '?') +
             ' adulte(s), séjour du ' + b.arrival + ' au ' + b.departure +
             ' (aujourd\'hui : ' + Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd') + ').\n\nCONVERSATION :\n' + conv +
             '\n\nPrépare la réponse au DERNIER message du voyageur.';
  return claudeCall_(SYS_SCAN_GEN, user, 900);
}

/* ---------- reformulation à la demande (bouton 🪄 de l'app) ---------- */

var SYS_REFORMULER = 'Tu écris au nom de Claudine Podvin, hôte d\'appartements à Berck-sur-Mer. Elle te donne une CONSIGNE (ce qu\'elle veut dire au voyageur, dictée rapidement) : rédige le message complet, poli et chaleureux, dans SON style (fiches fournies : ouverture « Bonjour {prénom} :-) », remerciement, :-), clôture « Passez une belle journée :-) », signé « Claudine »). Même pour un refus : reste ferme sur le fond mais très courtois, avec une touche d\'empathie et si possible une porte de sortie (autre solution, remboursement selon conditions de la plateforme, etc. UNIQUEMENT si la consigne le permet). TOUJOURS en FRANÇAIS. Jamais de codes d\'accès, IBAN, téléphone. Réponds UNIQUEMENT en JSON : {"texte": "le message à envoyer"}';

function apiReformuler(secret, id, consigne) {
  if (!secretOk(secret)) throw new Error('secret');
  if (!consigne.trim()) throw new Error('consigne vide');
  var r = findRow(id);
  if (!r) throw new Error('proposition introuvable');
  var kb = chargerKB_();
  var appart = String(r.values[COLS.indexOf('appart')] || '');
  var user = 'STYLE DE CLAUDINE :\n' + (kb.style || '') +
             '\n\nFICHE DE L\'APPARTEMENT (' + appart + ') :\n' +
             (kb.fiches[appart] || '(absente)') +
             '\n\nCONVERSATION AVEC LE VOYAGEUR (' + r.values[COLS.indexOf('voyageur')] + ') :\n' +
             r.values[COLS.indexOf('conversation')] +
             '\n\nCONSIGNE DE CLAUDINE (ce qu\'elle veut dire) :\n« ' + consigne.trim() + ' »' +
             '\n\nRédige le message.';
  var out = claudeCall_(SYS_REFORMULER, user, 700);
  if (!out || !out.texte) throw new Error('reformulation échouée, réessayer');
  logRow('reformuler', id + ' : ' + consigne.slice(0, 120));
  return { texte: out.texte };
}

/* ---------- alertes + digest ---------- */

function alerteUrgenceCloud_(slug, canal, voyageur, b, last, motif) {
  var titre = '🚨 URGENCE ' + canal.toUpperCase() + ' ' + slug.toUpperCase() + ' — ' + motif.slice(0, 60);
  try {
    MailApp.sendEmail({
      to: SCAN.EMAILS.join(','), subject: titre,
      htmlBody: '<h2>🚨 ' + slug.toUpperCase() + ' (' + canal + ')</h2><p><b>' + voyageur +
                '</b> (séjour ' + b.arrival + ' → ' + b.departure + ')</p><p><b>Motif :</b> ' + motif +
                '</p><p><b>Message :</b><br>' + String(last.message || '') +
                '</p><p><a href="' + SCAN.APP_URL + '">Ouvrir l\'app</a></p>' });
  } catch (e) { logRow('urgence', 'mail KO ' + e.message); }
  var props = PropertiesService.getScriptProperties();
  var phone = props.getProperty('CALLMEBOT_PHONE'), key = props.getProperty('CALLMEBOT_APIKEY');
  if (phone && key) {
    try {
      UrlFetchApp.fetch('https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(phone) +
        '&apikey=' + encodeURIComponent(key) + '&text=' + encodeURIComponent(
          '🚨 URGENCE ' + canal.toUpperCase() + '\n' + slug.toUpperCase() + ' — ' + voyageur + ' : ' + motif +
          '\n\nMessage: ' + String(last.message || '').slice(0, 300) + '\n→ ' + SCAN.APP_URL),
        { muteHttpExceptions: true });
    } catch (e) { logRow('urgence', 'whatsapp KO ' + e.message); }
  }
  logRow('urgence', titre);
}

function envoyerDigestCloud_(items) {
  try {
    var h = ['<html><body><h2>🤖 ' + items.length + ' proposition(s) à valider</h2>'];
    items.forEach(function (it) {
      h.push('<hr><p><b>' + it.appart + ' — ' + it.voyageur + '</b>' +
             (it.urgence ? ' <span style="color:red">🚨 ' + it.urgence + '</span>' : '') + '</p>' +
             '<p>💬 ' + it.question + '</p><p style="color:#3b5bdb">' +
             String(it.proposition || '').replace(/\n/g, '<br>') + '</p>');
    });
    h.push('<p><a href="' + SCAN.APP_URL + '">✅ Valider dans l\'app</a></p></body></html>');
    MailApp.sendEmail({ to: SCAN.EMAILS.join(','), subject: '🤖 ' + items.length + ' réponse(s) voyageurs à valider',
                        htmlBody: h.join('') });
  } catch (e) { logRow('scan', 'digest KO ' + e.message); }
}
