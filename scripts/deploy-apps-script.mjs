import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const deploymentId = 'AKfycbzouc3kD6Qc68XzK3Ne_Rlnh5_e5o_IVMkAkHKAXJl-BFrxIIVEj7IS684CugVmh2Qlow';
const clasp = join('node_modules', '.bin', process.platform === 'win32' ? 'clasp.cmd' : 'clasp');
const description = process.argv.slice(2).join(' ').trim() || `Déploiement ${new Date().toISOString()}`;

if (!existsSync(clasp)) {
  throw new Error('clasp est absent. Exécutez d’abord : npm install');
}
if (!existsSync('.clasp.json')) {
  throw new Error('Configuration .clasp.json absente.');
}

execFileSync(process.execPath, ['scripts/check-project.mjs'], { stdio: 'inherit' });
execFileSync(clasp, ['push', '--force'], { stdio: 'inherit' });

const versionOutput = execFileSync(clasp, ['version', description], { encoding: 'utf8' });
process.stdout.write(versionOutput);
const versionMatch = versionOutput.match(/(?:version|Version)\s+(\d+)/);
if (!versionMatch) {
  throw new Error(`Impossible de déterminer la version créée : ${versionOutput.trim()}`);
}

const redeployOutput = execFileSync(
  clasp,
  ['redeploy', deploymentId, '--versionNumber', versionMatch[1], '--description', description],
  { encoding: 'utf8' },
);
process.stdout.write(redeployOutput);
if (/\berror:/i.test(redeployOutput)) {
  throw new Error(`Échec du redéploiement : ${redeployOutput.trim()}`);
}

const deploymentsOutput = execFileSync(clasp, ['deployments'], { encoding: 'utf8' });
const escapedDeploymentId = deploymentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const activeVersion = deploymentsOutput.match(new RegExp(`${escapedDeploymentId}\\s+@(\\d+)`))?.[1];
if (activeVersion !== versionMatch[1]) {
  throw new Error(`Le déploiement actif est en version ${activeVersion || 'inconnue'}, version ${versionMatch[1]} attendue.`);
}

console.log(`Backend redéployé sur la version ${versionMatch[1]} sans changer son URL.`);
