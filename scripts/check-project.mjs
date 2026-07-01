import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: 'inherit', ...options });
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
run('python3', ['-m', 'json.tool', 'make/Integration Email - Wix - Voxist.blueprint.json'], { stdio: 'ignore' });
run('python3', ['-m', 'json.tool', 'make/Integration Tally.blueprint.json'], { stdio: 'ignore' });

console.log('Vérifications locales réussies.');
