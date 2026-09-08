/**
 * Roda todos os testes e devolve o placar.
 *
 *   npm test          — os testes que não precisam de navegador
 *   npm run test:web  — inclui os de navegador (exigem o playwright instalado)
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const rodar = promisify(execFile);
const AQUI = dirname(fileURLToPath(import.meta.url));
const comNavegador = process.argv.includes('--navegador');

const arquivos = ['cadastro.mjs', 'publicacao.mjs', 'selo.mjs'];
if (comNavegador) arquivos.push('paginas.mjs');

let ok = 0, falha = 0, quebrou = [];
for (const arquivo of arquivos){
  if (!existsSync(join(AQUI, arquivo))) continue;
  let saida = '';
  try {
    saida = (await rodar('node', [join(AQUI, arquivo)], { maxBuffer: 1 << 24 })).stdout;
  } catch (e){
    saida = (e.stdout || '') + '\n' + (e.stderr || '');
    quebrou.push(arquivo);
  }
  process.stdout.write(saida);
  ok    += (saida.match(/^  OK  /gm) || []).length;
  falha += (saida.match(/^ FALHA/gm) || []).length;
}

console.log('\n' + '─'.repeat(56));
console.log(`${ok} verificação(ões) passando, ${falha} falha(s)`);
if (!comNavegador) console.log('(sem os de navegador — use "npm run test:web" para incluí-los)');
if (quebrou.length) console.log('arquivos que nem terminaram: ' + quebrou.join(', '));
process.exit(falha || quebrou.length ? 1 : 0);
