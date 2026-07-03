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
run('python3', ['-m', 'json.tool', 'make/Integration Email - Wix - Voxist.blueprint.json'], { stdio: 'ignore' });
run('python3', ['-m', 'json.tool', 'make/Integration Tally.blueprint.json'], { stdio: 'ignore' });

requireText('chez-papi/app.js', 'const HOME_PAGE_SIZE = 10;');
requireText('chez-papi/app.js', 'function showMoreHome(section)');
requireText('chez-papi/index.html', 'id="new-demandes-more"');
requireText('chez-papi/index.html', 'id="upcoming-more"');
requireText('chez-papi/index.html', 'id="confirmed-more"');
requireText('docs/frontend-functional-spec.md', 'événement Google Calendar');
requireText('chez-papi/app.js', "controller.abort(), 30000");
requireFunctionNotContains('apps-script/code.gs', 'ensureSchemaHeaders', 'applyDefaultRowHeights(sheet)');

console.log('Vérifications locales réussies.');
