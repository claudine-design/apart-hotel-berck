/**
 * SMS-Voyageurs — Phase 1 : OBSERVATION (classement + propositions, ZÉRO envoi)
 * -----------------------------------------------------------------------------
 * Projet Apps Script SÉPARÉ du Robot Messages Booking (aucun partage de
 * déploiement ni de déclencheur). Lit le Sheet KB du robot Booking en LECTURE
 * SEULE pour le style et les fiches. Token Beds24 en LECTURE SEULE.
 *
 * Installation : voir INSTALLATION.md (guide pas à pas pour Claudine).
 *  1. Créer un Google Sheet vide « SMS-Voyageurs — Journal »
 *  2. Coller ce code dans un nouveau projet Apps Script
 *  3. Renseigner les Script Properties (liste dans INSTALLATION.md)
 *  4. Exécuter setup() une fois, puis installerTriggers()
 *  5. Déployer en Web App (Exécuter en tant que : moi / Accès : tout le monde
 *     disposant du lien) et copier l'URL dans la macro MacroDroid
 *
 * Script Properties attendues :
 *  - SECRET_SMS                 : jeton du webhook (généré par setup() si absent)
 *  - SHEET_ID                   : ID du Sheet « SMS-Voyageurs — Journal »
 *  - KB_SHEET_ID                : ID du Sheet du robot Booking (lecture seule : KB)
 *  - BEDS24_READ_REFRESH_TOKEN  : refresh token Beds24 LECTURE (jamais écriture)
 *  - ANTHROPIC_API_KEY          : clé API Claude
 *  - DIGEST_EMAILS              : destinataires e-mails (séparés par des virgules)
 *  - CALLMEBOT_PHONE / CALLMEBOT_APIKEY : (facultatif) alerte WhatsApp urgence
 */

var TAB_JOURNAL = 'Journal';
var TAB_CONFIG = 'Config';
var TAB_REGLES = 'Regles';
var TAB_MODELES = 'Modeles';
var TAB_CONV = 'Conversations';
var TAB_LOG = 'Log';

var SHEET_ID = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || '<SHEET_ID_DANS_PROPRIETES_DU_SCRIPT>';
function ss_() { return SpreadsheetApp.openById(SHEET_ID); }

var COLS_JOURNAL = ['id', 'date_heure', 'numero', 'contact_connu', 'categorie_locale',
  'message', 'resa_id', 'resa_appart', 'resa_arrivee', 'resa_depart', 'resa_statut',
  'categorie', 'intention', 'confiance', 'action', 'regle', 'proposition',
  'statut', 'erreur', 'intervention_manuelle', 'explication'];

var CONFIG_DEFAUT = [
  ['MODE', 'OBSERVATION', 'OBSERVATION = classe + propose, aucun envoi | TEST = simule les envois | PRODUCTION (phase 2)'],
  ['REPONSES_AUTO_ACTIVEES', 'NON', 'Kill-switch général. Restera NON pendant toute la phase 1.'],
  ['SEUIL_CONFIANCE_ENVOI', '85', 'Phase 2 : confiance minimale pour un envoi automatique'],
  ['SEUIL_CONFIANCE_PROPOSITION', '60', 'En dessous : classement seul + alerte si sensible'],
  ['FENETRE_ANTI_DOUBLON_MIN', '10', 'Même numéro + même texte dans cette fenêtre = ignoré'],
  ['ALERTE_SILENCE_TELEPHONE_H', '3', 'Alerte si le téléphone est muet plus de N heures (8h-22h)'],
  ['HEURE_RESUME', '20', 'Heure du résumé quotidien (le déclencheur vise ~20h30)'],
  ['MAX_ANALYSES_IA_PAR_JOUR', '60', 'Plafond d appels IA par jour (garde-fou quota)']
];

var MODELES_DEFAUT = [
  ['S1_HEURE_ARRIVEE', 'Bonjour, merci pour votre message. Votre arrivée à {heure} est bien prise en compte.\n\nAfin de nous permettre de vous identifier plus rapidement lors de vos prochains messages, pourriez-vous préciser le nom du logement ou le nom utilisé pour la réservation lorsque vous nous contactez ?\n\nToutes les informations nécessaires à votre arrivée vous ont également été envoyées dans votre message d\'accueil.\n\nBien cordialement,\nClaudine'],
  ['S2_NON_RECONNU', 'Bonjour, merci pour votre message.\n\nLe numéro depuis lequel vous nous contactez n\'est pas associé à une réservation dans notre système.\n\nPour des raisons de confidentialité, nous ne pouvons pas communiquer d\'informations relatives à un logement ou à une arrivée sans avoir identifié la réservation.\n\nPouvez-vous nous indiquer le nom et le prénom utilisés pour la réservation, la date d\'arrivée ainsi que le numéro de téléphone utilisé lors de la réservation ?\n\nBien cordialement,\nClaudine']
];

// Règles : categorie | intention (vide = toutes) | confiance_min | action | modele | actif
// Phase 1 : les actions "envoyer" sont automatiquement rétrogradées en "proposer".
var REGLES_DEFAUT = [
  ['voyageur_reconnu', 'annonce_heure_arrivee', '60', 'proposer', 'S1_HEURE_ARRIVEE', 'OUI'],
  ['voyageur_reconnu', '', '0', 'proposer', '', 'OUI'],
  ['voyageur_probable', '', '0', 'proposer', '', 'OUI'],
  ['voyageur_non_reconnu', '', '0', 'proposer', 'S2_NON_RECONNU', 'OUI'],
  ['prestataire', '', '0', 'classer', '', 'OUI'],
  ['professionnel', '', '0', 'classer', '', 'OUI'],
  ['famille', '', '0', 'ignorer', '', 'OUI'],
  ['ami', '', '0', 'ignorer', '', 'OUI'],
  ['commercial', '', '0', 'ignorer', '', 'OUI'],
  ['automatique', '', '0', 'ignorer', '', 'OUI'],
  ['fraude', '', '0', 'alerter', '', 'OUI'],
  ['urgence', '', '0', 'alerter', '', 'OUI'],
  ['ambigu', '', '0', 'classer', '', 'OUI'],
  ['inconnu', '', '0', 'proposer', 'S2_NON_RECONNU', 'OUI']
];

/* ================= INSTALLATION ================= */

function setup() {
  var ss = ss_();
  if (!ss.getSheetByName(TAB_JOURNAL)) ss.insertSheet(TAB_JOURNAL).appendRow(COLS_JOURNAL);
  if (!ss.getSheetByName(TAB_CONFIG)) {
    var c = ss.insertSheet(TAB_CONFIG);
    c.appendRow(['cle', 'valeur', 'explication']);
    CONFIG_DEFAUT.forEach(function (r) { c.appendRow(r); });
  }
  if (!ss.getSheetByName(TAB_REGLES)) {
    var r = ss.insertSheet(TAB_REGLES);
    r.appendRow(['categorie', 'intention', 'confiance_min', 'action', 'modele', 'actif']);
    REGLES_DEFAUT.forEach(function (x) { r.appendRow(x); });
  }
  if (!ss.getSheetByName(TAB_MODELES)) {
    var m = ss.insertSheet(TAB_MODELES);
    m.appendRow(['nom', 'texte']);
    MODELES_DEFAUT.forEach(function (x) { m.appendRow(x); });
  }
  if (!ss.getSheetByName(TAB_CONV)) {
    ss.insertSheet(TAB_CONV).appendRow(['numero', 'dernier_contact', 'statut', 'tentatives_identification', 'note']);
  }
  if (!ss.getSheetByName(TAB_LOG)) ss.insertSheet(TAB_LOG).appendRow(['date', 'quoi', 'detail']);
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SECRET_SMS')) props.setProperty('SECRET_SMS', Utilities.getUuid());
  Logger.log('SECRET_SMS (à copier dans la macro MacroDroid) : ' + props.getProperty('SECRET_SMS'));
}

function installerTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['resumeQuotidien', 'veilleSilence'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('resumeQuotidien').timeBased().everyDays(1).atHour(20).nearMinute(30).create();
  ScriptApp.newTrigger('veilleSilence').timeBased().everyHours(1).create();
  log_('triggers', 'resumeQuotidien 20h30 + veilleSilence horaire installés');
}

/* ================= OUTILS ================= */

function log_(quoi, detail) {
  try { ss_().getSheetByName(TAB_LOG).appendRow([new Date(), quoi, String(detail).slice(0, 800)]); } catch (e) {}
}

function secretOk_(s) {
  return s && String(s).trim() === PropertiesService.getScriptProperties().getProperty('SECRET_SMS');
}

/** Analyse JSON tolérante : répare les dégâts fréquents des copier-coller
 *  (guillemets typographiques ajoutés par Gmail, retours à la ligne du SMS
 *  ou du reformatage). Renvoie l'objet, ou null si vraiment illisible. */
function parseTolerant_(brut) {
  var b = String(brut || '').trim();
  var droit = b.replace(/[“”„‟]/g, '"').replace(/[‘’‚]/g, "'");
  var essais = [b, droit, droit.replace(/[\r\n]+/g, '\\n'), droit.replace(/[\r\n]+/g, ' ')];
  for (var i = 0; i < essais.length; i++) {
    try {
      var o = JSON.parse(essais[i]);
      if (i > 0) log_('recu', 'JSON réparé automatiquement (variante ' + i + ')');
      return o;
    } catch (e) {}
  }
  return null;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function config_(cle, defaut) {
  var data = ss_().getSheetByName(TAB_CONFIG).getDataRange().getValues();
  for (var i = 1; i < data.length; i++) if (String(data[i][0]) === cle) return String(data[i][1]);
  return defaut;
}

/** +33612345678 <- 0612345678 / 0033612345678 / +33 6 12 34 56 78. Garde tel quel l'international. */
function normaliserNumero(brut) {
  var n = String(brut || '').replace(/[^0-9+]/g, '');
  if (n.indexOf('00') === 0) n = '+' + n.slice(2);
  if (n.charAt(0) !== '+' && /^0[1-9][0-9]{8}$/.test(n)) n = '+33' + n.slice(1);
  return n;
}

/** Numéro court / expéditeur alphanumérique = pas un vrai correspondant. */
function estNumeroCourt(brut) {
  var n = normaliserNumero(brut);
  return !(n.charAt(0) === '+' && n.length >= 11);
}

function masquer(num) {
  var n = String(num || '');
  return n.length > 6 ? n.slice(0, 4) + '****' + n.slice(-2) : '****';
}

/* ================= WEBHOOK ================= */

function doPost(e) {
  // Journal de diagnostic : TOUTE requête reçue est tracée dans l'onglet Log,
  // même refusée (secret masqué : remplacé par OK, ou KO + 4 premiers caractères).
  var brut = (e && e.postData && e.postData.contents) ? String(e.postData.contents) : '';
  try {
    var brutMasque = brut.replace(/"secret"\s*:\s*"([^"]*)"/, function (tout, s) {
      return '"secret":"' + (secretOk_(s) ? 'OK' : 'KO(' + s.slice(0, 4) + '…, ' + s.length + ' car.)') + '"';
    });
    log_('recu', brutMasque.slice(0, 400) || '(corps vide)');
  } catch (errLog) {}
  var body = parseTolerant_(brut);
  if (!body) { log_('recu', 'REJET: JSON invalide (réparations tentées sans succès)'); return json_({ error: 'JSON invalide' }); }
  if (!secretOk_(body.secret)) { log_('recu', 'REJET: mauvais secret'); return json_({ error: 'secret' }); }

  var props = PropertiesService.getScriptProperties();
  props.setProperty('LAST_PHONE_CONTACT', new Date().toISOString());

  if (body.action === 'heartbeat') {
    // Signal de vie horaire du téléphone : compteurs agrégés uniquement (aucun contenu).
    if (body.compteurs) props.setProperty('COMPTEURS_TEL', JSON.stringify(body.compteurs));
    return json_({ ok: true });
  }
  if (body.action === 'test') return json_({ ok: true, mode: config_('MODE', 'OBSERVATION') });
  if (body.action !== 'sms') return json_({ error: 'action inconnue' });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return json_({ error: 'occupé, réessayer' });
  try { return json_(traiterSms_(body)); }
  catch (err) {
    log_('erreur', 'doPost: ' + err.message);
    alerteTechnique_('Erreur traitement SMS', err.message);
    return json_({ error: err.message });
  }
  finally { lock.releaseLock(); }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!secretOk_(p.k)) return json_({ error: 'secret' });
  if (p.action === 'resume') return json_(resumeQuotidien());
  var props = PropertiesService.getScriptProperties();
  return json_({
    mode: config_('MODE', 'OBSERVATION'),
    reponses_auto: config_('REPONSES_AUTO_ACTIVEES', 'NON'),
    dernier_contact_tel: props.getProperty('LAST_PHONE_CONTACT') || 'jamais'
  });
}

/* ================= PIPELINE ================= */

function traiterSms_(body) {
  var numero = normaliserNumero(body.numero);
  var texte = String(body.texte || '').trim();
  if (!texte) return { ignore: 'texte vide' };

  // Filet de sécurité serveur (le tri principal est fait par MacroDroid sur le téléphone)
  if (estNumeroCourt(body.numero)) { journal_(idNouveau_(), numero, body, null, { categorie: 'automatique' }, 'ignorer', 'filtre-serveur-court', ''); return { ignore: 'numéro court' }; }

  // Anti-doublon : même numéro + même texte dans la fenêtre
  var cache = CacheService.getScriptCache();
  var cle = 'sms_' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, numero + '|' + texte));
  if (cache.get(cle)) { log_('doublon', masquer(numero)); return { ignore: 'doublon' }; }
  cache.put(cle, '1', Number(config_('FENETRE_ANTI_DOUBLON_MIN', '10')) * 60);

  var id = idNouveau_();

  // Plafond IA quotidien
  if (!quotaIaOk_()) {
    journal_(id, numero, body, null, { categorie: 'ambigu', note: 'plafond IA atteint' }, 'classer', 'plafond-ia', '');
    alerteTechnique_('Plafond IA atteint', 'Le SMS de ' + masquer(numero) + ' a été journalisé sans analyse.');
    return { ok: true, action: 'classer', raison: 'plafond IA' };
  }

  // 1. Recherche Beds24 (lecture seule)
  var resa = null, erreurBeds = '';
  try { resa = chercherReservationBeds24_(numero); }
  catch (e) { erreurBeds = e.message; log_('beds24', 'échec: ' + e.message); alerteTechnique_('Beds24 injoignable', e.message); }

  // 2. Analyse IA (catégorie, intention, confiance, proposition)
  var analyse = analyserSms_(numero, texte, body, resa);
  if (!analyse) {
    journal_(id, numero, body, resa, { categorie: 'ambigu', note: 'analyse IA en échec' }, 'classer', 'ia-echec', erreurBeds);
    alerteTechnique_('Analyse IA en échec', 'SMS de ' + masquer(numero) + ' journalisé sans analyse.');
    return { ok: true, action: 'classer', raison: 'IA en échec' };
  }
  if (erreurBeds) analyse.confiance = Math.min(Number(analyse.confiance || 0), 40);

  // 3. Moteur de règles + garde-fous
  var decision = decider_(analyse);

  // 4. Modèle de réponse éventuel
  var proposition = analyse.reponse || '';
  if (decision.modele) {
    var modele = lireModele_(decision.modele);
    if (modele) proposition = remplirModele_(modele, { heure: analyse.heure_arrivee || '', prenom: (resa && resa.prenom) || '' });
  }
  analyse.proposition_finale = (decision.action === 'proposer' || decision.action === 'envoyer') ? proposition : '';

  // 5. Journal + conversation
  journal_(id, numero, body, resa, analyse, decision.action, decision.regle, erreurBeds);
  majConversation_(numero, analyse);

  // 6. Notifications
  if (decision.action === 'alerter' || analyse.urgence) {
    alerteUrgence_(numero, texte, resa, analyse);
  }
  if (decision.action === 'proposer' && analyse.proposition_finale) {
    digestProposition_(id, numero, texte, resa, analyse);
  }
  // Phase 1 : jamais d'envoi. En MODE TEST on trace ce qui AURAIT été envoyé.
  if (decision.action === 'envoyer') {
    log_('simulation', id + ' : aurait envoyé (mode ' + config_('MODE', 'OBSERVATION') + ')');
  }
  return { ok: true, action: decision.action, categorie: analyse.categorie, confiance: analyse.confiance };
}

function idNouveau_() {
  return 'SMS-' + Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
}

function quotaIaOk_() {
  var props = PropertiesService.getScriptProperties();
  var jour = Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd');
  var brut = props.getProperty('QUOTA_IA') || '';
  var n = 0;
  if (brut.indexOf(jour) === 0) n = Number(brut.split('|')[1] || 0);
  if (n >= Number(config_('MAX_ANALYSES_IA_PAR_JOUR', '60'))) return false;
  props.setProperty('QUOTA_IA', jour + '|' + (n + 1));
  return true;
}

/* ================= BEDS24 (LECTURE SEULE) ================= */

function beds24TokenLecture_() {
  var cache = CacheService.getScriptCache();
  var tok = cache.get('beds24_read_token');
  if (tok) return tok;
  var refresh = PropertiesService.getScriptProperties().getProperty('BEDS24_READ_REFRESH_TOKEN');
  if (!refresh) throw new Error('BEDS24_READ_REFRESH_TOKEN absent');
  var resp = UrlFetchApp.fetch('https://api.beds24.com/v2/authentication/token',
    { headers: { refreshToken: refresh }, muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw new Error('token Beds24 HTTP ' + resp.getResponseCode());
  tok = JSON.parse(resp.getContentText()).token;
  cache.put('beds24_read_token', tok, 21000);
  return tok;
}

/** Cherche une réservation dont le téléphone correspond au numéro (E.164).
 *  Renvoie null si aucune, sinon la plus pertinente (en cours > à venir > passée récente). */
function chercherReservationBeds24_(numE164) {
  var tok = beds24TokenLecture_();
  var digits = numE164.replace(/\D/g, '').slice(-9); // 9 derniers chiffres = identité FR stable
  var resp = UrlFetchApp.fetch('https://api.beds24.com/v2/bookings?searchString=' + encodeURIComponent(digits) +
    '&arrivalFrom=' + dateStr_(-30) + '&arrivalTo=' + dateStr_(180),
    { headers: { token: tok }, muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw new Error('Beds24 HTTP ' + resp.getResponseCode());
  var data = JSON.parse(resp.getContentText()).data || [];
  var candidats = data.filter(function (b) {
    var tels = [b.phone, b.mobile].map(function (t) { return String(t || '').replace(/\D/g, ''); });
    return tels.some(function (t) { return t && t.slice(-9) === digits; });
  });
  if (!candidats.length) return null;
  var aujourdhui = dateStr_(0);
  candidats.sort(function (a, b) { return score_(b) - score_(a); });
  function score_(b) {
    if (String(b.status).toLowerCase() === 'cancelled') return -1;
    if (b.arrival <= aujourdhui && b.departure >= aujourdhui) return 3; // en cours
    if (b.arrival >= aujourdhui) return 2;                              // à venir
    return 1;                                                           // passée récente
  }
  var actifs = candidats.filter(function (b) { return score_(b) > 0; });
  var b = candidats[0];
  return {
    id: b.id, propId: b.propertyId, appart: nomAppart_(b.propertyId),
    prenom: b.firstName || '', nom: b.lastName || '',
    arrivee: b.arrival, depart: b.departure, statut: b.status,
    arrive_aujourdhui: b.arrival === aujourdhui,
    en_cours: (b.arrival <= aujourdhui && b.departure >= aujourdhui),
    // Ambiguïté : plusieurs réservations non annulées partagent ce numéro
    ambigu: actifs.length > 1,
    nb_resas: actifs.length,
    autres: actifs.slice(1, 4).map(function (x) {
      return nomAppart_(x.propertyId) + ' (' + x.arrival + '→' + x.departure + ')';
    }).join(', ')
  };
}

function dateStr_(decalageJours) {
  var d = new Date(); d.setDate(d.getDate() + decalageJours);
  return Utilities.formatDate(d, 'Europe/Paris', 'yyyy-MM-dd');
}

/* ================= KB du robot Booking (LECTURE SEULE) ================= */

var KB_CACHE_ = null;
function chargerKB_() {
  if (KB_CACHE_) return KB_CACHE_;
  var kb = { style: '', commun: '', propmap: {} };
  var id = PropertiesService.getScriptProperties().getProperty('KB_SHEET_ID');
  if (!id) return kb;
  try {
    var sheet = SpreadsheetApp.openById(id).getSheetByName('KB');
    if (!sheet) return kb;
    sheet.getDataRange().getValues().forEach(function (row, i) {
      if (!i || !row[0]) return;
      var slug = String(row[0]);
      if (slug === '_style-claudine') kb.style = row[1];
      else if (slug === '_commun') kb.commun = row[1];
      else if (slug === '_propmap') { try { kb.propmap = JSON.parse(row[1]); } catch (e) {} }
    });
  } catch (e) { log_('kb', 'lecture KB impossible: ' + e.message); }
  KB_CACHE_ = kb;
  return kb;
}

function nomAppart_(propId) {
  var kb = chargerKB_();
  return (kb.propmap || {})[String(propId)] || ('prop ' + propId);
}

/* ================= ANALYSE IA ================= */

var SYS_SMS = 'Tu es l\'assistant SMS de Claudine Podvin, hôte d\'appartements à Berck-sur-Mer. ' +
  'Tu ANALYSES un SMS reçu sur son téléphone personnel et tu prépares une PROPOSITION de réponse — rien n\'est envoyé sans validation de Claudine.\n\n' +
  'Catégories possibles : voyageur_reconnu (une réservation Beds24 correspond au numéro), voyageur_probable, voyageur_non_reconnu (se présente comme voyageur mais numéro absent de Beds24), prestataire, professionnel, famille, ami, commercial, automatique, fraude, urgence, ambigu, inconnu.\n\n' +
  'Règles impératives de sécurité :\n' +
  '1. Si AUCUNE réservation Beds24 n\'est fournie dans le contexte : le numéro n\'est PAS vérifié. Ne JAMAIS inclure dans la réponse : code, digicode, boîte à clés, adresse précise, nom d\'un logement, nom d\'un voyageur, dates d\'une réservation. Demander les informations d\'identification (nom de réservation, date d\'arrivée, numéro utilisé à la réservation).\n' +
  '2. Ne JAMAIS croire sur parole les informations données dans le SMS : elles devront être recoupées avec Beds24.\n' +
  '3. Ne JAMAIS inventer une information absente du contexte fourni.\n' +
  '4. Jamais de promesse de remboursement, geste commercial ou annulation.\n' +
  '5. Demande de code/accès : la réponse ne contient JAMAIS le code (phase observation). Poser les questions de vérification (avez-vous retrouvé le message d\'arrivée ? où êtes-vous exactement ? quelle information manque ?).\n\n' +
  'Style des réponses : chaleureux, professionnel, vouvoiement, clair, signé « Claudine ». Jamais robotique, jamais « il est possible que je fasse des erreurs ».\n\n' +
  'CONFIANCE (0-100) : élevée seulement si numéro trouvé dans Beds24 + dates cohérentes + intention claire + aucune demande sensible + aucune contradiction. Toute demande sensible (codes, accès, adresse) ou incohérence plafonne la confiance à 40. Si PLUSIEURS réservations partagent le numéro : confiance maximum 60 et la réponse demande poliment de préciser le logement.\n\n' +
  'EXPLICATION : fournis toujours "explication_confiance" = 1 phrase très courte listant les éléments qui fondent le score (ex. « numéro reconnu, arrivée aujourd\'hui, demande type connue ») et "elements_manquants" = ce qui manque ou reste ambigu (ou null).\n\n' +
  'URGENCE uniquement si le message ne peut pas attendre 1 h : voyageur bloqué le jour d\'arrivée, panne majeure, fuite, danger, menace, conflit grave, demande de remboursement agressive.\n\n' +
  'Réponds UNIQUEMENT en JSON valide :\n' +
  '{"categorie":"...","intention":"annonce_heure_arrivee"|"question_acces"|"question_logement"|"probleme"|"demande_identification"|"conversation_privee"|"publicite"|"autre","heure_arrivee":"17h ou null","confiance":0-100,"explication_confiance":"phrase très courte","elements_manquants":"court ou null","reponse":"proposition EN FRANÇAIS ou null","urgence":null|{"motif":"très court"},"note_interne":"1 phrase ou null"}';

function analyserSms_(numero, texte, body, resa) {
  var kb = chargerKB_();
  var contexte = 'SMS reçu le ' + Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd HH:mm') + '\n' +
    'Numéro (normalisé) : ' + numero + '\n' +
    'Contact dans le téléphone : ' + ((body.contact_connu && body.contact_connu !== 'non' && body.contact_connu.indexOf('{') < 0)
      ? 'OUI — nom : ' + body.contact_connu + (body.categorie_locale && body.categorie_locale.indexOf('{') < 0 ? ' — catégorie locale : ' + body.categorie_locale : '')
      : 'NON (numéro inconnu)') + '\n' +
    'Réservation Beds24 correspondant au numéro : ' + (resa
      ? 'OUI — ' + resa.appart + ', ' + resa.prenom + ' ' + resa.nom + ', séjour ' + resa.arrivee + ' → ' + resa.depart +
        ' (statut ' + resa.statut + (resa.arrive_aujourdhui ? ', ARRIVE AUJOURD\'HUI' : '') + (resa.en_cours ? ', séjour EN COURS' : '') + ')' +
        (resa.ambigu ? '\n⚠️ AMBIGUÏTÉ : ' + resa.nb_resas + ' réservations actives partagent ce numéro. Autres : ' + resa.autres +
          ' — plafonner la confiance à 60 et demander le logement dans la réponse.' : '')
      : 'AUCUNE — numéro non vérifié, appliquer strictement la règle 1') + '\n\n' +
    'STYLE DE CLAUDINE :\n' + (kb.style || '(non chargé)') + '\n\n' +
    'SMS :\n« ' + texte + ' »';
  return claudeCall_(SYS_SMS, contexte, 700);
}

function claudeCall_(system, user, maxTokens) {
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) { log_('ia', 'ANTHROPIC_API_KEY manquante'); return null; }
  for (var essai = 1; essai <= 3; essai++) {
    var resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post', contentType: 'application/json',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, temperature: 0.3,
        system: system, messages: [{ role: 'user', content: user }] }),
      muteHttpExceptions: true });
    if (resp.getResponseCode() === 200) {
      var txt = JSON.parse(resp.getContentText()).content[0].text;
      var m = txt.match(/\{[\s\S]*\}/);
      try { return m ? JSON.parse(m[0]) : null; } catch (e) { return null; }
    }
    log_('ia', 'HTTP ' + resp.getResponseCode() + ' (essai ' + essai + ')');
    Utilities.sleep(1500 * essai);
  }
  return null;
}

/* ================= RÈGLES ================= */

function decider_(analyse) {
  var mode = config_('MODE', 'OBSERVATION');
  var data = ss_().getSheetByName(TAB_REGLES).getDataRange().getValues();
  var decision = { action: 'classer', regle: 'defaut', modele: '' };
  for (var i = 1; i < data.length; i++) {
    var r = { categorie: String(data[i][0]), intention: String(data[i][1]), confMin: Number(data[i][2] || 0),
              action: String(data[i][3]), modele: String(data[i][4] || ''), actif: String(data[i][5]) };
    if (r.actif !== 'OUI') continue;
    if (r.categorie !== String(analyse.categorie)) continue;
    if (r.intention && r.intention !== String(analyse.intention)) continue;
    if (Number(analyse.confiance || 0) < r.confMin) continue;
    decision = { action: r.action, regle: r.categorie + (r.intention ? '/' + r.intention : ''), modele: r.modele };
    break;
  }
  if (analyse.urgence) decision.action = 'alerter';
  // GARDE-FOUS PHASE 1 : jamais d'envoi réel, quel que soit le contenu des règles.
  if (decision.action === 'envoyer' &&
      (mode !== 'PRODUCTION' || config_('REPONSES_AUTO_ACTIVEES', 'NON') !== 'OUI')) {
    decision.action = (mode === 'TEST') ? 'envoyer' /* simulation tracée, rien ne part */ : 'proposer';
    decision.regle += '+retrograde-' + mode.toLowerCase();
  }
  if (Number(analyse.confiance || 0) < Number(config_('SEUIL_CONFIANCE_PROPOSITION', '60')) &&
      decision.action === 'proposer') {
    decision.action = 'classer';
    decision.regle += '+confiance-basse';
  }
  return decision;
}

function lireModele_(nom) {
  var data = ss_().getSheetByName(TAB_MODELES).getDataRange().getValues();
  for (var i = 1; i < data.length; i++) if (String(data[i][0]) === nom) return String(data[i][1]);
  return null;
}

function remplirModele_(texte, vars) {
  return texte.replace(/\{(\w+)\}/g, function (tout, cle) { return vars[cle] || tout; });
}

/* ================= JOURNAL & CONVERSATIONS ================= */

function journal_(id, numero, body, resa, analyse, action, regle, erreur) {
  ss_().getSheetByName(TAB_JOURNAL).appendRow([
    id, Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd HH:mm:ss'),
    numero, body.contact_connu || 'non', body.categorie_locale || '',
    String(body.texte || '').slice(0, 1000),
    resa ? resa.id : '', resa ? resa.appart : '', resa ? resa.arrivee : '', resa ? resa.depart : '', resa ? resa.statut : '',
    analyse.categorie || '', analyse.intention || '', analyse.confiance || '',
    action, regle, String(analyse.proposition_finale || analyse.reponse || '').slice(0, 2000),
    'journalise', erreur || '', '',
    String(analyse.explication_confiance || '') +
      (analyse.elements_manquants ? ' | manque : ' + analyse.elements_manquants : '') +
      (resa && resa.ambigu ? ' | ambiguïté : ' + resa.nb_resas + ' résas (' + resa.autres + ')' : '')]);
}

function majConversation_(numero, analyse) {
  var sheet = ss_().getSheetByName(TAB_CONV);
  var data = sheet.getDataRange().getValues();
  var statut = (analyse.categorie === 'voyageur_non_reconnu' || analyse.categorie === 'inconnu')
    ? 'en_attente_identification' : 'identifie';
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === numero) {
      var tentatives = Number(data[i][3] || 0) + (statut === 'en_attente_identification' ? 1 : 0);
      sheet.getRange(i + 1, 2, 1, 3).setValues([[new Date(), statut, tentatives]]);
      if (tentatives >= 3) alerteTechnique_('Identification impossible (3 tentatives)',
        'Le numéro ' + masquer(numero) + ' a tenté 3 fois de s\'identifier sans correspondance Beds24.');
      return;
    }
  }
  sheet.appendRow([numero, new Date(), statut, statut === 'en_attente_identification' ? 1 : 0, '']);
}

/* ================= NOTIFICATIONS ================= */

function emails_() {
  return (PropertiesService.getScriptProperties().getProperty('DIGEST_EMAILS') || '').split(',').filter(String);
}

function digestProposition_(id, numero, texte, resa, analyse) {
  var to = emails_(); if (!to.length) return;
  try {
    MailApp.sendEmail({
      to: to.join(','), subject: '📱 SMS : 1 proposition à valider (' + (resa ? resa.appart : 'non identifié') + ')',
      htmlBody: '<h2>📱 Proposition de réponse SMS <span style="color:#888">(mode ' + config_('MODE', 'OBSERVATION') + ' — rien n\'est envoyé)</span></h2>' +
        '<div style="background:#f7f7f7;border-radius:6px;padding:8px 10px;margin:8px 0">' +
        (resa
          ? '📋 <b>Réservation reconnue</b> : ' + resa.prenom + ' ' + resa.nom + ' — ' + resa.appart +
            ' — arrivée <b>' + resa.arrivee + '</b>, départ <b>' + resa.depart + '</b>' +
            (resa.arrive_aujourdhui ? ' — <b>ARRIVE AUJOURD\'HUI</b>' : resa.en_cours ? ' — séjour en cours' : '') +
            (resa.ambigu ? '<br>⚠️ <b>Ambiguïté</b> : ' + resa.nb_resas + ' réservations pour ce numéro (autres : ' + resa.autres + ')' : '')
          : '❓ <b>Numéro non reconnu dans Beds24</b> : ' + masquer(numero)) +
        '</div>' +
        '<p>Catégorie <b>' + analyse.categorie + '</b> · <b>Confiance ' + analyse.confiance + '</b>' +
        (analyse.explication_confiance ? ' : ' + analyse.explication_confiance : '') +
        (analyse.elements_manquants ? '<br><span style="color:#b26a00">Manque / ambigu : ' + analyse.elements_manquants + '</span>' : '') + '</p>' +
        (analyse.note_interne ? '<p style="color:#c0392b">⚠️ ' + analyse.note_interne + '</p>' : '') +
        '<p>💬 « ' + texte + ' »</p>' +
        '<div style="background:#f5f7ff;border-left:3px solid #3b5bdb;padding:8px;white-space:pre-wrap">' +
        (analyse.proposition_finale || '') + '</div>' +
        '<p style="color:#888">Phase observation : pour répondre, copier le texte dans votre application SMS. Réf. ' + id + '</p>' });
  } catch (e) { log_('digest', 'KO ' + e.message); }
}

function alerteUrgence_(numero, texte, resa, analyse) {
  var motif = (analyse.urgence && analyse.urgence.motif) || analyse.categorie;
  var to = emails_();
  var titre = '🚨 SMS URGENT — ' + (resa ? resa.appart : masquer(numero)) + ' — ' + String(motif).slice(0, 60);
  if (to.length) {
    try {
      MailApp.sendEmail({ to: to.join(','), subject: titre,
        htmlBody: '<h2>🚨 ' + motif + '</h2><p><b>' + (resa ? resa.appart + ' — ' + resa.prenom + ' ' + resa.nom : 'Numéro ' + masquer(numero)) +
          '</b></p><p>💬 « ' + texte + ' »</p><p>Confiance : ' + analyse.confiance + ' · ' + (analyse.note_interne || '') + '</p>' });
    } catch (e) { log_('urgence', 'mail KO ' + e.message); }
  }
  var props = PropertiesService.getScriptProperties();
  var phone = props.getProperty('CALLMEBOT_PHONE'), key = props.getProperty('CALLMEBOT_APIKEY');
  if (phone && key) {
    try {
      UrlFetchApp.fetch('https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(phone) +
        '&apikey=' + encodeURIComponent(key) + '&text=' + encodeURIComponent('🚨 SMS URGENT\n' +
          (resa ? resa.appart + ' — ' + resa.prenom + ' ' + resa.nom : 'Numéro ' + masquer(numero)) + '\n' + motif +
          '\n« ' + texte.slice(0, 250) + ' »'), { muteHttpExceptions: true });
    } catch (e) { log_('urgence', 'whatsapp KO ' + e.message); }
  }
  log_('urgence', titre);
}

function alerteTechnique_(titre, detail) {
  var to = emails_(); if (!to.length) return;
  var props = PropertiesService.getScriptProperties();
  var cle = 'ALERTE_' + titre.replace(/\W/g, '_');
  var derniere = props.getProperty(cle);
  if (derniere && (new Date() - new Date(derniere)) < 6 * 3600 * 1000) return; // max 1 alerte identique / 6h
  props.setProperty(cle, new Date().toISOString());
  try {
    MailApp.sendEmail({ to: to.join(','), subject: '⚠️ SMS-Voyageurs : ' + titre,
      htmlBody: '<p>' + detail + '</p><p style="color:#888">Robot SMS-Voyageurs — ' +
        Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM HH:mm') + '</p>' });
  } catch (e) { log_('alerte', 'mail KO ' + e.message); }
}

/* ================= VEILLE & RÉSUMÉ ================= */

/** Toutes les heures : alerte si le téléphone (MacroDroid) est muet en journée. */
function veilleSilence() {
  var heure = Number(Utilities.formatDate(new Date(), 'Europe/Paris', 'H'));
  if (heure < 8 || heure > 22) return;
  var props = PropertiesService.getScriptProperties();
  var dernier = props.getProperty('LAST_PHONE_CONTACT');
  var seuilH = Number(config_('ALERTE_SILENCE_TELEPHONE_H', '3'));
  if (!dernier) return; // jamais connecté = installation pas finie, pas d'alerte
  if ((new Date() - new Date(dernier)) > seuilH * 3600 * 1000) {
    alerteTechnique_('Téléphone muet',
      'Aucun signal de MacroDroid depuis ' + seuilH + ' h (dernier : ' + dernier + '). ' +
      'Vérifier : téléphone allumé ? MacroDroid actif ? macro « signal de vie » activée ? optimisation batterie désactivée ?');
  }
}

/** Résumé quotidien (déclencheur ~20h30). */
function resumeQuotidien() {
  var jour = Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd');
  var data = ss_().getSheetByName(TAB_JOURNAL).getDataRange().getValues();
  var iDate = COLS_JOURNAL.indexOf('date_heure'), iCat = COLS_JOURNAL.indexOf('categorie'),
      iAct = COLS_JOURNAL.indexOf('action'), iErr = COLS_JOURNAL.indexOf('erreur'),
      iResa = COLS_JOURNAL.indexOf('resa_id'), iNum = COLS_JOURNAL.indexOf('numero'),
      iMsg = COLS_JOURNAL.indexOf('message'), iApp = COLS_JOURNAL.indexOf('resa_appart'),
      iConf = COLS_JOURNAL.indexOf('confiance'), iReg = COLS_JOURNAL.indexOf('regle'),
      iProp = COLS_JOURNAL.indexOf('proposition'), iExp = COLS_JOURNAL.indexOf('explication');
  var lignes = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][iDate]).indexOf(jour) === 0) lignes.push(data[i]);
  }
  var stats = { total: lignes.length, ignores: 0, voyageurs: 0, propositions: 0, alertes: 0, nonIdentifies: 0, erreurs: 0 };
  var detail = [];
  lignes.forEach(function (l) {
    if (l[iAct] === 'ignorer') stats.ignores++;
    if (String(l[iCat]).indexOf('voyageur') === 0) stats.voyageurs++;
    if (l[iAct] === 'proposer') stats.propositions++;
    if (l[iAct] === 'alerter') stats.alertes++;
    if (String(l[iCat]) === 'voyageur_non_reconnu' || String(l[iCat]) === 'inconnu') stats.nonIdentifies++;
    if (l[iErr]) stats.erreurs++;
    detail.push('<tr><td>' + String(l[iDate]).slice(11, 16) + '</td><td>' + masquer(l[iNum]) + '</td><td>' +
      l[iCat] + '</td><td>' + (l[iApp] || '—') + '</td><td>' + l[iConf] +
      (l[iExp] ? '<br><span style="color:#888">' + String(l[iExp]).slice(0, 90) + '</span>' : '') +
      '</td><td>' + l[iAct] + '</td><td>' + l[iReg] +
      '</td><td>' + String(l[iMsg]).slice(0, 80) + '</td></tr>');
  });
  var compteursTel = {};
  try { compteursTel = JSON.parse(PropertiesService.getScriptProperties().getProperty('COMPTEURS_TEL') || '{}'); } catch (e) {}
  var to = emails_();
  if (to.length) {
    try {
      MailApp.sendEmail({
        to: to.join(','), subject: '📱 Résumé SMS du ' + Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM') +
          ' — ' + stats.total + ' transmis, ' + stats.propositions + ' proposition(s), ' + stats.alertes + ' alerte(s)',
        htmlBody: '<h2>📱 Résumé quotidien SMS-Voyageurs <span style="color:#888">(mode ' + config_('MODE', 'OBSERVATION') + ')</span></h2>' +
          '<ul><li>SMS transmis par le téléphone : <b>' + stats.total + '</b></li>' +
          '<li>Bloqués localement sur le téléphone (jamais transmis) : <b>' + (compteursTel.bloques_total != null ? compteursTel.bloques_total : '?') + '</b>' +
          ' (personnels : ' + (compteursTel.perso != null ? compteursTel.perso : '?') + ', automatiques/courts : ' + (compteursTel.courts != null ? compteursTel.courts : '?') + ')</li>' +
          '<li>Voyageurs identifiés ou probables : <b>' + stats.voyageurs + '</b></li>' +
          '<li>Propositions en attente : <b>' + stats.propositions + '</b> · Alertes : <b>' + stats.alertes + '</b></li>' +
          '<li>Non identifiés : <b>' + stats.nonIdentifies + '</b> · Erreurs techniques : <b>' + stats.erreurs + '</b></li>' +
          '<li>Réponses envoyées automatiquement : <b>0</b> (phase observation)</li></ul>' +
          (detail.length ? '<table border="1" cellpadding="4" style="border-collapse:collapse;font-size:12px">' +
            '<tr><th>Heure</th><th>Numéro</th><th>Catégorie</th><th>Logement</th><th>Conf.</th><th>Action</th><th>Règle</th><th>Message</th></tr>' +
            detail.join('') + '</table>' : '<p>Aucun SMS transmis aujourd\'hui.</p>') });
    } catch (e) { log_('resume', 'mail KO ' + e.message); }
  }
  log_('resume', JSON.stringify(stats));
  return stats;
}
