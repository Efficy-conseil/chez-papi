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
          get: () => ({ data: Buffer.from('MP3!').toString('base64url'), size: 4 })
        }
      },
      Labels: {
        list: () => ({ labels: [
          { id: 'Label_historique_ovh', name: 'Historique_OVH' },
          { id: 'Label_hors_scope', name: 'Hors_Scope_Make' }
        ] })
      }
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
assert.equal(Buffer.from(audio.data_base64, 'base64').toString(), 'MP3!');

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
