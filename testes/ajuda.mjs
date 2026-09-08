/**
 * Peças comuns dos testes.
 *
 * Tudo aqui roda em Node puro, sem navegador e sem instalar nada: os dois
 * arquivos .gs são executados numa planilha de mentira, e os geradores são
 * chamados numa pasta temporária. É de propósito — teste que precisa de
 * instalação é teste que ninguém roda.
 */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

let passou = 0, falhou = 0;
export const ok = (nome, condicao) => {
  console.log((condicao ? '  OK  ' : ' FALHA') + '  ' + nome);
  condicao ? passou++ : falhou++;
};
export const placar = () => ({ passou, falhou });
export const secao = titulo => console.log('\n── ' + titulo + ' ──');

/** Cabeçalhos reais da planilha de respostas. */
export const CABECALHO = [
  'Carimbo de data/hora', 'Endereço de e-mail', 'NOME DO ESPAÇO ESPIRITUAL',
  'QUAL O NOME DO DIRIGENTE?', 'QUAL A VERTENTE ESPIRITUAL?', 'A QUANTO TEMPO O ESPACO FUNCIONA?',
  'QUAL A CIDADE?', 'ENDEREÇO COMPLETO', 'COMO SÃO REALIZADOS OS ATENDIMENTOS?',
  "TELEFONE / WHAT'S APP", 'QUAIS DIAS E HORÁRIOS ACONTECEM OS TRABALHOS?',
  'QUAIS TIPOS DE ATENDIMENTOS REALIZADOS?', 'ORIENTAÇÕES PARA VISITANTES',
  'AUTORIZAÇÃO DE DIVULGAÇÃO'
];

/** Planilha de mentira, com a parte da API do Sheets que os scripts usam. */
export function planilhaFalsa(linhas){
  const L = linhas.map(l => l.slice());
  const escritas = [];
  const aba = {
    getName: () => 'Respostas',
    getLastRow: () => L.length,
    getLastColumn: () => Math.max(...L.map(l => l.length)),
    getDataRange: () => ({ getValues: () => L }),
    getRange: (lin, col, nl, nc) => ({
      getValues(){
        const saida = [];
        for (let i = 0; i < (nl || 1); i++){
          const linha = L[lin - 1 + i] || [];
          const l = [];
          for (let j = 0; j < (nc || 1); j++) l.push(linha[col - 1 + j] ?? '');
          saida.push(l);
        }
        return saida;
      },
      setValue(v){
        while (!L[lin - 1]) L.push([]);
        while (L[lin - 1].length < col) L[lin - 1].push('');
        L[lin - 1][col - 1] = v;
        escritas.push({ linha: lin, coluna: col, valor: v });
      }
    }),
    appendRow: r => L.push(r.slice())
  };
  return { L, aba, escritas };
}

/** Carrega um .gs num contexto isolado, com os serviços do Google fingidos. */
export function carregarScript(arquivo, linhas){
  const p = planilhaFalsa(linhas);
  const cache = {};
  const ctx = {
    SpreadsheetApp: {
      openById: () => ({ getSheets: () => [p.aba] }),
      getActiveSpreadsheet: () => ({ getSheets: () => [p.aba] })
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock(){} }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k], put: (k, v) => { cache[k] = v; } }) },
    ContentService: {
      createTextOutput: t => ({ _t: t, setMimeType(){ return this; } }),
      MimeType: { JSON: 1 }
    },
    HtmlService: {
      createHtmlOutput: h => ({ _html: h, setXFrameOptionsMode(){ return this; } }),
      XFrameOptionsMode: { ALLOWALL: 1 }
    },
    Utilities: {
      formatDate: () => '31/07/2026 21:00:00',
      getUuid: () => randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (alg, txt) => [...createHash(alg).update(String(txt)).digest()],
      base64EncodeWebSafe: b => Buffer.from(b).toString('base64url')
    },
    Logger: { log: () => {} },
    console
  };
  createContext(ctx);
  runInContext(readFileSync(join(RAIZ, 'scripts', arquivo), 'utf8'), ctx);
  ctx.PLANILHA = 'https://docs.google.com/spreadsheets/d/ABC123/edit';
  return {
    ...p,
    ctx,
    /** Uma chamada POST ao script público. */
    post: corpo => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(corpo) } })._t),
    /** Uma chamada GET ao script do dono. */
    get: parametros => ctx.doGet({ parameter: parametros })._html,
    coluna: rotulo => p.L[0].findIndex(h => h === rotulo)
  };
}
