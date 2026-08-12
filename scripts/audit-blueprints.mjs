import { readFileSync } from 'node:fs';

const mainRaw = readFileSync('make/Integration Email - Wix - Voxist.blueprint.json', 'utf8');
const main = JSON.parse(mainRaw);
const tally = JSON.parse(readFileSync('make/Integration Tally.blueprint.json', 'utf8'));

function collectModules(value, modules = []) {
  if (Array.isArray(value)) {
    value.forEach(item => collectModules(item, modules));
  } else if (value && typeof value === 'object') {
    if (value.id !== undefined && value.module) modules.push(value);
    Object.values(value).forEach(item => collectModules(item, modules));
  }
  return modules;
}

function assert(condition, message) {
  if (!condition) throw new Error(`Audit blueprint : ${message}`);
}

function moduleById(modules, id) {
  const found = modules.find(module => module.id === id);
  assert(found, `module ${id} absent`);
  return found;
}

const mainModules = collectModules(main.flow);
const tallyModules = collectModules(tally.flow);

[
  [43, 'created'],
  [60, 'count'],
  [81, 'updated'],
  [94, 'updated'],
  [102, 'updated']
].forEach(([moduleId, field]) => {
  const obsoletePath = `{{${moduleId}.data.${field}}}`;
  const responsePath = `{{${moduleId}.data.data.${field}}}`;
  assert(!mainRaw.includes(obsoletePath), `réponse HTTP du module ${moduleId} lue sans l'enveloppe data`);
  assert(mainRaw.includes(responsePath), `champ ${field} de la réponse HTTP du module ${moduleId} absent ou au mauvais chemin`);
});

const mainIds = mainModules.map(module => module.id);
assert(new Set(mainIds).size === mainIds.length, 'identifiants de modules dupliqués dans le blueprint principal');

const httpModules = [...mainModules, ...tallyModules].filter(module => module.module === 'http:ActionSendData');
assert(httpModules.length > 0, 'aucun module HTTP trouvé');
httpModules.forEach(module => {
  assert(module.mapper?.followRedirect === true, `Follow redirect désactivé sur le module ${module.id}`);
  assert(module.mapper?.followAllRedirects === true, `Follow all redirects désactivé sur le module ${module.id}`);
  if (module.mapper?.contentType === 'application/json' && module.mapper?.data) {
    try {
      JSON.parse(module.mapper.data);
    } catch (error) {
      throw new Error(`Audit blueprint : corps JSON invalide sur le module HTTP ${module.id} (${error.message})`);
    }
  }
});

const duplicateModule = moduleById(mainModules, 60);
const duplicateBody = duplicateModule.mapper?.data || '';
assert(duplicateBody.includes('"action":"checkDuplicate"'), 'action checkDuplicate absente du module 60');
assert(duplicateBody.includes('"source_email":"{{1.fromEmail}}"'), 'source_email absent du module 60');
assert(duplicateBody.includes('"gmail_message_id":"{{1.id}}"'), 'gmail_message_id absent du module 60');
assert(duplicateBody.includes('"gmail_thread_id":"{{1.threadId}}"'), 'gmail_thread_id absent du module 60');
assert(!duplicateBody.includes('toJSON('), 'fonction Make toJSON non prise en charge dans le module 60');
assert(!duplicateBody.includes('\\) +'), 'expression Make corrompue dans le module 60');
assert(!mainRaw.includes('60.data.count'), 'anti-doublon du module 60 lu sans l’enveloppe data');

assert(main.metadata?.scenario?.dlq === true, 'conservation des exécutions incomplètes désactivée');
const retryModules = new Map([
  [60, 'checkDuplicate'],
  [43, 'upsertWixDemand'],
  [80, 'updateThreadFollowup'],
  [81, 'updateExistingDemandFollowup'],
  [84, 'updateWixFollowup'],
  [85, 'updateThreadFollowup'],
  [94, 'updateExistingDemandFollowup'],
  [62, 'createMakeDemand'],
  [15, 'createMakeDemand']
]);
retryModules.forEach((action, id) => {
  const module = moduleById(mainModules, id);
  assert((module.mapper?.data || '').includes(`"action":"${action}"`), `action backend inattendue sur le module ${id}`);
  const retry = module.onerror?.[0];
  assert(retry?.module === 'builtin:Break', `gestionnaire Retry absent sur le module ${id}`);
  assert(retry.mapper?.retry === true, `reprise automatique désactivée sur le module ${id}`);
  assert(retry.mapper?.count === '3' && retry.mapper?.interval === '5', `reprise attendue 3 × 5 min absente sur le module ${id}`);
});

const wixUpsertModule = moduleById(mainModules, 43);
const wixUpsertBody = wixUpsertModule.mapper?.data || '';
[
  'nom_client',
  'telephone',
  'email_client',
  'type_evenement',
  'date_evenement',
  'heure_evenement',
  'nb_convives',
  'lieu_prestation',
  'budget_estime',
  'message_original',
  'notes'
].forEach(field => {
  assert(
    wixUpsertBody.includes(`"${field}":"{{escapeJSON(42.${field})}}"`),
    `champ Wix ${field} non protégé par escapeJSON dans le module 43`
  );
});
assert(
  wixUpsertBody.includes('"wix_form_fingerprint":"{{escapeJSON(42.nom_client)}}|{{escapeJSON(42.email_client)}}|{{escapeJSON(42.date_evenement)}}|{{escapeJSON(42.telephone)}}"'),
  'empreinte Wix non protégée par escapeJSON dans le module 43'
);

const mainRouter = moduleById(mainModules, 2);
const topRoutes = mainRouter.routes || [];
const routeIds = topRoutes.map(route => route.flow.map(module => module.id));
assert(routeIds.some(ids => ids.length === 1 && ids[0] === 88), 'route doublon Wix absente');
assert(routeIds.some(ids => ids.length === 1 && ids[0] === 89), 'route doublon Voxist absente');
assert(routeIds.some(ids => ids.includes(80) && ids.includes(87)), 'archivage après relance Email absent');

assert(moduleById(mainModules, 88).mapper?.to === 'Label_39174335232504636', 'doublon Wix vers le mauvais libellé');
assert(moduleById(mainModules, 89).mapper?.to === 'Label_5869457419717567046', 'doublon Voxist vers le mauvais libellé');
assert(moduleById(mainModules, 87).mapper?.to === 'Label_2648810022094724776', 'relance Email vers le mauvais libellé');

[84, 85, 80, 81].forEach(id => {
  const body = moduleById(mainModules, id).mapper?.data || '';
  assert(
    body.includes('"dernier_message_client":"{{escapeJSON(substring(1.fullTextBody; 0; 900))}}"'),
    `message client de relance non protégé par escapeJSON dans le module ${id}`
  );
});

const router90 = moduleById(mainModules, 90);
const router91 = moduleById(mainModules, 91);
const router92 = moduleById(mainModules, 92);
assert(router90.routes?.some(route => route.flow.some(module => module.id === 70)), 'archivage hors scope Voxist transcription non séparé');
assert(router91.routes?.some(route => route.flow.some(module => module.id === 71)), 'archivage hors scope Voxist audio non séparé');
assert(router92.routes?.some(route => route.flow.some(module => module.id === 93)), 'archivage hors scope Wix absent');
assert(moduleById(mainModules, 93).mapper?.to === 'Label_2633677580427542522', 'Wix hors scope vers le mauvais libellé');

const voxistAudioFollowup = moduleById(mainModules, 102);
const voxistAudioTranscription = moduleById(mainModules, 7);
assert(voxistAudioTranscription.module === 'openai-gpt-3:CreateTranscription', 'module de retranscription Voxist inattendu');
assert(voxistAudioTranscription.mapper?.model === 'whisper-1', 'retranscription Voxist non compatible avec le module OpenAI Make actuel');
assert(voxistAudioTranscription.mapper?.fileData === '{{19.data}}', 'fichier audio Voxist absent de la retranscription');
assert(voxistAudioTranscription.mapper?.fileName === '{{19.filename}}', 'nom du fichier audio Voxist absent de la retranscription');
const voxistAudioFollowupConditions = voxistAudioFollowup.filter?.conditions || [];
assert(
  voxistAudioFollowupConditions.some(conditionSet =>
    conditionSet.some(condition => condition?.a === '{{14.statut}}' && condition?.b === 'À rappeler' && condition?.o === 'text:equal') &&
    conditionSet.some(condition => condition?.a === '{{14.message_original}}' && condition?.b === 'devis' && condition?.o === 'text:contain')
  ),
  'suivi Voxist sur devis rejeté par l’IA encore bloqué avant le rattachement'
);

const wixSuccessFlow = router92.routes?.find(route => route.flow.some(module => module.id === 43))?.flow || [];
assert(wixSuccessFlow.findIndex(module => module.id === 45) < wixSuccessFlow.findIndex(module => module.id === 44), 'archivage Wix encore placé après l’accusé optionnel');

const emailNewDemandFlow = (moduleById(mainModules, 50).routes || []).find(route => route.flow.some(module => module.id === 39))?.flow || [];
assert(emailNewDemandFlow.findIndex(module => module.id === 5) < emailNewDemandFlow.findIndex(module => module.id === 40), 'archivage Email encore placé après l’accusé optionnel');

const emailAck = moduleById(mainModules, 40);
const emailAckConditions = (emailAck.filter?.conditions || []).flat();
assert(
  emailAckConditions.some(condition => condition?.a === '{{60.data.data.count}}' && condition?.b === '0' && condition?.o === 'number:equal'),
  'accusé Email direct non protégé contre un fil déjà rattaché à une demande'
);
const emailCreationConditions = (moduleById(mainModules, 39).filter?.conditions || []);
assert(
  emailCreationConditions.every(conditionSet => conditionSet.some(
    condition => condition?.a === '{{60.data.data.count}}' && condition?.b === '0' && condition?.o === 'number:equal'
  )),
  'création Email direct non protégée contre un fil déjà rattaché à une demande'
);

const confirmationFollowup = moduleById(mainModules, 81);
const confirmationConditions = (confirmationFollowup.filter?.conditions || []).flat();
assert(
  confirmationConditions.some(condition => condition?.b === 'Bon de commande' && condition?.o === 'text:contain'),
  'bon de commande non rattaché comme suivi dans le module 81'
);
assert(
  (moduleById(mainModules, 82).filter?.conditions || []).every(conditionSet =>
    conditionSet.some(condition => condition?.a === '{{81.data.data.updated}}' && condition?.b === 'true' && condition?.o === 'boolean:equal')
  ),
  'archivage d’une confirmation non conditionné à un rattachement réussi'
);
[39, 40].forEach(id => {
  const conditionSets = moduleById(mainModules, id).filter?.conditions || [];
  assert(
    conditionSets.every(conditionSet => conditionSet.some(
      condition => condition?.a === '{{1.subject}}' && condition?.b === 'Bon de commande' && condition?.o === 'text:notcontain'
    )),
    `bon de commande encore autorisé vers la création ou l’accusé sur le module ${id}`
  );
});
const directEmailPrompt = moduleById(mainModules, 37).mapper?.messages?.find(message => message.role === 'system')?.content || '';
assert(
  directEmailPrompt.includes('Filet de sécurité confirmations') && directEmailPrompt.includes('bon de commande'),
  'règle de confirmation de commande absente du prompt Email direct'
);
const directEmailSystemPrompt = moduleById(mainModules, 37).mapper?.messages
  ?.filter(message => message.role === 'system')
  .map(message => message.content || '')
  .join('\n') || '';
assert(
  directEmailSystemPrompt.includes('Ok pour lundi, plutôt en fin de matinée') &&
    directEmailSystemPrompt.includes('date_evenement=null') &&
    directEmailSystemPrompt.includes('unique demande active'),
  'règle de rattachement des réponses courtes de rappel absente du prompt Email direct'
);
assert(
  directEmailSystemPrompt.includes('confirmations de réservation') &&
    directEmailSystemPrompt.includes('Mme De Régis') &&
    directEmailSystemPrompt.includes('25/10/2026'),
  'règle de rattachement des confirmations envoyées par un proche absente du prompt Email direct'
);
const followupConditionSets = confirmationFollowup.filter?.conditions || [];
assert(
  followupConditionSets.some(conditionSet =>
    conditionSet.some(condition => condition?.a === '{{38.is_followup}}' && condition?.b === 'true') &&
    conditionSet.some(condition => condition?.a === '{{38.email_client}}' && condition?.o === 'exist') &&
    !conditionSet.some(condition => condition?.a === '{{38.date_evenement}}')
  ),
  'suivi Email sans date de prestation encore bloqué avant le backend'
);
const followupArchiveConditionSets = moduleById(mainModules, 82).filter?.conditions || [];
assert(
  followupArchiveConditionSets.some(conditionSet =>
    conditionSet.some(condition => condition?.a === '{{38.is_followup}}' && condition?.b === 'true') &&
    conditionSet.some(condition => condition?.a === '{{81.data.data.updated}}' && condition?.b === 'true') &&
    !conditionSet.some(condition => condition?.a === '{{38.date_evenement}}')
  ),
  'archivage du suivi Email sans date encore bloqué après rattachement'
);

[62, 15, 39].forEach(id => {
  const value = moduleById(mainModules, id).mapper?.values?.date_evenement || moduleById(mainModules, id).mapper?.data || '';
  assert(value.includes('Inconnu / à compléter'), `date inconnue non normalisée sur le module ${id}`);
});

const emailAi = moduleById(mainModules, 37);
assert(emailAi.filter?.name?.includes('analyse complète'), 'route Email direct encore limitée aux mots-clés historiques');
const emailAiConditions = (emailAi.filter?.conditions || []).flat(Infinity);
assert(!emailAiConditions.some(condition => condition?.o === 'number:greater'), 'route Email direct encore ouverte aux fils déjà connus');

[41, 21, 65, 13, 37].forEach(id => {
  const datePrompt = moduleById(mainModules, id).mapper?.messages?.find(message => message.role === 'system')?.content || '';
  assert(
    datePrompt.includes('2007') && datePrompt.includes('année suivante') && datePrompt.includes('strictement future') && datePrompt.includes('une année seule'),
    `correction bornée vers l’année courante ou suivante absente du prompt de date du module ${id}`
  );
});

[21, 65, 13].forEach(id => {
  const messages = moduleById(mainModules, id).mapper?.messages || [];
  const prompt = messages.map(message => message.content || '').join('\n');
  assert(
    prompt.includes('nom_client = "Inconnu / à compléter"') && /ne jamais utiliser le type_evenement/i.test(prompt) && prompt.includes('comme nom_client'),
    `règle de repli du nom client Voxist absente du module ${id}`
  );
});

const voxistTranscriptionAi = moduleById(mainModules, 21);
const voxistPrefilterTerms = (voxistTranscriptionAi.filter?.conditions || [])
  .flat(Infinity)
  .filter(condition => condition?.a === '{{28.`$1`}}' && condition?.o === 'text:contain')
  .map(condition => String(condition.b || '').toLocaleLowerCase('fr'));
const voxistBirthdayAperoTranscript =
  'oui bonjour je voulais savoir le 15 août je fais les 20 ans de ma fille je voulais savoir si vous étiez disponible pour un apéro dînatoire pour 30 personnes';
assert(
  voxistPrefilterTerms.some(term => voxistBirthdayAperoTranscript.includes(term)),
  'le vocal anniversaire avec apéro dînatoire et 30 personnes reste exclu du préfiltre Voxist'
);
['apéro', 'apero', 'dînatoire', 'dinatoire', 'personnes', 'disponible', ' ans'].forEach(term => {
  assert(voxistPrefilterTerms.includes(term), `terme Voxist ${term} absent du préfiltre`);
});

const serializedMain = JSON.stringify(main);
const serializedTally = JSON.stringify(tally);
const existingFollowup = moduleById(mainModules, 81);
const existingFollowupFilter = JSON.stringify(existingFollowup.filter || {});
const newEmailDemand = moduleById(mainModules, 39);
const newEmailDemandFilter = JSON.stringify(newEmailDemand.filter || {});
['Merci pour vos propositions', 'modifier certaines pièces'].forEach(marker => {
  assert(existingFollowupFilter.includes(marker), `indice déterministe de suivi absent du module 81 : ${marker}`);
  assert(newEmailDemandFilter.includes(marker) && newEmailDemandFilter.includes('text:notcontain'), `indice de suivi non exclu de la création Email : ${marker}`);
});
assert(
  (existingFollowup.mapper?.data || '').includes('"lieu_prestation":"{{38.lieu_prestation}}"') &&
  (existingFollowup.mapper?.data || '').includes('"type_evenement":"{{38.type_evenement}}"'),
  'indices métier absents du rapprochement de suivi Email'
);
assert(!serializedMain.includes('ifempty(60.data.count; 0)'), 'anti-doublon Email/Wix/Voxist encore permissif si count est absent');
assert(!serializedTally.includes('ifempty(4.data.count; 0)'), 'anti-doublon Tally encore permissif si count est absent');

const tallyHttp = moduleById(tallyModules, 4);
assert(tallyHttp.filter?.conditions?.flat().some(condition => condition.b === 'Gx52AQ'), 'formId Tally de production absent');
assert((tallyHttp.mapper?.data || '').includes('"action":"checkDuplicate"'), 'anti-doublon Tally non relié au backend');
assert(!tallyModules.some(module => /google-sheets:(search|select|get|list)/i.test(module.module)), 'lecture Google Sheets détectée dans Tally');
assert(tallyModules.some(module => module.module === 'google-sheets:addRow'), 'création Tally absente');
assert((moduleById(tallyModules, 2).mapper?.values?.date_evenement || '').includes('DD/MM/YYYY'), 'date Tally non normalisée au format français');

console.log(`Audit blueprints réussi : ${mainModules.length} modules principaux, ${tallyModules.length} modules Tally.`);
