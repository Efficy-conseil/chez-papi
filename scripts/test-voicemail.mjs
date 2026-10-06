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
let profileEmail = 'demande.chezpapimaisongourmande@gmail.com';
let currentMessage = {
  id: messageId,
  threadId: 'thread-1',
  internalDate: String(Date.UTC(2026, 9, 6, 15, 12)),
  labelIds: ['UNREAD', 'Label_hors_scope'],
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
  getDataRange() {
    const values = [headers, ...rows];
    return {
      getValues: () => values,
      getDisplayValues: () => values.map(row => row.map(String))
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
        list: () => ({ messages: [{ id: messageId }] }),
        get: () => currentMessage,
        modify: (resource, userId, id) => modified.push({ resource, userId, id }),
        Attachments: {
          get: () => ({ data: Buffer.from('MP3!').toString('base64url'), size: 4 })
        }
      },
      Labels: {
        list: () => ({ labels: [{ id: 'Label_hors_scope', name: 'Hors_Scope_Make' }] })
      }
    }
  }
});

vm.runInContext(readFileSync('apps-script/code.gs', 'utf8'), context);
context.getSheet = () => sheet;
context.ok = value => value;

const listed = context.listUnreadVoicemails();
assert.equal(listed.count, 1);
assert.equal(listed.messages[0].caller, '06 64 88 67 08');
assert.equal(listed.messages[0].classification, 'professionnel');
assert.equal(listed.messages[0].demand.id_demande, 'VOXIST-' + messageId);
assert.equal(
  listed.messages[0].transcription,
  "Oui, bonjour, c'est le frigoriste, je vous appelais pour savoir si ça avait fonctionné."
);
assert.equal(listed.messages[0].has_audio, true);

const audio = context.getVoicemailAudio(messageId);
assert.equal(audio.mime_type, 'audio/mpeg');
assert.equal(Buffer.from(audio.data_base64, 'base64').toString(), 'MP3!');

const read = context.markVoicemailRead(messageId);
assert.equal(read.message_id, messageId);
assert.equal(read.read, true);
assert.deepEqual(JSON.parse(JSON.stringify(modified)), [{ resource: { removeLabelIds: ['UNREAD'] }, userId: 'me', id: messageId }]);

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
  payload: {
    ...currentMessage.payload,
    headers: [
      { name: 'From', value: 'expediteur@example.com' },
      { name: 'Subject', value: 'Message ordinaire' }
    ]
  }
};
assert.throws(() => context.getVoicemailAudio(messageId), /Message vocal OVH introuvable/);

console.log('Tests des messages vocaux réussis (boîte dédiée, transcription, audio, rapprochement et lecture).');
