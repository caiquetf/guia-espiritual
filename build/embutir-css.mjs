/**
 * Recompila o Tailwind e reescreve o <style> embutido no index.html.
 *
 *   npm run css      (após instalar: npm install)
 *
 * É preciso rodar isto sempre que uma classe do Tailwind for adicionada ou
 * removida do index.html — o CSS é gerado a partir das classes realmente usadas.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'guia-css-'));
const saida = join(tmp, 'tw.css');

execFileSync('npx', ['tailwindcss', '-c', 'tailwind.config.js',
  '-i', 'build/tailwind-entrada.css', '-o', saida, '--minify'], { stdio: 'inherit' });

const css = readFileSync(saida, 'utf8').trim();
const html = readFileSync('index.html', 'utf8');

const marca = '<!-- Tailwind compilado localmente (npm run css). Sem CDN: carrega na hora, funciona offline. -->';
const ini = html.indexOf(marca);
if (ini === -1) throw new Error('Marcador do CSS compilado não encontrado no index.html.');
const abre = html.indexOf('<style>', ini);
const fecha = html.indexOf('</style>', abre) + '</style>'.length;

writeFileSync('index.html', html.slice(0, abre) + '<style>' + css + '</style>' + html.slice(fecha), 'utf8');
console.log(`CSS embutido: ${(css.length / 1024).toFixed(1)} KB`);
