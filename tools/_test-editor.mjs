import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

globalThis.window = { setTimeout: () => 1, clearTimeout: () => {} };
const bundle = await build({
  stdin: {
    contents: "export { store } from './src/store'; export { blankProject, normalizeProject } from './src/types';",
    resolveDir: process.cwd(),
  },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { store, blankProject, normalizeProject } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);

function fixture() {
  const project = blankProject();
  project.chapters = ['a', 'b', 'c'].map(id => ({ ...project.chapters[0], id }));
  project.lines = ['a1', 'b1', 'c1'].map(id => ({ ...project.lines[0], id, chapterId: id[0] }));
  store.replaceProject(project, 'test');
  return project;
}

const cases = [
  ['batch import recognizes speakers and undoes in one step', () => {
    fixture();
    const name = store.state.project.characters[0].name;
    const count = store.importScript('a', `\uFEFF旁白：站台。\r\n${name}: 你好\n\n未知：保留整句`);
    assert.equal(count, 3);
    const imported = store.state.project.lines.slice(1, 4);
    assert.equal(imported[0].text, '站台。');
    assert.equal(imported[1].speakerId, store.state.project.characters[0].id);
    assert.equal(imported[2].text, '未知：保留整句');
    assert.equal(store.state.project.lines[4].id, 'b1');
    store.undo();
    assert.deepEqual(store.state.project.lines.map(l => l.id), ['a1', 'b1', 'c1']);
    store.redo();
    assert.equal(store.state.project.lines.length, 6);
  }],
  ['duplicate chapter copies scene and lines with independent IDs', () => {
    fixture();
    const copy = store.duplicateChapter('a');
    assert.deepEqual(store.state.project.chapters.map(c => c.id), ['a', copy.id, 'b', 'c']);
    assert.deepEqual(store.state.project.lines.map(l => l.chapterId), ['a', copy.id, 'b', 'c']);
    assert.notEqual(store.state.project.lines[0].id, store.state.project.lines[1].id);
    assert.notEqual(copy.ambienceFreqs, store.state.project.chapters[0].ambienceFreqs);
    store.undo();
    assert.equal(store.state.project.chapters.length, 3);
    assert.equal(store.state.project.lines.length, 3);
  }],
  ['blank project creation retains its starter lines', () => {
    const project = normalizeProject({ title: 'blank' });
    assert.equal(project.characters.length, 1);
    assert.equal(project.lines.length, 2);
    assert.equal(project.lines[0].chapterId, project.chapters[0].id);
  }],
  ['append a line in chapter order', () => {
    fixture();
    const line = store.addLine('a');
    assert.deepEqual(store.state.project.lines.map(l => l.id), ['a1', line.id, 'b1', 'c1']);
  }],
  ['insert into an empty chapter before later chapters', () => {
    const project = fixture();
    project.lines = project.lines.filter(l => l.chapterId !== 'b');
    store.replaceProject(project, 'test');
    const line = store.addLine('b');
    assert.deepEqual(store.state.project.lines.map(l => l.id), ['a1', line.id, 'c1']);
  }],
  ['move to the destination chapter end and undo', () => {
    fixture();
    store.moveLineToChapter('a1', 'b');
    assert.deepEqual(store.state.project.lines.map(l => l.id), ['b1', 'a1', 'c1']);
    assert.equal(store.state.previewIndex, 1);
    store.undo();
    assert.deepEqual(store.state.project.lines.map(l => l.id), ['a1', 'b1', 'c1']);
    assert.equal(store.state.project.lines[0].chapterId, 'a');
  }],
  ['ignore invalid chapter moves', () => {
    fixture();
    const before = store.state.project;
    store.moveLineToChapter('a1', 'missing');
    assert.equal(store.state.project, before);
  }],
  ['open cast view after deleting the last character', () => {
    fixture();
    store.deleteCharacter(store.state.project.characters[0].id);
    store.select('line', 'a1');
    store.setView('cast');
    assert.equal(store.state.selection.id, '');
  }],
  ['preserve intentionally empty scripts and casts when reloading', () => {
    const project = fixture();
    project.lines = [];
    project.characters = [];
    const loaded = normalizeProject(JSON.parse(JSON.stringify(project)));
    assert.deepEqual(loaded.lines, []);
    assert.deepEqual(loaded.characters, []);
  }],
  ['preview normalization leaves editor data untouched', () => {
    const context = { window: {}, document: { readyState: 'loading', addEventListener() {} } };
    vm.runInNewContext(readFileSync(new URL('../src/player/runtime.js', import.meta.url), 'utf8'), context);
    const project = blankProject();
    project.lines = [];
    project.characters = [];
    project.chapters = [];
    const before = JSON.stringify(project);
    context.window.GalPlayer.normalizeProject(project);
    assert.equal(JSON.stringify(project), before);
    assert.equal('assetMap' in project, false);
  }],
  ['count audio references and clear deleted sprite expressions', () => {
    const project = fixture();
    project.assets = [{ id: 'asset', name: 'test', kind: 'sprite', src: '' }];
    project.chapters[0].ambienceAssetId = 'asset';
    project.characters[0].expressions = [{ id: 'exp', assetId: 'asset', label: 'test', keyOut: false, keyColor: '#ff00ff', tolerance: 110 }];
    project.lines[0].expressionId = 'exp';
    store.replaceProject(project, 'test');
    assert.equal(store.assetUsage('asset'), 2);
    store.deleteAsset('asset');
    assert.equal(store.state.project.lines[0].expressionId, '');
    assert.equal(store.state.project.chapters[0].ambienceAssetId, '');
  }],
];

let failures = 0;
for (const [name, run] of cases) {
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`); }
}
if (failures) process.exitCode = 1;
