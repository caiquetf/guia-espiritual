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

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    var alvoTel = soDigitos(p.tel);
    var alvoNome = normalizar(p.nome);
    var valor = p.valor === 'nao' ? '' : 'sim';

    if (!alvoTel && !alvoNome) return resposta('erro', 'Faltou dizer qual cadastro.');

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
    'try{ window.opener && window.opener.postMessage(' +
    JSON.stringify({ guia: 'verificar', estado: estado }) + ', "*"); }catch(e){}' +
    (estado === 'ok' ? 'setTimeout(function(){ window.close(); }, 900);' : '') +
    '<\/script>';
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function escapar(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
