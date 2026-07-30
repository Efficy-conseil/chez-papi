import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: 'inherit', ...options });
}

function requireText(file, expected) {
  const content = readFileSync(file, 'utf8');
  if (!content.includes(expected)) {
    throw new Error(`${file} ne contient pas le marqueur attendu : ${expected}`);
  }
}

function requireFunctionNotContains(file, functionName, forbidden) {
  const content = readFileSync(file, 'utf8');
  const start = content.indexOf(`function ${functionName}(`);
  const nextFunction = content.indexOf('\nfunction ', start + 1);
  const body = start >= 0 ? content.slice(start, nextFunction >= 0 ? nextFunction : undefined) : '';
  if (!body || body.includes(forbidden)) {
    throw new Error(`${file}: ${functionName} ne doit pas contenir ${forbidden}`);
  }
}

run(process.execPath, ['--check'], {
  input: readFileSync('apps-script/code.gs'),
  stdio: ['pipe', 'inherit', 'inherit'],
});
run(process.execPath, ['--check', 'chez-papi/app.js']);
run(process.execPath, ['--check', 'chez-papi/sw.js']);
run(process.execPath, ['--check', 'chez-papi/prototypes/v2/app.js']);
run(process.execPath, ['--check', 'chez-papi/prototypes/ihm-ng/app.js']);
run(process.execPath, ['--check', 'chez-papi/prototypes/relances/app.js']);
run(process.execPath, ['--check', 'chez-papi/prototypes/relances/sw.js']);
run(process.execPath, ['scripts/audit-blueprints.mjs']);
run(process.execPath, ['scripts/test-demand-matching.mjs']);
run('python3', ['-m', 'json.tool', 'make/Integration Email - Wix - Voxist.blueprint.json'], { stdio: 'ignore' });
run('python3', ['-m', 'json.tool', 'make/Integration Tally.blueprint.json'], { stdio: 'ignore' });

requireText('chez-papi/app.js', 'const HOME_PAGE_SIZE = 10;');
requireText('chez-papi/app.js', 'function showMoreHome(section)');
requireText('chez-papi/index.html', 'id="new-demandes-more"');
requireText('chez-papi/index.html', 'id="upcoming-more"');
requireText('chez-papi/index.html', 'id="confirmed-more"');
requireText('docs/frontend-functional-spec.md', 'événement Google Calendar');
requireText('apps-script/code.gs', '"En attente de réponse"');
requireText('apps-script/code.gs', 'en_attente_reponse_depuis');
requireText('chez-papi/app.js', "const WAITING_RESPONSE_REMINDER_DAYS = 7;");
requireText('chez-papi/index.html', 'id="kpi-attente-val"');
requireText('chez-papi/app.js', "function formatWaitingResponseSince(event)");
requireText('chez-papi/index.html', 'id="kpi-messages-val"');
requireText('chez-papi/index.html', 'id="mark-followup-handled-btn"');
requireText('chez-papi/index.html', 'id="reply-followup-btn"');
requireText('chez-papi/app.js', 'function hasClientMessage(e)');
requireText('chez-papi/app.js', 'function markFollowupHandled()');
requireText('chez-papi/app.js', 'const gmailId = String(e?.gmail_thread_id || e?.gmail_message_id || \'\').trim();');
requireText('chez-papi/app.js', "{ relance_a_traiter: false }");
requireText('docs/frontend-functional-spec.md', 'regroupement `Messages reçus`');
requireText('make/Integration Email - Wix - Voxist.blueprint.json', '\\"url_email_origine\\":\\"https://mail.google.com/mail/u/0/#label/Historique_Email/{{1.threadId}}\\"');
requireText('make/Integration Email - Wix - Voxist.blueprint.json', '\\"url_email_origine\\":\\"https://mail.google.com/mail/u/0/#label/Historique_Wix/{{1.threadId}}\\"');
requireText('chez-papi/app.js', 'Object.assign(row, result.fields || {}, { statut: newStatus });');
requireText('apps-script/code.gs', 'const requiresCalendarSync = !isStatusOnlyUpdate || isConfirmedStatus(currentStatus) || isConfirmedStatus(clean.statut);');
requireText('chez-papi/app.js', "controller.abort(), 30000");
requireFunctionNotContains('apps-script/code.gs', 'ensureSchemaHeaders', 'applyDefaultRowHeights(sheet)');
requireText(
  'apps-script/code.gs',
  'const isMessageScopedSource = idDemande.indexOf("WIX-") === 0 || idDemande.indexOf("VOXIST-") === 0;'
);
requireText('apps-script/code.gs', 'const gmailThreadId = isMessageScopedSource ? "" : requestedThreadId;');
requireText('apps-script/code.gs', 'function findRowsByEmailAndEventDate');
requireText('apps-script/code.gs', 'function findRowsByNameAndEventDate');
requireText('apps-script/code.gs', 'function findActiveRowsByEmail');
requireText('apps-script/code.gs', 'const hasSpecificEventDate = !!dateEvenement && dateEvenement !== "Inconnu / à compléter";');
requireText('apps-script/code.gs', 'reason: matches.length === 0 ? "existing_demand_not_found" : "existing_demand_ambiguous"');
requireText('apps-script/code.gs', 'function findDemandMatchCandidates');
requireText('apps-script/code.gs', 'function normalizePhoneKey');
requireText('apps-script/code.gs', 'requires_resolution: true');
requireText('apps-script/code.gs', 'merge_into_id');
requireText('chez-papi/app.js', '{ check_duplicates: true }');
requireText('chez-papi/index.html', 'id="duplicate-modal"');
requireText('chez-papi/app.js', 'function showDuplicateResolution');
requireText('chez-papi/index.html', "resolveDuplicateSubmission('merge')");
requireText('docs/frontend-functional-spec.md', '`Créer quand même` demande une confirmation explicite');

console.log('Vérifications locales réussies.');
