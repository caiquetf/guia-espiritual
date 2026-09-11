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

/* Mesmo canal configurado no index.html. Vazio: o aviso não aparece. */
const CANAL_CORRECAO = 'https://wa.me/5519974118980';

/* Mesmo código de contador configurado no index.html. Vazio: nenhuma página
   gerada carrega script de terceiro. */
const CONTADOR = 'caiquetf';

/** Etiqueta a ser injetada nas páginas geradas, ou vazio se não há contador. */
const marcacaoContador = /^[a-z0-9-]+$/i.test(CONTADOR)
  ? `<script data-goatcounter="https://${CONTADOR}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>\n`
  : '';

/* Mesmo prazo usado pelo app. */
const MESES_PARA_AVISO = 12;

/**
 * "Confirmado pelo responsável" — e quando, se soubermos.
 *
 * A data só aparece quando existe: as confirmações feitas antes de a coluna
 * existir ficam sem ela, e inventar um "há pouco" seria dizer o que não se
 * sabe. O selo sozinho continua valendo; com a data, vale mais.
 */
function selosConfirmado(d){
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(d.confirmadoEm || '');
  if (!m) return 'Confirmado pelo responsável';
  const data = new Date(+m[3], +m[2] - 1, +m[1]);
  if (isNaN(data)) return 'Confirmado pelo responsável';
  return `Confirmado pelo responsável em ${MESES[data.getMonth()]} de ${data.getFullYear()}`;
}

const MESES = ['janeiro','fevereiro','março','abril','maio','junho',
               'julho','agosto','setembro','outubro','novembro','dezembro'];

/** Nunca confie que o dado chegou normalizado: marcar como confirmado quem
    escreveu "não" seria o pior erro possível aqui. */
const ehVerificado = v => /^(sim|s|x|ok|1|true|verdadeiro|confirmado|verificado)$/i.test((v||'').trim());

/** Ressalva quando o cadastro é antigo. Vazio enquanto for recente. */
function avisoAntigo(d){
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(d.timestamp || '');
  if (!m) return '';
  const [,dia,mes,ano] = m;
  const data = new Date(+ano, +mes-1, +dia);
  const t = data.getTime();
  if (!t || (Date.now() - t) / (1000*60*60*24*30.44) < MESES_PARA_AVISO) return '';
  // O mês sai da data já construída, não do que veio escrito: uma planilha em
  // outro idioma manda 3/15/2023, e MESES[14] seria "undefined" na página.
  return `Informação de ${MESES[data.getMonth()]} de ${data.getFullYear()}`;
}

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

/**
 * JSON destinado a ficar DENTRO de uma tag <script>. O navegador procura o
 * primeiro "</script>" antes de entregar o conteúdo ao JavaScript, então um
 * cadastro chamado `Casa</script><script>...` fecharia a tag e o que viesse
 * depois viraria código nosso, rodando no endereço do guia. Escapar o "<"
 * como \u003c resolve: o JSON continua o mesmo, e a tag não fecha.
 */
const jsonEmScript = valor => JSON.stringify(valor).replace(/</g, '\\u003c');

/**
 * Link para o mapa, montado com o endereço que a pessoa escreveu.
 *
 * É só um link: nada de terceiro é carregado enquanto ninguém clica, então a
 * página continua sem rastreador nenhum. Quem não informou endereço não ganha
 * botão — como em todo o resto do guia, campo vazio não vira nada.
 */
function mapa(d){
  // Sem número no endereço, o mapa cairia no meio da cidade ou em coisa
  // nenhuma. Melhor não oferecer o botão do que oferecer um que não leva.
  if (!/\d/.test(d.endereco || '') && !d.bairro) return '';
  // Muita gente escreve o bairro e a cidade dentro do endereço. Repetir na
  // busca ("Rua X, Nova Piracicaba, Nova Piracicaba") atrapalha o mapa.
  const partes = [];
  const solto = txt => new RegExp('(^|[^\\p{L}])' + deaccent(txt).toLowerCase()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^\\p{L}]|$)', 'u');
  // "Nova Piracicaba" não contém a cidade "Piracicaba" como palavra inteira —
  // por isso a comparação é por palavra, e não por pedaço de texto.
  const jaTem = txt => partes.some(p => solto(txt).test(deaccent(p).toLowerCase()));
  for (const p of [d.endereco, d.bairro, d.cidade]) if (p && !jaTem(p)) partes.push(p);
  const busca = partes.join(', ');
  const comUF = /\b(sp|s\.p\.|sao paulo|são paulo)\b/i.test(deaccent(busca)) ? busca : busca + ' - SP';
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(comUF);
}

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
  return jsonEmScript(o);
}

function linkCorrecao(d, url){
  if (!CANAL_CORRECAO) return '';
  const nome = d.nome || d.dirigente;
  const assunto = `Guia Espiritual — ${nome}`;
  const corpo = `Olá! É sobre este cadastro do Guia Espiritual:\n\n${nome}\n${url}\n\n`;
  if (CANAL_CORRECAO.startsWith('mailto:'))
    return `${CANAL_CORRECAO}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  if (/^https:\/\/(wa\.me|api\.whatsapp)/.test(CANAL_CORRECAO))
    return `${CANAL_CORRECAO}${CANAL_CORRECAO.includes('?') ? '&' : '?'}text=${encodeURIComponent(corpo)}`;
  return CANAL_CORRECAO;
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
${marcacaoContador}
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
  .verificado{ display:inline-flex; vertical-align:-.1em; margin-left:.35em }
  .verificado svg{ width:.8em; height:.8em; fill:none; stroke:var(--folha); stroke-width:1.7;
                   stroke-linecap:round; stroke-linejoin:round }
  .confirmado{ text-align:center; font-size:11px; font-weight:600; letter-spacing:.12em;
               text-transform:uppercase; color:var(--folha); margin:.45rem 0 0 }
  .antigo{ margin:0 0 1.4rem; padding:.75rem .95rem; font-size:13.5px; color:#e8c777;
           background:rgba(214,165,69,.08); border:1px solid rgba(214,165,69,.28); border-radius:11px }
  button.btn{ font:inherit; font-weight:600; cursor:pointer }
  #aviso{ position:fixed; left:50%; bottom:1.2rem; transform:translateX(-50%); background:#241a16;
          border:1px solid var(--linha); color:var(--papel); padding:.65rem 1.1rem; border-radius:12px;
          font-size:13.5px; box-shadow:0 20px 40px -20px #000 }
  footer{ text-align:center; color:var(--baixo); font-size:13px }
  footer a{ color:var(--brasa) }
</style>
</head>
<body>
<main>
  <a href="../../"><img class="marca" src="../../marca.webp" width="256" height="256" alt="Guia Espiritual" /></a>

  ${d.tradicao ? `<p class="vertente">${esc(d.tradicao)}</p>` : ''}
  <h1>${esc(d.nome || d.dirigente)}${ehVerificado(d.verificado) ? `<span class="verificado" title="Dados confirmados pelo responsável"><svg viewBox="0 0 24 24"><path d="M12 2.8l2.3 1.7 2.8-.3 1 2.7 2.4 1.5-.9 2.7.9 2.7-2.4 1.5-1 2.7-2.8-.3L12 21.2l-2.3-1.7-2.8.3-1-2.7L3.5 15.6l.9-2.7-.9-2.7 2.4-1.5 1-2.7 2.8.3Z"/><path d="M8.9 12.1l2.1 2.1 4.1-4.3"/></svg></span>` : ''}</h1>
  ${ehVerificado(d.verificado) ? `<p class="confirmado">${esc(selosConfirmado(d))}</p>` : ''}
  ${d.dirigente && d.nome ? `<p class="dirigente">${esc(d.dirigente)}</p>` : '<div style="height:1rem"></div>'}

  <div class="acoes">
    ${wa ? `<a class="btn zap" href="${wa}" rel="nofollow noopener">Chamar no WhatsApp</a>` : ''}
    ${mapa(d) ? `<a class="btn" href="${mapa(d)}" target="_blank" rel="nofollow noopener">Abrir no mapa</a>` : ''}
    <button class="btn" type="button" id="compartilhar">Compartilhar</button>
    <a class="btn" href="../../?espaco=${esc(ap)}">Ver no guia completo</a>
  </div>

  ${avisoAntigo(d) ? `<p class="antigo">${esc(avisoAntigo(d))}. Confirme horários e endereço com o espaço antes de comparecer.</p>` : ''}

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
    ${linkCorrecao(d, url) ? `<p>Informação errada, ou quer sair do guia? <a href="${esc(linkCorrecao(d, url))}" rel="nofollow noopener">Fale com a gente</a>.</p>` : ''}
    ${linksVertentes(d)}
    <p><a href="../../sobre/">Sobre o guia</a> · <a href="../../cadastrar/">Cadastrar meu espaço</a></p>
  </footer>
</main>

<script>
  // Bandeja do sistema no celular; onde não existe, copia o endereço.
  document.getElementById('compartilhar').addEventListener('click', async () => {
    const dados = { title: document.title, text: ${jsonEmScript(`${d.nome || d.dirigente} — no Guia Espiritual de Piracicaba e Região`)}, url: location.href };
    try {
      if (navigator.share){ await navigator.share(dados); return; }
      await navigator.clipboard.writeText(location.href);
      aviso('Link copiado.');
    } catch (e){
      if (e && e.name === 'AbortError') return;
      aviso('Não consegui compartilhar. Copie o endereço da barra do navegador.');
    }
  });
  function aviso(txt){
    const el = document.createElement('div');
    el.id = 'aviso'; el.textContent = txt;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
</script>
</body>
</html>
`;
}

/** Página mínima que leva do endereço antigo ao atual, sem depender de script. */
function encaminhar(destino){
  const url = `${SITE}/${PASTA}/${destino}/`;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="robots" content="noindex, follow" />
<meta http-equiv="refresh" content="0; url=../${destino}/" />
<link rel="canonical" href="${url}" />
<title>Este espaço mudou de endereço — Guia Espiritual</title>
</head>
<body style="margin:0;padding:2.5rem 1rem;background:#150f0c;color:#f3e7d6;text-align:center;
             font:15.5px/1.6 Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
<p>Este espaço agora fica em outro endereço.</p>
<p><a href="../${destino}/" style="color:#c9713f">Abrir a página dele</a></p>
</body>
</html>
`;
}


/* ═══════════ Páginas por vertente ═══════════ */

/**
 * Uma página por vertente, para quem procura no buscador.
 *
 * Ninguém digita "guia espiritual de Piracicaba" — digita "terreiro de umbanda
 * em Piracicaba". Até aqui o site só tinha a página de cada espaço e a home, e
 * nenhuma das duas responde a essa busca. Cada página destas lista quem é
 * daquela vertente e leva ao guia já filtrado, para não ser um beco.
 *
 * "Outros" fica de fora de propósito: ninguém procura por isso, e seria um
 * rótulo pobre para a tradição de alguém.
 */
const PASTA_VERTENTE = 'vertente';

const apelidoVertente = nome => deaccent(nome || '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Como cada vertente é chamada numa frase. */
const COMO_SE_PROCURA = {
  'Umbanda':                 'terreiros de Umbanda',
  'Candomblé':               'casas de Candomblé',
  'Quimbanda':               'casas de Quimbanda',
  'Jogo de Búzios':          'jogo de búzios',
  'Cartomancia/Tarô':        'cartomantes e tarólogos',
  'Holístico/Terapia':       'terapias holísticas',
  'Magia':                   'magia e bruxaria',
  'Espiritismo/Kardecismo':  'centros espíritas'
};

/**
 * Leva da página de um espaço à lista da vertente dele.
 *
 * Serve a quem chegou por um link e quer ver quem mais faz aquilo — e serve ao
 * buscador, que descobre as páginas de vertente por estes links.
 */
function linksVertentes(d){
  const suas = (d.grupos && d.grupos.length ? d.grupos : [d.grupo])
    .filter(v => v && v !== 'Outros');
  if (!suas.length) return '';
  const links = suas.map(v =>
    `<a href="../../${PASTA_VERTENTE}/${apelidoVertente(v)}/">${esc(v)}</a>`).join(' · ');
  return `<p>Ver outros espaços de ${links} no guia.</p>`;
}

function paginaVertente(vertente, doVertente, apelidoDe){
  const chamada = COMO_SE_PROCURA[vertente] || vertente;
  const cidades = [...new Set(doVertente.map(d => d.cidade).filter(Boolean))];
  const onde = cidades.length === 1 ? cidades[0] : 'Piracicaba e Região';
  const titulo = `${chamada.charAt(0).toUpperCase() + chamada.slice(1)} em ${onde}`;
  const desc = `${doVertente.length} ${doVertente.length === 1 ? 'espaço cadastrado' : 'espaços cadastrados'} `
    + `de ${vertente} em ${onde}. Endereço, horários e contato de cada um, no Guia Espiritual — `
    + `gratuito, sem anúncio e sem intermediário.`;
  const url = `${SITE}/${PASTA_VERTENTE}/${apelidoVertente(vertente)}/`;

  const itens = doVertente.map(d => {
    const local = [d.bairro, d.cidade].filter(Boolean).join(' · ');
    return `<li>
      <a href="../../${PASTA}/${esc(apelidoDe.get(d))}/">${esc(d.nome || d.dirigente)}</a>
      ${d.dirigente && d.nome ? `<span class="quem">${esc(d.dirigente)}</span>` : ''}
      ${local ? `<span class="onde">${esc(local)}</span>` : ''}
      ${ehVerificado(d.verificado) ? '<span class="ok">✓ confirmado</span>' : ''}
    </li>`;
  }).join('\n');

  const lista = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: titulo,
    numberOfItems: doVertente.length,
    itemListElement: doVertente.map((d, i) => ({
      '@type': 'ListItem', position: i + 1,
      name: d.nome || d.dirigente,
      url: `${SITE}/${PASTA}/${apelidoDe.get(d)}/`
    }))
  };

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(titulo)} — Guia Espiritual</title>
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

<script type="application/ld+json">${jsonEmScript(lista)}</script>
${marcacaoContador}
<style>
  :root{ --tinta:#150f0c; --alta:#1e1613; --linha:#3a2a21; --papel:#f3e7d6;
         --meio:#c4ac92; --baixo:#9f8771; --brasa:#c9713f; --folha:#6f8f5f; }
  *{ box-sizing:border-box }
  body{ margin:0; padding:2rem 1rem 3rem; background:var(--tinta); color:var(--papel);
        font:15.5px/1.6 Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
        background-image:radial-gradient(52rem 26rem at 50% -6%, rgba(201,113,63,.13), transparent 62%); }
  main{ max-width:40rem; margin:0 auto }
  .marca{ display:block; width:58px; height:auto; margin:0 auto 1.2rem }
  h1{ font:600 26px/1.25 'Iowan Old Style',Palatino,Georgia,serif; margin:0 0 .5rem; text-align:center }
  .sub{ text-align:center; color:var(--meio); margin:0 0 1.8rem; font-size:14.5px }
  ul{ list-style:none; margin:0; padding:0 }
  li{ background:var(--alta); border:1px solid var(--linha); border-radius:13px;
      padding:.9rem 1.1rem; margin-bottom:.7rem }
  li a{ color:var(--papel); font:600 17px/1.3 'Iowan Old Style',Palatino,Georgia,serif;
        text-decoration:none }
  li a:hover{ color:var(--brasa) }
  .quem, .onde{ display:block; color:var(--meio); font-size:13.5px; margin-top:.2rem }
  .ok{ display:inline-block; color:var(--folha); font-size:11px; font-weight:600;
       letter-spacing:.09em; text-transform:uppercase; margin-top:.35rem }
  .btn{ display:inline-block; text-decoration:none; padding:.7rem 1.2rem; border-radius:11px;
        border:1px solid var(--linha); background:#261c17; color:var(--papel);
        font-weight:600; font-size:14.5px; margin:.3rem }
  .acoes{ text-align:center; margin:1.8rem 0 0 }
  .outras{ margin:2.2rem 0 0; text-align:center; color:var(--baixo); font-size:13px; line-height:2 }
  .outras a{ color:var(--brasa); margin:0 .35rem }
  footer{ margin-top:2.4rem; padding-top:1.2rem; border-top:1px solid var(--linha);
          text-align:center; color:var(--baixo); font-size:12.5px }
  footer a{ color:var(--brasa) }
</style>
</head>
<body>
<main>
  <a href="../../"><img class="marca" src="../../marca.webp" width="256" height="256" alt="Guia Espiritual" /></a>
  <h1>${esc(titulo)}</h1>
  <p class="sub">${doVertente.length} ${doVertente.length === 1 ? 'espaço cadastrado' : 'espaços cadastrados'} no Guia Espiritual.</p>

  <ul>
${itens}
  </ul>

  <div class="acoes">
    <a class="btn" href="../../?vertente=${apelidoVertente(vertente)}">Ver no guia, com filtros</a>
    <a class="btn" href="../../cadastrar/">Cadastrar meu espaço</a>
  </div>

  <p class="outras" id="outras"></p>

  <footer>
    <p>Guia gratuito de terreiros, casas de axé, oraculistas e terapeutas.
      <br><a href="../../">Ver o guia completo</a> · <a href="../../sobre/">Como funciona</a></p>
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

/**
 * Apelidos antigos, para que link enviado continue chegando.
 *
 * O apelido carrega o fim do telefone, então corrigir o número muda o endereço
 * da página — e mata a mensagem já mandada no WhatsApp, o resultado de busca e
 * o link que alguém guardou. Aqui se anota, para cada cadastro, por quais
 * endereços ele já passou. O carimbo de data serve de identidade porque é a
 * única coisa que a pessoa não edita.
 */
const MAPA = 'espaco-apelidos.json';
const historico = existsSync(MAPA) ? JSON.parse(readFileSync(MAPA, 'utf8')) : {};

/**
 * Identidade estável do cadastro, para saber que a página de hoje é a mesma de
 * ontem com outro apelido.
 *
 * O carimbo do formulário serve porque é a única coisa que a pessoa não edita.
 * Mas ele tem precisão de segundos, e dois envios podem cair no mesmo instante
 * — aí os dois dividiriam o histórico, e quando um saísse do guia o endereço
 * antigo dele passaria a encaminhar para a página do outro. Quando o carimbo se
 * repete, cada um fica com a sua identidade e perde o encaminhamento: melhor um
 * link antigo morto do que um link antigo levando à casa errada.
 */
const carimbosRepetidos = new Set(
  registros.map(d => d.timestamp).filter((c, i, todos) => c && todos.indexOf(c) !== i));

function identidade(d, ap){
  if (!d.timestamp) return ap;
  return carimbosRepetidos.has(d.timestamp) ? d.timestamp + '#' + ap : d.timestamp;
}

const vistos = new Set();
const urls = [];
const atuais = new Map();          // identidade -> apelido de agora
const apelidoDe = new Map();       // cadastro -> apelido, para as páginas de vertente
for (const d of registros){
  if (!(d.nome || d.dirigente)) continue;
  let ap = apelido(d), n = 2;
  while (vistos.has(ap)) ap = apelido(d) + '-' + n++;   // desempate, se houver
  vistos.add(ap);
  apelidoDe.set(d, ap);
  mkdirSync(join(PASTA, ap), { recursive: true });
  writeFileSync(join(PASTA, ap, 'index.html'), pagina(d), 'utf8');
  urls.push(`${SITE}/${PASTA}/${ap}/`);

  const id = identidade(d, ap);
  atuais.set(id, ap);
  const antigos = historico[id] || [];
  if (!antigos.includes(ap)) antigos.push(ap);
  historico[id] = antigos;
}

// Endereços que este cadastro já teve e não usa mais viram uma página que
// encaminha para o atual. Fora do sitemap e fora do índice: existem para
// atender quem chega por um link antigo, não para serem achadas.
let encaminhamentos = 0;
for (const [id, antigos] of Object.entries(historico)){
  const agora = atuais.get(id);
  if (!agora) continue;                     // cadastro saiu do guia: sem destino
  for (const velho of antigos){
    if (velho === agora || vistos.has(velho)) continue;
    mkdirSync(join(PASTA, velho), { recursive: true });
    writeFileSync(join(PASTA, velho, 'index.html'), encaminhar(agora), 'utf8');
    vistos.add(velho);
    encaminhamentos++;
  }
}
if (encaminhamentos) console.log(`${encaminhamentos} endereço(s) antigo(s) encaminhando para o novo.`);
writeFileSync(MAPA, JSON.stringify(historico, null, 2) + '\n', 'utf8');

/* ── uma página por vertente ── */

rmSync(PASTA_VERTENTE, { recursive: true, force: true });
const porVertente = new Map();
for (const d of registros){
  if (!apelidoDe.has(d)) continue;
  for (const v of (d.grupos && d.grupos.length ? d.grupos : [d.grupo]).filter(Boolean)){
    if (v === 'Outros') continue;
    if (!porVertente.has(v)) porVertente.set(v, []);
    porVertente.get(v).push(d);
  }
}
const urlsVertente = [];
for (const [vertente, lista] of porVertente){
  const ap = apelidoVertente(vertente);
  mkdirSync(join(PASTA_VERTENTE, ap), { recursive: true });
  writeFileSync(join(PASTA_VERTENTE, ap, 'index.html'), paginaVertente(vertente, lista, apelidoDe), 'utf8');
  urlsVertente.push(`${SITE}/${PASTA_VERTENTE}/${ap}/`);
}
if (porVertente.size) console.log(`${porVertente.size} página(s) de vertente.`);

// O rodapé "outras vertentes" só pode ser escrito depois de saber quais existem.
for (const [vertente] of porVertente){
  const ap = apelidoVertente(vertente);
  const arquivo = join(PASTA_VERTENTE, ap, 'index.html');
  const outras = [...porVertente.keys()].filter(v => v !== vertente)
    .map(v => `<a href="../${apelidoVertente(v)}/">${esc(v)}</a>`).join(' · ');
  writeFileSync(arquivo, readFileSync(arquivo, 'utf8').replace(
    '<p class="outras" id="outras"></p>',
    outras ? `<p class="outras">Outras vertentes no guia:<br>${outras}</p>` : ''), 'utf8');
}

const data = (geradoEm || new Date().toISOString()).slice(0, 10);
writeFileSync('sitemap.xml',
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${data}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${SITE}/sobre/</loc><lastmod>${data}</lastmod><changefreq>yearly</changefreq><priority>0.5</priority></url>
${urlsVertente.map(u => `  <url><loc>${u}</loc><lastmod>${data}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`).join('\n')}
${urls.map(u => `  <url><loc>${u}</loc><lastmod>${data}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`).join('\n')}
</urlset>
`, 'utf8');

writeFileSync('robots.txt',
  `User-agent: *\nAllow: /\nDisallow: /avisos/\nDisallow: /revisar/\nDisallow: /verificar/\nDisallow: /meu/\n\nSitemap: ${SITE}/sitemap.xml\n`, 'utf8');

console.log(`${urls.length} página(s) de espaço, sitemap.xml e robots.txt gerados.`);
