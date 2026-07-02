import { readFileSync } from 'node:fs';

const main = JSON.parse(readFileSync('make/Integration Email - Wix - Voxist.blueprint.json', 'utf8'));
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
assert(duplicateBody.includes('WIX-'), 'préfixe WIX absent du module 60');
assert(duplicateBody.includes('VOXIST-'), 'préfixe VOXIST absent du module 60');
assert(duplicateBody.includes('GMAIL-'), 'préfixe GMAIL absent du module 60');
assert(!duplicateBody.includes('\\) +'), 'expression Make corrompue dans le module 60');

const mainRouter = moduleById(mainModules, 2);
const topRoutes = mainRouter.routes || [];
const routeIds = topRoutes.map(route => route.flow.map(module => module.id));
assert(routeIds.some(ids => ids.length === 1 && ids[0] === 88), 'route doublon Wix absente');
assert(routeIds.some(ids => ids.length === 1 && ids[0] === 89), 'route doublon Voxist absente');
assert(routeIds.some(ids => ids.includes(80) && ids.includes(87)), 'archivage après relance Email absent');

assert(moduleById(mainModules, 88).mapper?.to === 'Label_39174335232504636', 'doublon Wix vers le mauvais libellé');
assert(moduleById(mainModules, 89).mapper?.to === 'Label_5869457419717567046', 'doublon Voxist vers le mauvais libellé');
assert(moduleById(mainModules, 87).mapper?.to === 'Label_2648810022094724776', 'relance Email vers le mauvais libellé');

[62, 15, 39].forEach(id => {
  const value = moduleById(mainModules, id).mapper?.values?.date_evenement || '';
  assert(value.includes('Inconnu / à compléter'), `date inconnue non normalisée sur le module ${id}`);
});

const emailAi = moduleById(mainModules, 37);
assert(emailAi.filter?.name?.includes('analyse complète'), 'route Email direct encore limitée aux mots-clés historiques');
const emailAiConditions = (emailAi.filter?.conditions || []).flat(Infinity);
assert(!emailAiConditions.some(condition => condition?.o === 'number:greater'), 'route Email direct encore ouverte aux fils déjà connus');

const serializedMain = JSON.stringify(main);
const serializedTally = JSON.stringify(tally);
assert(!serializedMain.includes('ifempty(60.data.count; 0)'), 'anti-doublon Email/Wix/Voxist encore permissif si count est absent');
assert(!serializedTally.includes('ifempty(4.data.count; 0)'), 'anti-doublon Tally encore permissif si count est absent');

const tallyHttp = moduleById(tallyModules, 4);
assert(tallyHttp.filter?.conditions?.flat().some(condition => condition.b === 'Gx52AQ'), 'formId Tally de production absent');
assert((tallyHttp.mapper?.data || '').includes('"action":"checkDuplicate"'), 'anti-doublon Tally non relié au backend');
assert(!tallyModules.some(module => /google-sheets:(search|select|get|list)/i.test(module.module)), 'lecture Google Sheets détectée dans Tally');
assert(tallyModules.some(module => module.module === 'google-sheets:addRow'), 'création Tally absente');
assert((moduleById(tallyModules, 2).mapper?.values?.date_evenement || '').includes('DD/MM/YYYY'), 'date Tally non normalisée au format français');

console.log(`Audit blueprints réussi : ${mainModules.length} modules principaux, ${tallyModules.length} modules Tally.`);
