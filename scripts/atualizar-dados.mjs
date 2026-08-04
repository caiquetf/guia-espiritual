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

/**
 * Link público do formulário de cadastro, vindo da variável FORMULARIO_URL do
 * repositório. Fica junto dos dados para haver um lugar só a configurar: o site,
 * a página Sobre e as páginas de espaço leem daqui.
 *
 * Só aceita http(s). O valor vai parar num href, e um `javascript:` ali seria
 * um buraco aberto na configuração.
 */
function linkFormulario(){
  return urlDaVariavel('FORMULARIO_URL');
}

/**
 * Endereço do Apps Script que marca o selo na planilha, usado só pelo painel
 * `verificar/`. Não é segredo: quem escreve é a conta Google de quem clica, e o
 * script é publicado com acesso "somente eu".
 */
function linkVerificar(){
  return urlDaVariavel('VERIFICAR_URL');
}

function urlDaVariavel(nome){
  const v = (process.env[nome] || '').trim();
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)){
    console.log(`Aviso: ${nome} não parece um endereço http(s) — ignorada: ${v.slice(0, 60)}`);
    return '';
  }
  return v;
}

/* ── As mesmas 14 colunas do formulário reconhecidas pelo app ── */
const FIELDS = [
  { key:'timestamp', label:'Carimbo de data/hora',                        aliases:['carimbo de data/hora','carimbo','timestamp','data/hora'] },
  { key:'email',     label:'Endereço de e-mail',                          aliases:['endereco de e-mail','e-mail','email','endereco de email'] },
  { key:'nome',      label:'Nome do Espaço / Nome Profissional',          aliases:['nome do espaco espiritual','nome do espaco','nome profissional','nome do espaco / nome profissional','nome'] },
  { key:'dirigente', label:'Dirigente / Responsável / Nome de Terreiro',  aliases:['qual o nome do dirigente','dirigente','responsavel','nome de terreiro','dirigente / responsavel / nome de terreiro'] },
  { key:'tradicao',  label:'Tradição / Vertente Espiritual',              aliases:['qual a vertente espiritual','tradicao','vertente','tradicao / vertente espiritual','vertente espiritual'] },
  { key:'tempo',     label:'Tempo de funcionamento',                      aliases:['a quanto tempo o espaco funciona','ha quanto tempo o espaco funciona','tempo de funcionamento','ha quanto tempo','a quanto tempo'] },
  { key:'cidade',    label:'Município / Cidade da Região',                aliases:['qual a cidade','municipio','cidade','municipio / cidade da regiao','cidade da regiao'] },
  { key:'bairro',    label:'Bairro / Localização',                        aliases:['bairro','localizacao','bairro / localizacao'] },
  { key:'endereco',  label:'Endereço Completo',                           aliases:['endereco completo','endereco','logradouro'] },
  { key:'modalidade',label:'Modalidade de Atendimento',                   aliases:['como sao realizados os atendimentos','como sao realizados','como e realizado o atendimento','modalidade de atendimento','modalidade','presencial ou online','forma de atendimento'] },
  { key:'telefone',  label:'Telefone / WhatsApp com DDD',                 aliases:['telefone','whatsapp','celular','telefone / whatsapp com ddd','contato'] },
  { key:'redes',     label:'Redes Sociais / Instagram / Site',            aliases:['redes sociais','instagram','site','redes sociais / instagram / site','rede social'] },
  { key:'horarios',  label:'Dias e Horários das Giras, Trabalhos ou Consultas', aliases:['quais dias e horarios acontecem os trabalhos','dias e horarios','horarios','giras','dias e horarios das giras, trabalhos ou consultas','horario'] },
  { key:'servicos',  label:'Serviços Prestados e Trabalhos oferecidos',   aliases:['quais tipos de atendimentos realizados','tipos de atendimentos','tipos de atendimento','atendimentos realizados','servicos prestados','servicos','trabalhos oferecidos','servicos prestados e trabalhos oferecidos'] },
  { key:'verificado',label:'Verificado',                                  aliases:['verificado','confirmado','verificacao','confirmacao','conferido'] },
  { key:'regras',    label:'Orientações ao Visitante / Regras do Espaço', aliases:['orientacoes para visitantes','orientacoes ao visitante','orientacoes','regras','regras do espaco','orientacoes ao visitante / regras do espaco','observacoes'] }
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

/** Agrupa a resposta numa das categorias, só para o filtro. O texto original
    é sempre preservado em `tradicao` e é ele que aparece na tela. */
function grupoTradicao(v){
  const n = norm(v);
  if (!n) return '';
  if (/umbanda/.test(n)) return 'Umbanda';
  if (/candombl|ile ax|axe/.test(n)) return 'Candomblé';
  if (/quimbanda|esquerda|exu|pombagira/.test(n)) return 'Quimbanda';
  if (/buzio|merindilogun/.test(n)) return 'Jogo de Búzios';
  if (/taro|cartoman|carta|baralho|oracul/.test(n)) return 'Cartomancia/Tarô';
  if (/holist|terapia|reiki|floral|cristal|yoga|integrativ/.test(n)) return 'Holístico/Terapia';
  if (/magia|bruxaria|wicca|feiti/.test(n)) return 'Magia';
  if (/espiritismo|kardec|doutrina espirita|centro espirita/.test(n)) return 'Espiritismo/Kardecismo';
  return 'Outros';
}

function matchModality(v){
  const n = norm(v);
  if (!n) return '';
  const online = /online|remoto|virtual|distancia|video/.test(n);
  const pres   = /presencial|local|no espaco|sede/.test(n);
  if (/ambas|ambos|os dois|hibrid/.test(n) || (online && pres)) return 'Ambas';
  if (online) return 'Online';
  if (pres) return 'Presencial';
  return '';
}

/* ── Correção de grafia: acentos e maiúsculas. Nunca troca uma palavra por outra. ── */

// Grafias corretas de termos que aparecem escritos sem acento ou em caixa alta.
const ORTOGRAFIA = {
  'umbanda':'Umbanda', 'umbandista':'Umbandista', 'candomble':'Candomblé', 'candomble':'Candomblé',
  'quimbanda':'Quimbanda', 'kimbanda':'Quimbanda', 'macumba':'Macumba', 'jurema':'Jurema',
  'buzios':'Búzios', 'taro':'Tarô', 'cartomancia':'Cartomancia', 'cartomante':'Cartomante',
  'oraculista':'Oraculista', 'oraculo':'Oráculo', 'baralho':'Baralho', 'cigano':'Cigano', 'cigana':'Cigana',
  'orixa':'Orixá', 'orixas':'Orixás', 'exu':'Exu', 'pombagira':'Pombagira', 'pomba':'Pomba', 'gira':'Gira',
  'caboclo':'Caboclo', 'cabocla':'Cabocla', 'preto':'Preto', 'velho':'Velho', 'erê':'Erê', 'ere':'Erê',
  'espiritismo':'Espiritismo', 'espirita':'Espírita', 'kardecismo':'Kardecismo', 'kardecista':'Kardecista',
  'reiki':'Reiki', 'reikiana':'Reikiana', 'reikiano':'Reikiano', 'holistico':'Holístico', 'holistica':'Holística',
  'terapia':'Terapia', 'terapeuta':'Terapeuta', 'magia':'Magia', 'bruxa':'Bruxa', 'bruxo':'Bruxo',
  'bruxaria':'Bruxaria', 'wicca':'Wicca', 'xamanismo':'Xamanismo', 'espiritualidade':'Espiritualidade',
  'ile':'Ilê', 'axe':'Axé', 'ase':'Asé', 'ifa':'Ifá', 'babalorixa':'Babalorixá', 'iyalorixa':'Iyalorixá',
  'ialorixa':'Ialorixá', 'babalawo':'Babalawo', 'terreiro':'Terreiro', 'tenda':'Tenda', 'centro':'Centro'
};

// Palavras que ficam em minúscula no meio de um nome próprio em português.
const MINUSCULAS = new Set(['de','da','do','das','dos','e','em','com','na','no','nas','nos','a','o','ao','à']);

function tituloPt(texto){
  return texto.toLowerCase().split(/(\s+|\/|-)/).map((parte, i) => {
    if (!parte || /^(\s+|\/|-)$/.test(parte)) return parte;
    if (i > 0 && MINUSCULAS.has(parte)) return parte;
    return parte.charAt(0).toUpperCase() + parte.slice(1);
  }).join('');
}

/**
 * Ajusta apenas a forma escrita: acentos que faltam e maiúsculas.
 * O vocabulário da pessoa é preservado — nenhuma palavra é substituída por outra.
 */
function corrigirGrafia(texto){
  const t = (texto || '').trim();
  if (!t) return '';
  // Texto todo em caixa alta ou todo minúsculo indica só o jeito de digitar,
  // não uma escolha de estilo — nesse caso normaliza as maiúsculas.
  const uniforme = t === t.toUpperCase() || t === t.toLowerCase();
  const base = uniforme ? tituloPt(t) : t;
  return base.replace(/[A-Za-zÀ-ÿ]+/g, p => {
    const c = ORTOGRAFIA[norm(p)];
    if (!c) return p;
    // Em texto de caixa mista, a capitalização foi escolhida por quem respondeu:
    // corrige só o que muda letras (acento, grafia), nunca só a maiúscula.
    if (!uniforme && c.toLowerCase() === p.toLowerCase()) return p;
    return c;
  });
}

/** Mesma ideia para cidades: corrige a grafia, sem nunca deduzir de outro campo. */
const CIDADES = ['Piracicaba','Limeira','Rio Claro','Americana',"Santa Bárbara d'Oeste",'Capivari',
  'São Pedro','Charqueada','Saltinho','Rio das Pedras','Tietê','Laranjal Paulista','Iracemápolis',
  'Cordeirópolis','Nova Odessa','Sumaré','Araras','Leme','Conchal','Ipeúna','Corumbataí','Analândia',
  'Rafard','Mombuca','Elias Fausto','Monte Mor','Campinas','Botucatu','São Manuel','Anhembi','Torrinha',
  'Águas de São Pedro','Santa Maria da Serra','Jumirim','Cerquilho','Boituva','Porto Feliz'];

function corrigirCidade(texto){
  const t = (texto || '').trim();
  if (!t) return '';
  const achada = CIDADES.find(c => norm(c) === norm(t));
  return achada || corrigirGrafia(t);
}

/** Respostas como "-", "--", "n/a" significam "não informado". */
function limpar(v){
  const t = (v||'').trim();
  return /^[-–—.\s]*$/.test(t) || /^(n\/a|na|nao tem|não tem|nenhum|nenhuma|sem)$/i.test(t) ? '' : t;
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

// DIAGNOSTICO=1 mostra os valores distintos de cada coluna — útil para ajustar o
// mapeamento. Fica desligado por padrão: os logs do Actions são públicos.
if (process.env.DIAGNOSTICO === '1'){
  console.log('\nValores distintos por coluna:');
  linhas[0].forEach((h, i) => {
    const vals = [...new Set(linhas.slice(1).map(l => (l[i]||'').trim()).filter(Boolean))];
    console.log(`\n  ${h}`);
    vals.slice(0, 6).forEach(v => console.log(`    · ${v.slice(0, 90)}`));
    if (vals.length > 6) console.log(`    … mais ${vals.length - 6}`);
  });
}
console.log('');

if (!reconhecidas){
  console.error('Nenhuma coluna do formulário foi reconhecida.');
  process.exit(1);
}

// Coluna de consentimento: só publica quem autorizou expressamente a divulgação.
const idxAutorizacao = linhas[0].findIndex(h => /autoriza|divulgac/.test(norm(h)));

// Quem pediu para sair pela própria página. A linha continua na planilha — a
// resposta original fica registrada —, mas some do site.
const idxRemovido = linhas[0].findIndex(h => /^removid/.test(norm(h)));
if (idxAutorizacao === -1){
  console.log('Aviso: nenhuma coluna de autorização de divulgação encontrada — todos os cadastros serão publicados.');
}

const registros = [];
let semAutorizacao = 0;
let removidos = 0;
for (let r = 1; r < linhas.length; r++){
  const rec = {};
  FIELDS.forEach(f => rec[f.key] = '');
  linhas[r].forEach((v, i) => { if (map[i]) rec[map[i]] = limpar(v); });
  if (!(rec.nome || rec.dirigente || rec.telefone)) continue;      // linha em branco

  if (idxRemovido !== -1 && /^(sim|s|x|1|true)$/i.test((linhas[r][idxRemovido] || '').trim())){
    removidos++;
    continue;
  }

  // Exige o "Autorizo a divulgação…". Cuidado: a outra opção da mesma pergunta diz
  // "possuo autorização para cadastrar", que não é permissão para publicar.
  if (idxAutorizacao !== -1 && !/\bautorizo\b|\bconcordo\b/.test(norm(linhas[r][idxAutorizacao] || ''))){
    semAutorizacao++;
    continue;
  }

  rec.tradicao   = corrigirGrafia(rec.tradicao);
  rec.cidade     = corrigirCidade(rec.cidade);
  rec.grupo      = grupoTradicao(rec.tradicao);
  rec.verificado = /^(sim|s|x|ok|1|true|verdadeiro|confirmado|verificado)$/i.test(rec.verificado) ? 'sim' : '';
  rec.modalidade = matchModality(rec.modalidade);
  registros.push(rec);
}

if (removidos){
  console.log(`${removidos} cadastro(s) pediram para sair — não publicados.`);
}
if (semAutorizacao){
  console.log(`${semAutorizacao} cadastro(s) sem autorização de divulgação — não publicados.`);
}
const semCidade = registros.filter(r => !r.cidade).length;
if (semCidade) console.log(`${semCidade} cadastro(s) sem cidade preenchida — não aparecem no filtro de cidade.`);
const semModalidade = registros.filter(r => !r.modalidade).length;
if (semModalidade) console.log(`${semModalidade} cadastro(s) sem modalidade preenchida — não aparecem no filtro de modalidade.`);

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

const formulario = linkFormulario();
console.log(formulario
  ? 'Link de cadastro publicado no site.'
  : 'Sem FORMULARIO_URL — o botão "Cadastrar meu espaço" não aparece.');

const apiVerificar = linkVerificar();
console.log(apiVerificar
  ? 'Painel de verificação ligado à planilha.'
  : 'Sem VERIFICAR_URL — o painel verificar/ mostra as instruções de instalação.');

writeFileSync(SAIDA,
  JSON.stringify({ geradoEm, formulario, apiVerificar, registros: finais }, null, 2) + '\n', 'utf8');
console.log(`${finais.length} cadastro(s) gravado(s) em ${SAIDA}. Colunas reconhecidas: ${reconhecidas}/${FIELDS.length}.`);
