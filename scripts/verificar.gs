/**
 * Marca cadastros como verificados na planilha de respostas, com um clique.
 *
 * Este arquivo não roda no site: ele é colado dentro da própria planilha, no
 * Apps Script. É o que permite ao painel `verificar/` escrever na planilha sem
 * que exista senha, token ou chave guardada em página pública — quem escreve é
 * a sua conta Google, autenticada pelo próprio Google.
 *
 * ── Como instalar ────────────────────────────────────────────────────────────
 *  1. Abra script.google.com e crie um projeto novo. (Pelo celular funciona:
 *     ao contrário do link da planilha, esse endereço não é sequestrado por
 *     nenhum aplicativo. Peça "site para computador" no menu do navegador.)
 *  2. Apague o que estiver no editor e cole este arquivo.
 *  3. Preencha PLANILHA logo abaixo com o link da planilha de respostas.
 *     No app do Sheets: ⋮ → Compartilhar e exportar → Copiar link.
 *  4. Salve (💾).
 *  5. Implantar → Nova implantação → engrenagem ⚙ → App da Web.
 *       Executar como:      Eu (seu e-mail)
 *       Quem tem acesso:    Somente eu
 *     Implantar → autorize quando o Google pedir → copie a URL gerada
 *     (termina em /exec).
 *  6. No repositório: Settings → Secrets and variables → Actions → Variables →
 *     New repository variable, com nome VERIFICAR_URL e essa URL como valor.
 *
 * "Somente eu" é o que faz o painel ser seu: qualquer outra pessoa que clicar
 * cai na tela de login do Google e não consegue gravar nada.
 *
 * Se você mudar este arquivo depois, precisa criar uma NOVA implantação (ou
 * editar a existente e subir a versão) para a mudança valer.
 */

/**
 * Link da planilha de respostas — ou só o código dela, entre /d/ e /edit.
 *
 * Deixar vazio só funciona quando o script foi criado por dentro da planilha
 * (Extensões → Apps Script). Como pelo celular esse caminho não abre, o normal
 * aqui é colar o link.
 */
var PLANILHA = '';

/** Nome da coluna que o guia lê. Criada automaticamente se ainda não existir. */
var COLUNA = 'Verificado';

/** Endereço do site — para onde as respostas desta janelinha podem falar. */
var ORIGEM_DO_SITE = 'https://caiquetf.github.io';

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};

    // A ação "avisar" não mexe em nada: devolve a mensagem pronta, com o link
    // secreto do cadastro. Ela mora aqui, e não no script público, justamente
    // porque esta implantação é "somente eu" — a chave nunca passa pelo site.
    if (p.acao === 'avisar') return montarAviso(p);

    var alvoTel = soDigitos(p.tel);
    var alvoNome = normalizar(p.nome);

    if (!alvoTel && !alvoNome) return resposta('erro', 'Faltou dizer qual cadastro.');

    // Daqui para baixo só se acende ou apaga selo, e isso exige que o pedido
    // diga qual dos dois. Sem "valor" explícito não se supõe nada: um pedido
    // que este código não entende — porque veio de uma versão mais nova do
    // site — tem que parar aqui, e não acender um selo que ninguém pediu.
    if (p.valor !== 'sim' && p.valor !== 'nao') {
      return resposta('erro', 'Pedido desconhecido. Publique a versão nova do script: '
        + 'Implantar → Gerenciar implantações → ✏️ → Versão: Nova versão.');
    }
    var valor = p.valor === 'nao' ? '' : 'sim';

    var planilha = abrirPlanilha();
    if (!planilha) {
      return resposta('erro', 'Preencha PLANILHA no topo do script com o link da planilha de respostas.');
    }
    var aba = planilha.getSheets()[0];
    var dados = aba.getDataRange().getValues();
    if (dados.length < 2) return resposta('erro', 'A planilha não tem respostas.');

    var cabecalho = dados[0];
    var colVerificado = acharColuna(cabecalho, COLUNA);
    if (colVerificado === -1) {
      // Cria a coluna à direita de tudo, sem tocar no que o Forms mantém.
      colVerificado = cabecalho.length;
      aba.getRange(1, colVerificado + 1).setValue(COLUNA);
    }

    var colTel = acharColunaPor(cabecalho, ['telefone', 'whats', 'celular', 'contato']);
    var colNome = acharColunaPor(cabecalho, ['nome do espaco', 'nome profissional', 'nome']);

    var achados = [];
    for (var i = 1; i < dados.length; i++) {
      var linha = dados[i];
      var telLinha = colTel === -1 ? '' : soDigitos(linha[colTel]);
      var nomeLinha = colNome === -1 ? '' : normalizar(linha[colNome]);

      // O telefone é o que menos se repete; o nome entra como reforço, nunca
      // sozinho quando há telefone, para não marcar a casa errada.
      var bateTel = alvoTel && telLinha && fim(telLinha) === fim(alvoTel);
      var bateNome = alvoNome && nomeLinha && nomeLinha === alvoNome;
      if (alvoTel && telLinha ? bateTel : bateNome) achados.push(i + 1);
    }

    if (!achados.length) return resposta('erro', 'Não encontrei esse cadastro na planilha.');
    if (achados.length > 1) {
      return resposta('erro', 'Encontrei ' + achados.length + ' linhas iguais. Marque na mão para não errar a casa.');
    }

    aba.getRange(achados[0], colVerificado + 1).setValue(valor);
    return resposta('ok', valor ? 'Marcado como confirmado.' : 'Selo removido.');
  } catch (err) {
    return resposta('erro', String(err));
  }
}

/**
 * Abre a planilha pelo link colado em PLANILHA. Sem link, tenta a planilha que
 * hospeda o script — o que só existe quando ele foi criado por dentro dela.
 */
function abrirPlanilha() {
  var v = String(PLANILHA || '').trim();
  if (v) {
    var m = /\/d\/([a-zA-Z0-9_-]+)/.exec(v);   // aceita o link inteiro ou só o código
    return SpreadsheetApp.openById(m ? m[1] : v);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function soDigitos(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }

/** Compara pelos últimos 8 dígitos: ignora DDI, DDD escrito de jeitos diferentes
    e o nono dígito que às vezes vem e às vezes não. */
function fim(d) { return d.slice(-8); }

function normalizar(v) {
  return String(v == null ? '' : v)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function acharColuna(cabecalho, nome) {
  var alvo = normalizar(nome);
  for (var i = 0; i < cabecalho.length; i++) {
    if (normalizar(cabecalho[i]) === alvo) return i;
  }
  return -1;
}

function acharColunaPor(cabecalho, pedacos) {
  for (var j = 0; j < pedacos.length; j++) {
    for (var i = 0; i < cabecalho.length; i++) {
      if (normalizar(cabecalho[i]).indexOf(pedacos[j]) !== -1) return i;
    }
  }
  return -1;
}

/**
 * Monta a mensagem de aviso com o link privado do responsável e devolve um
 * botão que abre o WhatsApp já com tudo escrito.
 */
function montarAviso(p) {
  var planilha = abrirPlanilha();
  if (!planilha) return resposta('erro', 'Preencha PLANILHA no topo do script.');
  var aba = planilha.getSheets()[0];
  var dados = aba.getDataRange().getValues();
  var cabecalho = dados[0];

  var colTel = acharColunaPor(cabecalho, ['telefone', 'whats', 'celular', 'contato']);
  var colNome = acharColunaPor(cabecalho, ['nome do espaco', 'nome profissional', 'nome']);
  var colChave = acharColuna(cabecalho, 'Chave');

  var alvoTel = soDigitos(p.tel), alvoNome = normalizar(p.nome);
  var achados = [];
  for (var i = 1; i < dados.length; i++) {
    var t = colTel === -1 ? '' : soDigitos(dados[i][colTel]);
    var n = colNome === -1 ? '' : normalizar(dados[i][colNome]);
    if (alvoTel && t ? fim(t) === fim(alvoTel) : (alvoNome && n === alvoNome)) achados.push(i);
  }
  if (!achados.length) return resposta('erro', 'Não encontrei esse cadastro na planilha.');

  // A comparação é pelos últimos 8 dígitos, então dois cadastros podem casar:
  // um telefone de casa compartilhado, ou o mesmo número digitado com e sem o
  // nono dígito. Marcar selo errado se conserta; mandar a chave de um espaço
  // para o WhatsApp de outro entrega a edição do cadastro alheio e não tem
  // volta. Na dúvida, não escolhe.
  if (achados.length > 1) {
    return resposta('erro', 'Encontrei ' + achados.length + ' cadastros com esse telefone. '
      + 'Não dá para saber de quem é a chave — pegue o link na planilha, na coluna Chave.');
  }
  var achou = achados[0];

  if (colChave === -1) {
    return resposta('erro', 'A coluna Chave ainda não existe. Rode gerarChaves no script de cadastro.');
  }
  var chave = String(dados[achou][colChave] || '').trim();
  if (!chave) return resposta('erro', 'Este cadastro ainda não tem chave. Rode gerarChaves no script de cadastro.');

  var nome = colNome === -1 ? '' : String(dados[achou][colNome] || '');
  var site = String(p.site || '').replace(/\/$/, '');
  var texto = 'Olá! O espaço *' + nome + '* foi cadastrado no Guia Espiritual — Piracicaba e Região, '
    + 'um guia gratuito de terreiros, casas de axé, oraculistas e terapeutas da região.\n\n'
    + 'Este link é só seu. Por ele você confere os dados, corrige o que precisar, '
    + 'ou pede para sair do guia — sem falar com ninguém:\n'
    + site + '/meu/?c=' + chave + '\n\n'
    + 'Não repasse este link: quem o tiver pode alterar o cadastro.';

  var wa = soDigitos(p.tel).replace(/^0+/, '');
  if (wa && wa.indexOf('55') !== 0) wa = '55' + wa;

  var html = '<!DOCTYPE html><meta charset="utf-8">'
    + '<body style="margin:0;padding:1.5rem;background:#150f0c;color:#f3e7d6;'
    + 'font:15px/1.6 system-ui,-apple-system,Roboto,sans-serif">'
    + '<p style="color:#9f8771;font-size:12.5px;margin:0 0 .8rem">Mensagem pronta para <b>'
    + escapar(nome) + '</b></p>'
    + '<pre style="white-space:pre-wrap;background:#1e1613;border:1px solid #3a2a21;'
    + 'border-radius:12px;padding:1rem;font:inherit;font-size:13.5px;margin:0 0 1rem">'
    + escapar(texto) + '</pre>'
    + '<a href="https://wa.me/' + wa + '?text=' + encodeURIComponent(texto) + '" target="_blank" '
    + 'style="display:block;text-align:center;text-decoration:none;padding:.85rem;border-radius:12px;'
    + 'background:linear-gradient(170deg,#6f8f5f,#4f6b41);color:#f2f7ee;font-weight:600">'
    + 'Abrir o WhatsApp</a>'
    + '<p style="color:#9f8771;font-size:12.5px;margin:1rem 0 0">O link é secreto — '
    + 'mande só para o responsável.</p>';
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Página mínima que avisa o painel e some sozinha. */
function resposta(estado, texto) {
  var cor = estado === 'ok' ? '#6f8f5f' : '#c9713f';
  var html =
    '<!DOCTYPE html><meta charset="utf-8">' +
    '<body style="margin:0;display:flex;align-items:center;justify-content:center;' +
    'height:100vh;background:#150f0c;color:#f3e7d6;' +
    "font:15px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;text-align:center\">" +
    '<div><p style="color:' + cor + ';font-weight:600;margin:0 0 .4rem">' +
    (estado === 'ok' ? '✓ ' : '⚠ ') + escapar(texto) + '</p>' +
    '<p style="color:#9f8771;font-size:13px;margin:0">Pode fechar esta janela.</p></div>' +
    '<script>' +
    // Alvo estreito: a mensagem carrega só um aviso de tela, mas gritar para
    // "*" a entrega a qualquer página que esteja no meio do caminho.
    'try{ window.opener && window.opener.postMessage(' +
    JSON.stringify({ guia: 'verificar', estado: estado }) + ', ' +
    JSON.stringify(ORIGEM_DO_SITE) + '); }catch(e){}' +
    (estado === 'ok' ? 'setTimeout(function(){ window.close(); }, 900);' : '') +
    '<\/script>';
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function escapar(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
