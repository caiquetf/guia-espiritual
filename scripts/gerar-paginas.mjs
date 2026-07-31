/**
 * Gera uma página estática por espaço, mais sitemap.xml e robots.txt.
 *
 * Sem isso, todo link `?espaco=` devolve o mesmo HTML: o buscador vê páginas
 * duplicadas e não indexa nenhuma, e o WhatsApp mostra sempre o mesmo cartão.
 * Cada página traz título, descrição e dados estruturados próprios.
 *
 *   node scripts/gerar-paginas.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SITE = 'https://caiquetf.github.io/guia-espiritual';
const PASTA = 'espaco';

const deaccent = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const digitos  = s => (s || '').replace(/\D/g, '');

/** Mesmo apelido usado pelo app, para os links baterem dos dois lados. */
function apelido(d){
  const base = deaccent(d.nome || d.dirigente || '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  return [base || 'espaco', digitos(d.telefone).slice(-4)].filter(Boolean).join('-');
}

const esc = s => (s ?? '').toString()
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function whatsapp(tel){
  let d = digitos(tel).replace(/^0+/, '');
  if (!d) return '';
  if (!d.startsWith('55')) d = '55' + d;
  return d.length >= 12 ? 'https://wa.me/' + d : '';
}

/** Frase de resumo para o buscador e para a prévia do link. */
function resumo(d){
  const onde = [d.bairro, d.cidade].filter(Boolean).join(', ');
  const partes = [
    d.tradicao && d.tradicao,
    onde && `em ${onde}`,
    d.modalidade && `atendimento ${d.modalidade.toLowerCase()}`
  ].filter(Boolean);
  const cabeca = partes.length ? partes.join(' · ') + '.' : '';
  const corpo = [d.servicos, d.horarios].filter(Boolean).join(' · ');
  return (cabeca + ' ' + corpo).trim().replace(/\s+/g, ' ').slice(0, 300)
    || 'Espaço espiritual cadastrado no Guia Espiritual de Piracicaba e Região.';
}

/** Dados estruturados: só entram os campos realmente preenchidos. */
function estruturado(d, url){
  const o = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: d.nome || d.dirigente,
    url,
    description: resumo(d),
    isPartOf: { '@type': 'WebSite', name: 'Guia Espiritual — Piracicaba e Região', url: SITE + '/' }
  };
  if (d.telefone) o.telephone = d.telefone;
  if (d.endereco || d.cidade || d.bairro){
    o.address = { '@type': 'PostalAddress', addressRegion: 'SP', addressCountry: 'BR' };
    if (d.endereco) o.address.streetAddress = d.endereco;
    if (d.cidade)   o.address.addressLocality = d.cidade;
    if (d.bairro && !d.endereco) o.address.streetAddress = d.bairro;
  }
  if (d.horarios) o.openingHours = d.horarios;
  if (d.servicos) o.makesOffer = d.servicos.split(/[,;·]/).map(t => t.trim()).filter(Boolean)
    .slice(0, 12).map(t => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: t } }));
  if (d.dirigente) o.employee = { '@type': 'Person', name: d.dirigente };
  return JSON.stringify(o);
}

const linha = (rot, valor) => valor
  ? `      <div class="linha"><dt>${esc(rot)}</dt><dd>${esc(valor)}</dd></div>` : '';

function pagina(d){
  const ap  = apelido(d);
  const url = `${SITE}/${PASTA}/${ap}/`;
  const wa  = whatsapp(d.telefone);
  const titulo = `${d.nome || d.dirigente} — ${[d.tradicao, d.cidade].filter(Boolean).join(', ') || 'Guia Espiritual'}`;
  const desc = resumo(d);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${url}" />
<link rel="icon" type="image/png" href="../../favicon.png" />
<meta name="theme-color" content="#150f0c" />

<meta property="og:type"        content="website" />
<meta property="og:site_name"   content="Guia Espiritual" />
<meta property="og:locale"      content="pt_BR" />
<meta property="og:url"         content="${url}" />
<meta property="og:title"       content="${esc(titulo)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:image"       content="${SITE}/social.jpg" />
<meta name="twitter:card"       content="summary_large_image" />

<script type="application/ld+json">${estruturado(d, url)}</script>

<style>
  :root{ --tinta:#150f0c; --alta:#1e1613; --linha:#3a2a21; --papel:#f3e7d6;
         --meio:#c4ac92; --baixo:#9f8771; --brasa:#c9713f; --folha:#6f8f5f; }
  *{ box-sizing:border-box }
  body{ margin:0; padding:2rem 1rem 3rem; background:var(--tinta); color:var(--papel);
        font:15px/1.6 Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
        background-image:radial-gradient(50rem 26rem at 50% -6%, rgba(201,113,63,.13), transparent 62%); }
  main{ max-width:40rem; margin:0 auto }
  .marca{ display:block; width:64px; height:auto; margin:0 auto 1.4rem }
  h1{ font:600 26px/1.25 'Iowan Old Style',Palatino,Georgia,serif; margin:0 0 .5rem; text-align:center }
  .vertente{ text-align:center; font-size:11px; font-weight:600; letter-spacing:.14em;
             text-transform:uppercase; color:var(--brasa); margin:0 0 .3rem }
  .dirigente{ text-align:center; color:var(--meio); margin:0 0 1.8rem }
  dl{ margin:0; background:var(--alta); border:1px solid var(--linha); border-radius:14px; padding:.4rem 1.2rem }
  .linha{ padding:.9rem 0; border-top:1px solid var(--linha) }
  .linha:first-child{ border-top:0 }
  dt{ font-size:11px; font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:var(--baixo) }
  dd{ margin:.2rem 0 0; white-space:pre-line }
  .acoes{ display:flex; flex-wrap:wrap; gap:.6rem; margin:1.4rem 0 2rem }
  a.btn{ flex:1; min-width:12rem; text-align:center; text-decoration:none; padding:.75rem 1rem;
         border-radius:11px; border:1px solid var(--linha); color:var(--papel); background:#261c17; font-weight:600 }
  a.zap{ background:linear-gradient(170deg,var(--folha),#4f6b41); border-color:#4f6b41; color:#f2f7ee }
  footer{ text-align:center; color:var(--baixo); font-size:13px }
  footer a{ color:var(--brasa) }
</style>
</head>
<body>
<main>
  <a href="../../"><img class="marca" src="../../marca.webp" width="256" height="256" alt="Guia Espiritual" /></a>

  ${d.tradicao ? `<p class="vertente">${esc(d.tradicao)}</p>` : ''}
  <h1>${esc(d.nome || d.dirigente)}</h1>
  ${d.dirigente && d.nome ? `<p class="dirigente">${esc(d.dirigente)}</p>` : '<div style="height:1rem"></div>'}

  <div class="acoes">
    ${wa ? `<a class="btn zap" href="${wa}" rel="nofollow noopener">Chamar no WhatsApp</a>` : ''}
    <a class="btn" href="../../?espaco=${esc(ap)}">Ver no guia completo</a>
  </div>

  <dl>
${[
  linha('Cidade',     [d.bairro, d.cidade].filter(Boolean).join(' · ')),
  linha('Endereço',   d.endereco),
  linha('Atendimento', d.modalidade),
  linha('Dias e horários', d.horarios),
  linha('Tempo de funcionamento', d.tempo),
  linha('Serviços',   d.servicos),
  linha('Orientações ao visitante', d.regras),
  linha('Telefone',   d.telefone),
  linha('Redes',      d.redes)
].filter(Boolean).join('\n')}
  </dl>

  <footer>
    <p>Cadastro do <a href="../../">Guia Espiritual — Piracicaba e Região</a>.<br>
    Confirme horários, regras e valores diretamente com o espaço antes de comparecer.</p>
  </footer>
</main>
</body>
</html>
`;
}

/* ─────────────────────────────────────────────────────────── */

if (!existsSync('dados.json')){
  console.log('Sem dados.json — nada a gerar.');
  process.exit(0);
}
const { registros = [], geradoEm } = JSON.parse(readFileSync('dados.json', 'utf8'));

// Recria a pasta do zero para que espaços removidos da planilha sumam do site.
rmSync(PASTA, { recursive: true, force: true });
mkdirSync(PASTA, { recursive: true });

const vistos = new Set();
const urls = [];
for (const d of registros){
  if (!(d.nome || d.dirigente)) continue;
  let ap = apelido(d), n = 2;
  while (vistos.has(ap)) ap = apelido(d) + '-' + n++;   // desempate, se houver
  vistos.add(ap);
  mkdirSync(join(PASTA, ap), { recursive: true });
  writeFileSync(join(PASTA, ap, 'index.html'), pagina(d), 'utf8');
  urls.push(`${SITE}/${PASTA}/${ap}/`);
}

const data = (geradoEm || new Date().toISOString()).slice(0, 10);
writeFileSync('sitemap.xml',
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${data}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
${urls.map(u => `  <url><loc>${u}</loc><lastmod>${data}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`).join('\n')}
</urlset>
`, 'utf8');

writeFileSync('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`, 'utf8');

console.log(`${urls.length} página(s) de espaço, sitemap.xml e robots.txt gerados.`);
