/**
 * Busca a planilha de respostas do Google Forms (publicada como CSV),
 * converte para `dados.json` e grava na raiz do repositório.
 *
 * Uso:  node scripts/atualizar-dados.mjs [url]
 *       PLANILHA_CSV_URL=... node scripts/atualizar-dados.mjs
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const URL_CSV = process.argv[2] || process.env.PLANILHA_CSV_URL || '';
const SAIDA = 'dados.json';

/* ── As mesmas 14 colunas do formulário reconhecidas pelo app ── */
const FIELDS = [
  { key:'timestamp', label:'Carimbo de data/hora',                        aliases:['carimbo de data/hora','carimbo','timestamp','data/hora'] },
  { key:'email',     label:'Endereço de e-mail',                          aliases:['endereco de e-mail','e-mail','email','endereco de email'] },
  { key:'nome',      label:'Nome do Espaço / Nome Profissional',          aliases:['nome do espaco','nome profissional','nome do espaco / nome profissional','nome'] },
  { key:'dirigente', label:'Dirigente / Responsável / Nome de Terreiro',  aliases:['dirigente','responsavel','nome de terreiro','dirigente / responsavel / nome de terreiro'] },
  { key:'tradicao',  label:'Tradição / Vertente Espiritual',              aliases:['tradicao','vertente','tradicao / vertente espiritual','vertente espiritual'] },
  { key:'cidade',    label:'Município / Cidade da Região',                aliases:['municipio','cidade','municipio / cidade da regiao','cidade da regiao'] },
  { key:'bairro',    label:'Bairro / Localização',                        aliases:['bairro','localizacao','bairro / localizacao'] },
  { key:'endereco',  label:'Endereço Completo',                           aliases:['endereco completo','endereco','logradouro'] },
  { key:'modalidade',label:'Modalidade de Atendimento',                   aliases:['modalidade','modalidade de atendimento','tipo de atendimento','atendimento'] },
  { key:'telefone',  label:'Telefone / WhatsApp com DDD',                 aliases:['telefone','whatsapp','celular','telefone / whatsapp com ddd','contato'] },
  { key:'redes',     label:'Redes Sociais / Instagram / Site',            aliases:['redes sociais','instagram','site','redes sociais / instagram / site','rede social'] },
  { key:'horarios',  label:'Dias e Horários das Giras, Trabalhos ou Consultas', aliases:['dias e horarios','horarios','giras','dias e horarios das giras, trabalhos ou consultas','horario'] },
  { key:'servicos',  label:'Serviços Prestados e Trabalhos oferecidos',   aliases:['servicos prestados','servicos','trabalhos oferecidos','servicos prestados e trabalhos oferecidos'] },
  { key:'regras',    label:'Orientações ao Visitante / Regras do Espaço', aliases:['orientacoes ao visitante','regras','regras do espaco','orientacoes ao visitante / regras do espaco','observacoes'] }
];

const deaccent = s => (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const norm = s => deaccent(s).toLowerCase().replace(/\s+/g,' ').trim();

function detectDelimiter(text){
  const line = text.split(/\r?\n/)[0] || '';
  const outside = line.replace(/"[^"]*"/g, '');
  const c = (outside.match(/,/g)||[]).length;
  const s = (outside.match(/;/g)||[]).length;
  const t = (outside.match(/\t/g)||[]).length;
  if (t > c && t > s) return '\t';
  return s > c ? ';' : ',';
}

function parseCSV(text){
  text = text.replace(/^﻿/, '');
  const delim = detectDelimiter(text);
  const rows = []; let row = []; let cell = ''; let inQuotes = false;
  for (let i = 0; i < text.length; i++){
    const ch = text[i];
    if (inQuotes){
      if (ch === '"'){
        if (text[i+1] === '"'){ cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delim){ row.push(cell); cell = ''; }
      else if (ch === '\n'){ row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch === '\r'){ /* ignora */ }
      else cell += ch;
    }
  }
  if (cell.length || row.length){ row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

function mapHeaders(headers){
  const map = {}; const used = new Set();
  headers.forEach((h, i) => {
    const n = norm(h);
    if (!n) return;
    let best = null, bestScore = 0;
    for (const f of FIELDS){
      if (used.has(f.key)) continue;
      let score = 0;
      if (n === norm(f.label)) score = 100;
      else for (const a of f.aliases){
        const na = norm(a);
        if (n === na) score = Math.max(score, 90);
        else if (n.includes(na)) score = Math.max(score, 40 + na.length);
      }
      if (score > bestScore){ bestScore = score; best = f; }
    }
    if (best && bestScore >= 40){ map[i] = best.key; used.add(best.key); }
  });
  return map;
}

function matchTradition(v){
  const n = norm(v);
  if (!n) return 'Outros';
  if (/umbanda/.test(n)) return 'Umbanda';
  if (/candombl|ile ax|axe/.test(n)) return 'Candomblé';
  if (/quimbanda|esquerda|exu|pombagira/.test(n)) return 'Quimbanda';
  if (/buzio|merindilogun/.test(n)) return 'Jogo de Búzios';
  if (/taro|cartoman|carta|baralho|oracul/.test(n)) return 'Cartomancia/Tarô';
  if (/holist|terapia|reiki|floral|cristal|yoga|integrativ/.test(n)) return 'Holístico/Terapia';
  if (/magia|bruxaria|wicca|feiti/.test(n)) return 'Magia';
  if (/espirit|kardec|doutrina|centro espirita/.test(n)) return 'Espiritismo/Kardecismo';
  return 'Outros';
}

function matchModality(v){
  const n = norm(v);
  if (!n) return 'Presencial';
  const online = /online|remoto|virtual|distancia|video/.test(n);
  const pres   = /presencial|local|no espaco|sede/.test(n);
  if (/ambas|ambos|os dois|hibrid/.test(n) || (online && pres)) return 'Ambas';
  return online ? 'Online' : 'Presencial';
}

/* ─────────────────────────────────────────────────────────── */

if (!URL_CSV){
  console.error('Nenhuma URL de planilha configurada. Defina PLANILHA_CSV_URL ou passe a URL como argumento.');
  process.exit(78);   // 78 = configuração ausente; o workflow trata como "pular"
}

console.log('Buscando a planilha…');
const resp = await fetch(URL_CSV, { redirect:'follow', headers:{ 'User-Agent':'guia-espiritual-sync' } });
if (!resp.ok){
  console.error(`A planilha respondeu HTTP ${resp.status}. Verifique se ela está publicada na web como CSV.`);
  process.exit(1);
}
const texto = await resp.text();

if (/^\s*<(!doctype|html)/i.test(texto)){
  console.error('A resposta veio como página HTML, não como CSV. A planilha provavelmente não está publicada (File → Share → Publish to web → CSV).');
  process.exit(1);
}

const linhas = parseCSV(texto);
if (linhas.length < 2){
  console.error('A planilha não tem linhas de resposta.');
  process.exit(1);
}

const map = mapHeaders(linhas[0]);
const reconhecidas = Object.keys(map).length;

// Relatório de mapeamento — facilita descobrir cabeçalhos que mudaram no formulário.
console.log('\nMapeamento das colunas da planilha:');
linhas[0].forEach((h, i) => {
  console.log(`  ${map[i] ? '[' + map[i].padEnd(10) + ']' : '[ IGNORADA ]'} ${h}`);
});
const faltando = FIELDS.map(f => f.key).filter(k => !Object.values(map).includes(k));
if (faltando.length) console.log('\nCampos do app sem coluna correspondente: ' + faltando.join(', '));
console.log('');

if (!reconhecidas){
  console.error('Nenhuma coluna do formulário foi reconhecida.');
  process.exit(1);
}

const registros = [];
for (let r = 1; r < linhas.length; r++){
  const rec = {};
  FIELDS.forEach(f => rec[f.key] = '');
  linhas[r].forEach((v, i) => { if (map[i]) rec[map[i]] = (v||'').trim(); });
  if (!(rec.nome || rec.dirigente || rec.telefone)) continue;      // linha em branco
  rec.tradicao   = matchTradition(rec.tradicao);
  rec.modalidade = matchModality(rec.modalidade);
  registros.push(rec);
}

if (!registros.length){
  console.error('Nenhum cadastro válido encontrado na planilha.');
  process.exit(1);
}

// Remove duplicatas mantendo a resposta mais recente (a última linha vence).
const porChave = new Map();
registros.forEach(r => porChave.set(norm(r.nome) + '|' + (r.telefone||'').replace(/\D/g,''), r));
const finais = [...porChave.values()]
  .sort((a,b) => (a.cidade||'').localeCompare(b.cidade||'','pt-BR') || (a.nome||'').localeCompare(b.nome||'','pt-BR'));

// Só marca nova data de geração se o conteúdo realmente mudou — assim o
// arquivo não muda a cada hora sem motivo e o site não republica à toa.
let geradoEm = new Date().toISOString();
if (existsSync(SAIDA)){
  try {
    const anterior = JSON.parse(readFileSync(SAIDA, 'utf8'));
    if (JSON.stringify(anterior.registros) === JSON.stringify(finais)) geradoEm = anterior.geradoEm;
  } catch { /* arquivo anterior ilegível, segue com a data nova */ }
}

writeFileSync(SAIDA, JSON.stringify({ geradoEm, registros: finais }, null, 2) + '\n', 'utf8');
console.log(`${finais.length} cadastro(s) gravado(s) em ${SAIDA}. Colunas reconhecidas: ${reconhecidas}/${FIELDS.length}.`);
