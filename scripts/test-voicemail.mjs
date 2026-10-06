import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const messageId = '1a111c610922ca2e';
const bodyText = `Bonjour,
Vous avez reçu un message vocal provenant du numéro 33664886708 vers votre numéro 0033465011525.
Vous trouverez, ci-joint, le message de 16 secondes que votre correspondant vous a laissé.
Voici la transcription de ce dernier :
00:10.740 -> 00:15.840
Oui, bonjour, c'est le frigoriste, je vous appelais pour savoir si ça avait fonctionné.
Attention : Cette transcription a été générée automatiquement par une intelligence artificielle.`;

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

const cacheValues = new Map();
const modified = [];
const listQueries = [];
let profileEmail = 'demande.chezpapimaisongourmande@gmail.com';
let gmailAppPlainBody = '';
let gmailAppHtmlBody = '';
let currentMessage = {
  id: messageId,
  threadId: 'thread-1',
  internalDate: String(Date.UTC(2026, 9, 6, 15, 12)),
  labelIds: ['INBOX', 'UNREAD'],
  payload: {
    mimeType: 'multipart/mixed',
    headers: [
      { name: 'From', value: 'Nouveau Message Vocal Chez Papi <no-reply@ovh.fr>' },
      { name: 'Subject', value: 'Message vocal du 33664886708' }
    ],
    parts: [
      { mimeType: 'text/plain', filename: '', body: { data: base64Url(bodyText) } },
      {
        mimeType: 'audio/mpeg',
        filename: 'message.mp3',
        body: { attachmentId: 'attachment-1', size: 4 }
      }
    ]
  }
};

const headers = [
  'id_demande', 'nom_client', 'statut', 'date_evenement',
  'gmail_message_id', 'make_operation_log'
];
const rows = [[
  'VOXIST-' + messageId, 'Entreprise Martin', 'À rappeler', '12/10/2026',
  messageId, ''
]];
const sheet = {
  getLastRow() { return rows.length + 1; },
  getLastColumn() { return headers.length; },
  getDataRange() {
    const values = [headers, ...rows];
    return {
      getValues: () => values,
      getDisplayValues: () => values.map(row => row.map(String))
    };
  },
  getRange(startRow, startColumn, rowCount = 1, columnCount = 1) {
    const table = [headers, ...rows];
    const values = () => Array.from({ length: rowCount }, (_, rowOffset) => (
      Array.from({ length: columnCount }, (_, columnOffset) => (
        table[startRow - 1 + rowOffset]?.[startColumn - 1 + columnOffset] ?? ''
      ))
    ));
    return {
      getValue: () => values()[0][0],
      getValues: values,
      getDisplayValues: () => values().map(row => row.map(String)),
      setValue(value) {
        table[startRow - 1][startColumn - 1] = value;
        return this;
      },
      setValues(nextValues) {
        nextValues.forEach((row, rowOffset) => row.forEach((value, columnOffset) => {
          table[startRow - 1 + rowOffset][startColumn - 1 + columnOffset] = value;
        }));
        return this;
      }
    };
  }
};

const context = vm.createContext({
  console,
  Buffer,
  Logger: { log() {} },
  CacheService: {
    getScriptCache() {
      return {
        get: key => cacheValues.get(key) || null,
        put: (key, value) => cacheValues.set(key, String(value))
      };
    }
  },
  Utilities: {
    base64DecodeWebSafe(value) { return Buffer.from(String(value), 'base64url'); },
    base64Encode(value) { return Buffer.from(value).toString('base64'); },
    newBlob(value) {
      return { getDataAsString: () => Buffer.from(value).toString('utf8') };
    }
  },
  Gmail: {
    Users: {
      getProfile: () => ({ emailAddress: profileEmail }),
      Messages: {
        list: (userId, request) => {
          listQueries.push({ userId, ...request });
          return { messages: [{ id: messageId }] };
        },
        get: () => currentMessage,
        modify: (resource, userId, id) => modified.push({ resource, userId, id }),
        Attachments: {
          get: () => { throw new Error('le téléchargement audio ne doit plus décoder la chaîne REST Gmail'); }
        }
      },
      Labels: {
        list: () => ({ labels: [
          { id: 'Label_historique_ovh', name: 'Historique_OVH' },
          { id: 'Label_hors_scope', name: 'Hors_Scope_Make' }
        ] })
      }
    }
  },
  GmailApp: {
    getMessageById(id) {
      assert.equal(id, messageId);
      return {
        getPlainBody: () => gmailAppPlainBody,
        getBody: () => gmailAppHtmlBody,
        getAttachments(options) {
          assert.equal(options.includeInlineImages, false);
          assert.equal(options.includeAttachments, true);
          return [{
            getName: () => 'message.mp3',
            getContentType: () => 'audio/mpeg',
            getSize: () => 4,
            getBytes: () => Buffer.from([251, 255, 239, 1])
          }];
        }
      };
    }
  }
});

vm.runInContext(readFileSync('apps-script/code.gs', 'utf8'), context);
context.getSheet = () => sheet;
context.ensureSchemaHeaders = () => {};
context.ok = value => value;

const archived = context.archiveOvhVoicemail(messageId);
assert.equal(archived.label, 'Historique_OVH');
assert.deepEqual(JSON.parse(JSON.stringify(modified)), [{
  resource: { addLabelIds: ['Label_historique_ovh'], removeLabelIds: ['INBOX'] }, userId: 'me', id: messageId
}]);
currentMessage = { ...currentMessage, labelIds: ['UNREAD', 'Label_historique_ovh'] };

const listed = context.listUnreadVoicemails();
assert.equal(listed.count, 1);
assert.equal(listQueries[0].q, 'label:Historique_OVH is:unread');
assert.equal(listed.messages[0].caller, '06 64 88 67 08');
assert.equal(listed.messages[0].classification, 'professionnel');
assert.equal(listed.messages[0].demand.id_demande, 'VOXIST-' + messageId);
assert.equal(
  listed.messages[0].transcription,
  "Oui, bonjour, c'est le frigoriste, je vous appelais pour savoir si ça avait fonctionné."
);
assert.equal(listed.messages[0].has_audio, true);

// Les e-mails OVH réels peuvent fournir un aperçu text/plain tronqué avant la
// transcription, alors que leur variante HTML contient le texte complet.
const originalPayload = currentMessage.payload;
const plainPreview = `Bonjour,
Vous avez reçu un message vocal provenant du numéro 33664886708 vers votre numéro 0033465011525.
Vous trouverez, ci-joint, le message de 16 secondes que votre correspondant vous a laissé.`;
const htmlBody = `<html><body>
  <p>Bonjour,</p>
  <p>Vous avez reçu un message vocal provenant du numéro 33664886708 vers votre numéro 0033465011525.</p>
  <p>Voici la transcription de ce dernier :</p>
  <div>00:10.740 -&gt; 00:15.840</div>
  <div>Oui, bonjour, la transcription complète est uniquement dans le HTML.</div>
  <p>Attention : Cette transcription a été générée automatiquement par une intelligence artificielle.</p>
</body></html>`;
currentMessage = {
  ...currentMessage,
  payload: {
    ...originalPayload,
    parts: [{
      mimeType: 'multipart/alternative',
      filename: '',
      body: {},
      parts: [
        { mimeType: 'text/plain', filename: '', body: { data: base64Url(plainPreview) } },
        { mimeType: 'text/html', filename: '', body: { data: base64Url(htmlBody) } }
      ]
    }, originalPayload.parts[1]]
  }
};
const htmlTranscription = context.listUnreadVoicemails();
assert.equal(
  htmlTranscription.messages[0].transcription,
  'Oui, bonjour, la transcription complète est uniquement dans le HTML.'
);
currentMessage = { ...currentMessage, payload: originalPayload };

// Si le service avancé Gmail ne fournit que l'aperçu tronqué, le corps complet
// exposé par GmailApp reste la source de repli pour l'affichage du dashboard.
gmailAppPlainBody = plainPreview;
gmailAppHtmlBody = htmlBody;
currentMessage = {
  ...currentMessage,
  payload: {
    ...originalPayload,
    parts: [
      { mimeType: 'text/plain', filename: '', body: { data: base64Url(plainPreview) } },
      originalPayload.parts[1]
    ]
  }
};
const gmailAppTranscription = context.listUnreadVoicemails();
assert.equal(
  gmailAppTranscription.messages[0].transcription,
  'Oui, bonjour, la transcription complète est uniquement dans le HTML.'
);
gmailAppPlainBody = '';
gmailAppHtmlBody = '';
currentMessage = { ...currentMessage, payload: originalPayload };

// Un message simplement archivé dans Historique_OVH ne doit pas être présenté
// comme une demande traiteur sans rattachement exact à une fiche.
rows[0][0] = 'DEMANDE-1';
rows[0][4] = 'autre-message';
rows[0][5] = '';
const unlinked = context.listUnreadVoicemails();
assert.equal(unlinked.messages[0].classification, 'personnel');
assert.equal(unlinked.messages[0].demand, null);

const linked = context.linkVoicemailToDemand(messageId, 'DEMANDE-1');
assert.equal(linked.linked, true);
assert.equal(linked.demand.id_demande, 'DEMANDE-1');
assert.equal(rows[0][4], 'autre-message', 'le rattachement manuel ne doit pas écraser gmail_message_id');
assert.equal(JSON.parse(rows[0][5])[messageId].linked_manually, true);
const relisted = context.listUnreadVoicemails();
assert.equal(relisted.messages[0].classification, 'professionnel');
assert.equal(relisted.messages[0].demand.id_demande, 'DEMANDE-1');

const audio = context.getVoicemailAudio(messageId);
assert.equal(audio.mime_type, 'audio/mpeg');
assert.equal(audio.data_encoding, 'base64');
assert.equal(audio.data_base64, Buffer.from([251, 255, 239, 1]).toString('base64'));
assert.deepEqual([...Buffer.from(audio.data_base64, 'base64')], [251, 255, 239, 1]);

const frontendSource = readFileSync('chez-papi/app.js', 'utf8');
const normalizeStart = frontendSource.indexOf('function normalizeAudioBase64');
const normalizeEnd = frontendSource.indexOf('\nfunction waitForVoicemailAudio', normalizeStart);
assert.ok(normalizeStart >= 0 && normalizeEnd > normalizeStart, 'source audio native introuvable');
const frontendContext = vm.createContext({});
vm.runInContext(frontendSource.slice(normalizeStart, normalizeEnd), frontendContext);
const standardAudio = Buffer.from([251, 255, 239, 1]).toString('base64');
const urlSafeAudio = Buffer.from([251, 255, 239, 1]).toString('base64url');
assert.equal(frontendContext.normalizeAudioBase64(standardAudio), standardAudio);
assert.equal(frontendContext.normalizeAudioBase64(urlSafeAudio), standardAudio);
assert.equal(
  frontendContext.normalizeAudioBase64(`data:audio/mpeg;base64,\n${urlSafeAudio}`),
  standardAudio
);
assert.throws(() => frontendContext.normalizeAudioBase64('abcde'), /corrompu/);
assert.equal(frontendContext.normalizeAudioMimeType('audio/MP4'), 'audio/mp4');
assert.equal(frontendContext.normalizeAudioMimeType('text/html'), 'audio/mpeg');
assert.equal(
  frontendContext.base64AudioSource(urlSafeAudio, 'audio/mpeg'),
  `data:audio/mpeg;base64,${standardAudio}`
);
assert.equal(
  frontendSource.slice(normalizeStart, normalizeEnd).includes('atob('),
  false,
  'le frontend ne doit plus décoder manuellement la chaîne Base64'
);
assert.match(frontendSource, /<audio class="voicemail-audio" controls playsinline/);
assert.doesNotMatch(frontendSource, /Chrome ne reconnaît|Chrome tarde/);
assert.match(frontendSource, /const VOICEMAIL_PREFETCH_LIMIT = 5/);
assert.match(frontendSource, /setInterval\(refreshVoicemailsInBackground, 60 \* 1000\)/);
assert.match(frontendSource, /window\.addEventListener\('focus', refreshVoicemailsInBackground\)/);
assert.match(frontendSource, /document\.addEventListener\('visibilitychange'/);
assert.match(frontendSource, /document\.addEventListener\('play',[\s\S]*?pauseOtherVoicemailAudios\(audio\)[\s\S]*?}, true\)/);
assert.match(frontendSource, /const preserveOpenView = options\.silent && isVoicemailModalOpen\(\)/);

const loadDataStart = frontendSource.indexOf('async function loadData()');
const initialVoicemailLoad = frontendSource.indexOf("loadVoicemails({ silent: true, initial: !voicemailMessages.length })", loadDataStart);
const mainDataLoad = frontendSource.indexOf('const result = await SheetsAPI.load()', loadDataStart);
assert.ok(loadDataStart >= 0 && initialVoicemailLoad > loadDataStart && initialVoicemailLoad < mainDataLoad, 'le compteur vocal doit commencer à charger avant les demandes');

const frontendStyles = readFileSync('chez-papi/styles.css', 'utf8');
assert.match(frontendStyles, /\.modal-box\.voicemail-modal-box\s*\{[\s\S]*?width: min\(980px, calc\(100vw - 32px\)\)[\s\S]*?max-width: min\(980px, calc\(100vw - 32px\)\)/);
assert.match(frontendStyles, /\.voicemail-actions\s*\{\s*align-items: stretch;\s*flex-wrap: nowrap;/);
assert.match(frontendStyles, /@media \(max-width: 640px\)[\s\S]*?\.modal-box\.voicemail-modal-box\s*\{[\s\S]*?max-width: 100%/);
assert.match(frontendStyles, /\.modal-box\.voicemail-modal-box\s*\{[\s\S]*?display: flex;[\s\S]*?flex-direction: column;/);
assert.match(frontendStyles, /\.voicemail-modal-body\s*\{[\s\S]*?flex: 1 1 auto;[\s\S]*?min-height: 0;[\s\S]*?overflow-y: auto;/);
assert.match(frontendStyles, /\.voicemail-toolbar\s*\{[\s\S]*?position: sticky;[\s\S]*?top: 0;/);

const gmailRootStart = frontendSource.indexOf("const VOICEMAIL_GMAIL_ROOT");
const gmailUrlEnd = frontendSource.indexOf('\nfunction voicemailStateMarkup', gmailRootStart);
assert.ok(gmailRootStart >= 0 && gmailUrlEnd > gmailRootStart, 'liens Gmail des vocaux introuvables');
const gmailContext = vm.createContext({});
vm.runInContext(frontendSource.slice(gmailRootStart, gmailUrlEnd), gmailContext);
assert.equal(
  gmailContext.voicemailGmailUrl({ thread_id: 'thread-1', id: 'message-1' }),
  'https://mail.google.com/mail/u/0/#all/thread-1'
);
assert.equal(
  gmailContext.voicemailGmailUrl({ id: 'message-1' }),
  'https://mail.google.com/mail/u/0/#all/message-1'
);
assert.equal(
  gmailContext.voicemailGmailUrl({}),
  'https://mail.google.com/mail/u/0/#label/Historique_OVH'
);

const frontendHtml = readFileSync('chez-papi/index.html', 'utf8');
assert.match(frontendHtml, /https:\/\/mail\.google\.com\/mail\/u\/0\/#label\/Historique_OVH/);
assert.doesNotMatch(frontendHtml, /#label\/OVH%20R%C3%A9pondeur/);

const read = context.markVoicemailRead(messageId);
assert.equal(read.message_id, messageId);
assert.equal(read.read, true);
assert.deepEqual(JSON.parse(JSON.stringify(modified)), [
  { resource: { addLabelIds: ['Label_historique_ovh'], removeLabelIds: ['INBOX'] }, userId: 'me', id: messageId },
  { resource: { removeLabelIds: ['UNREAD'] }, userId: 'me', id: messageId }
]);

cacheValues.clear();
profileEmail = 'compte.personnel@example.com';
assert.throws(
  () => context.listUnreadVoicemails(),
  /backend n’est pas connecté à la boîte Gmail Chez Papi/
);

cacheValues.clear();
profileEmail = 'demande.chezpapimaisongourmande@gmail.com';
currentMessage = {
  ...currentMessage,
  labelIds: ['UNREAD', 'Label_historique_ovh'],
  payload: {
    ...currentMessage.payload,
    headers: [
      { name: 'From', value: 'expediteur@example.com' },
      { name: 'Subject', value: 'Message ordinaire' }
    ]
  }
};
assert.throws(() => context.getVoicemailAudio(messageId), /Message vocal OVH introuvable/);

console.log('Tests des messages vocaux réussis (boîte dédiée, classification, rattachement, audio et lecture).');
