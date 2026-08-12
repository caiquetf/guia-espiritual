/**
 * Tudo o que o público faz na planilha: cadastrar-se e cuidar do próprio cadastro.
 *
 * Substitui o Google Forms. São quatro ações, todas partindo do site:
 *
 *   cadastrar  — grava uma linha nova (formulário em /cadastrar/)
 *   ler        — devolve UM cadastro, para quem tem a chave dele
 *   salvar     — corrige esse cadastro
 *   confirmar  — acende o selo: o responsável disse que os dados estão certos
 *   remover    — tira do guia, sem apagar a linha
 *
 * As quatro últimas exigem a **chave** do espaço: um código secreto, guardado
 * numa coluna da planilha, que só chega ao responsável pela mensagem que você
 * envia. Sem chave não se lê nem se altera nada — é o que impede uma pessoa de
 * mexer no cadastro da outra.
 *
 * A chave nunca é publicada: a sincronização só copia as colunas que conhece, e
 * esta não está entre elas.
 *
 * Este arquivo é irmão do verificar.gs, mas NÃO pode morar na mesma implantação:
 * aquele é publicado como "somente eu", porque só a dona da planilha acende
 * selos por conta própria; este precisa ser "qualquer pessoa", porque quem usa
 * é o visitante.
 *
 * ── Como instalar ────────────────────────────────────────────────────────────
 *  1. script.google.com → Novo projeto (pelo celular, peça "site para
 *     computador" no menu do navegador).
 *  2. Cole este arquivo.
 *  3. Preencha PLANILHA com o link da planilha de respostas — o mesmo que você
 *     usou no verificar.gs.
 *  4. Salve.
 *  5. Implantar → Nova implantação → App da Web:
 *       Executar como:      Eu
 *       Quem pode acessar:  QUALQUER PESSOA   ← diferente do outro script
 *  6. Autorize (a tela "o Google não verificou este app" é normal:
 *     Avançado → Acessar → Permitir) e copie a URL /exec.
 *  7. Me mande essa URL, ou cole você mesmo em API_PUBLICA — ela vai no topo do
 *     script de cadastrar/index.html e de meu/index.html.
 *  8. No editor, escolha a função `gerarChaves` e clique em Executar, uma vez.
 *     Isso dá chave aos cadastros que já existem. Quem entrar daqui em diante
 *     ganha a sua no momento do cadastro.
 *
 * "Qualquer pessoa" é o preço de ter cadastro aberto — é o mesmo que o Google
 * Forms fazia. Quem executa continua sendo você: ninguém alcança a planilha,
 * só esta função, que escreve uma linha por vez e valida o que chega.
 */

/** Link da planilha de respostas, ou só o código dela. */
var PLANILHA = '';

/** Texto gravado na coluna de autorização. O guia só publica quem tem isto. */
var TEXTO_AUTORIZACAO = 'Autorizo a divulgação das informações no Guia Espiritual';

/** Teto de cadastros por minuto, no total. Um humano nunca esbarra nisso. */
var LIMITE_POR_MINUTO = 8;

/** Colunas de controle, criadas sozinhas. Nenhuma é publicada no site. */
var COL_CHAVE = 'Chave';
var COL_REMOVIDO = 'Removido';

/**
 * Campos aceitos e onde cada um cai na planilha.
 *
 * Os apelidos são os mesmos que a sincronização usa para ler a planilha — já
 * provados contra os cabeçalhos reais do formulário. Se nenhum casar, a coluna
 * é criada à direita, com o rótulo abaixo: melhor uma coluna nova do que perder
 * o que a pessoa escreveu.
 */
var CAMPOS = [
  { chave:'email',      rotulo:'Endereço de e-mail',            apelidos:['endereco de e-mail','e-mail','email'] },
  { chave:'nome',       rotulo:'NOME DO ESPAÇO ESPIRITUAL',     apelidos:['nome do espaco espiritual','nome do espaco','nome profissional','nome'] },
  { chave:'dirigente',  rotulo:'QUAL O NOME DO DIRIGENTE?',     apelidos:['qual o nome do dirigente','dirigente','responsavel','nome de terreiro'] },
  { chave:'tradicao',   rotulo:'QUAL A VERTENTE ESPIRITUAL?',   apelidos:['qual a vertente espiritual','tradicao','vertente'] },
  { chave:'tempo',      rotulo:'A QUANTO TEMPO O ESPACO FUNCIONA?', apelidos:['a quanto tempo o espaco funciona','ha quanto tempo','tempo de funcionamento'] },
  { chave:'cidade',     rotulo:'QUAL A CIDADE?',                apelidos:['qual a cidade','municipio','cidade'] },
  { chave:'bairro',     rotulo:'BAIRRO',                        apelidos:['bairro','localizacao'] },
  { chave:'endereco',   rotulo:'ENDEREÇO COMPLETO',             apelidos:['endereco completo','endereco','logradouro'] },
  { chave:'modalidade', rotulo:'COMO SÃO REALIZADOS OS ATENDIMENTOS?', apelidos:['como sao realizados os atendimentos','modalidade','forma de atendimento'] },
  { chave:'telefone',   rotulo:"TELEFONE / WHAT'S APP",         apelidos:['telefone','whats','celular','contato'] },
  { chave:'redes',      rotulo:'REDES SOCIAIS',                 apelidos:['redes sociais','instagram','site','rede social'] },
  { chave:'horarios',   rotulo:'QUAIS DIAS E HORÁRIOS ACONTECEM OS TRABALHOS?', apelidos:['quais dias e horarios acontecem os trabalhos','dias e horarios','horarios','giras'] },
  { chave:'servicos',   rotulo:'QUAIS TIPOS DE ATENDIMENTOS REALIZADOS?', apelidos:['quais tipos de atendimentos realizados','tipos de atendimentos','servicos prestados','servicos'] },
  { chave:'regras',     rotulo:'ORIENTAÇÕES PARA VISITANTES',   apelidos:['orientacoes para visitantes','orientacoes ao visitante','orientacoes','regras'] },
  { chave:'autorizacao',rotulo:'AUTORIZAÇÃO DE DIVULGAÇÃO',     apelidos:['autorizacao de divulgacao','autorizacao','divulgacao'] }
];

function doPost(e) {
  try {
    var corpo = {};
    try { corpo = JSON.parse(e.postData.contents); } catch (err) { return json({ ok:false, erro:'Não entendi o envio.' }); }

    switch (corpo.acao) {
      case 'ler':       return lerCadastro(corpo);
      case 'salvar':    return salvarCadastro(corpo);
      case 'confirmar': return confirmarCadastro(corpo);
      case 'remover':   return removerCadastro(corpo);
    }
    return cadastrar(corpo);
  } catch (err) {
    return json({ ok:false, erro: 'Erro no servidor: ' + err });
  }
}

function cadastrar(corpo) {
  try {

    // Campo-armadilha: fica escondido no formulário, então só robô preenche.
    // Responde "ok" de propósito — quem está automatizando não descobre que caiu.
    if (String(corpo.website || '').trim()) return json({ ok:true, id:'-' });

    if (!corpo.autorizacao) {
      return json({ ok:false, erro:'É preciso autorizar a divulgação para aparecer no guia.' });
    }
    var nome = limpar(corpo.nome);
    var dirigente = limpar(corpo.dirigente);
    if (!nome && !dirigente) return json({ ok:false, erro:'Diga ao menos o nome do espaço.' });

    var tel = String(corpo.telefone || '').replace(/\D/g, '');
    if (tel.length < 10) return json({ ok:false, erro:'Informe um telefone com DDD.' });

    if (excedeuLimite()) {
      return json({ ok:false, erro:'Muitos cadastros ao mesmo tempo. Tente de novo em um minuto.' });
    }

    var planilha = abrirPlanilha();
    if (!planilha) return json({ ok:false, erro:'Planilha não configurada no script.' });
    var aba = planilha.getSheets()[0];

    // Trava para dois envios simultâneos não escreverem na mesma linha.
    var trava = LockService.getScriptLock();
    if (!trava.tryLock(20000)) return json({ ok:false, erro:'Servidor ocupado. Tente de novo.' });
    try {
      var cabecalho = aba.getRange(1, 1, 1, Math.max(aba.getLastColumn(), 1)).getValues()[0];
      var colunas = mapear(aba, cabecalho);

      if (jaExiste(aba, colunas, nome, tel)) {
        return json({ ok:false, erro:'Este espaço já está cadastrado. Para corrigir alguma informação, fale com a gente.' });
      }

      var linha = [];
      for (var i = 0; i < cabecalho.length; i++) linha.push('');
      linha[0] = carimbo();                     // a primeira coluna é sempre o carimbo do Forms

      for (var k in colunas) {
        var col = colunas[k];
        if (col === 0) continue;                // não sobrescreve o carimbo
        var valor = k === 'autorizacao' ? TEXTO_AUTORIZACAO : limpar(corpo[k]);
        while (linha.length <= col) linha.push('');
        linha[col] = valor;
      }

      // A chave nasce junto com a linha: é o que permitirá ao responsável
      // cuidar do próprio cadastro depois.
      var chave = novaChave();
      linha[colunaControle(aba, cabecalho, COL_CHAVE)] = chave;

      aba.appendRow(linha);
      return json({ ok:true, nome: nome || dirigente });
    } finally {
      trava.releaseLock();
    }
  } catch (err) {
    return json({ ok:false, erro: 'Erro no servidor: ' + err });
  }
}

/** Só para conferir, pelo navegador, se a implantação está de pé. */
function doGet() {
  return json({ ok:true, servico:'cadastro do Guia Espiritual', planilha: !!abrirPlanilha() });
}

/* ══════════ O responsável cuidando do próprio cadastro ══════════ */

/**
 * Acha a linha pela chave. Toda ação do responsável passa por aqui, e é o
 * único jeito de chegar a uma linha sem ser dona da planilha.
 */
function acharPelaChave(chave) {
  chave = String(chave || '').trim();
  if (chave.length < 20) return null;              // chave curta demais nem é procurada
  var planilha = abrirPlanilha();
  if (!planilha) return null;
  var aba = planilha.getSheets()[0];
  if (aba.getLastRow() < 2) return null;

  var cabecalho = aba.getRange(1, 1, 1, Math.max(aba.getLastColumn(), 1)).getValues()[0];
  var colChave = acharColuna(cabecalho, COL_CHAVE);
  if (colChave === -1) return null;

  var valores = aba.getRange(2, 1, aba.getLastRow() - 1, aba.getLastColumn()).getValues();
  for (var i = 0; i < valores.length; i++) {
    if (String(valores[i][colChave] || '').trim() === chave) {
      return { aba: aba, cabecalho: cabecalho, linha: i + 2, valores: valores[i],
               colunas: mapear(aba, cabecalho) };
    }
  }
  return null;
}

/** Devolve o cadastro para a página do responsável preencher a tela. */
function lerCadastro(corpo) {
  var alvo = acharPelaChave(corpo.chave);
  if (!alvo) return json({ ok:false, erro:'Este link não vale mais. Peça outro para quem mantém o guia.' });

  var colRem = acharColuna(alvo.cabecalho, COL_REMOVIDO);
  if (colRem !== -1 && /^sim$/i.test(String(alvo.valores[colRem] || '').trim())) {
    return json({ ok:false, removido:true, erro:'Este espaço já saiu do guia.' });
  }

  var dados = {};
  for (var k in alvo.colunas) {
    if (k === 'autorizacao') continue;             // não é para editar; já foi dada
    dados[k] = String(alvo.valores[alvo.colunas[k]] || '');
  }
  var colVer = acharColuna(alvo.cabecalho, 'Verificado');
  dados.confirmado = colVer !== -1 &&
    /^(sim|s|x|ok|1|true|verdadeiro|confirmado|verificado)$/i.test(String(alvo.valores[colVer] || '').trim());
  return json({ ok:true, dados: dados });
}

/**
 * Grava as correções. Confirmar junto é proposital: quem acabou de rever cada
 * campo é justamente quem pode dizer que estão certos — é o que o selo promete.
 */
function salvarCadastro(corpo) {
  var alvo = acharPelaChave(corpo.chave);
  if (!alvo) return json({ ok:false, erro:'Este link não vale mais.' });

  var dados = corpo.dados || {};
  var tel = String(dados.telefone || '').replace(/\D/g, '');
  if (!limpar(dados.nome) && !limpar(dados.dirigente)) return json({ ok:false, erro:'O nome não pode ficar vazio.' });
  if (tel.length < 10) return json({ ok:false, erro:'Informe um telefone com DDD.' });

  var trava = LockService.getScriptLock();
  if (!trava.tryLock(20000)) return json({ ok:false, erro:'Servidor ocupado. Tente de novo.' });
  try {
    for (var k in alvo.colunas) {
      if (k === 'autorizacao') continue;
      if (!(k in dados)) continue;
      alvo.aba.getRange(alvo.linha, alvo.colunas[k] + 1).setValue(limpar(dados[k]));
    }
    marcarConfirmado(alvo, 'sim');
    return json({ ok:true });
  } finally {
    trava.releaseLock();
  }
}

/** Só acende o selo, sem mexer em mais nada. */
function confirmarCadastro(corpo) {
  var alvo = acharPelaChave(corpo.chave);
  if (!alvo) return json({ ok:false, erro:'Este link não vale mais.' });
  marcarConfirmado(alvo, 'sim');
  return json({ ok:true });
}

/**
 * Tira do guia sem apagar a linha: a resposta original continua registrada,
 * inclusive a autorização que um dia foi dada, mas a sincronização deixa de
 * publicá-la. Apagar seria perder a prova de que o cadastro existiu.
 */
function removerCadastro(corpo) {
  var alvo = acharPelaChave(corpo.chave);
  if (!alvo) return json({ ok:false, erro:'Este link não vale mais.' });
  var col = colunaControle(alvo.aba, alvo.cabecalho, COL_REMOVIDO);
  alvo.aba.getRange(alvo.linha, col + 1).setValue('sim');
  marcarConfirmado(alvo, '');
  return json({ ok:true });
}

function marcarConfirmado(alvo, valor) {
  var col = colunaControle(alvo.aba, alvo.cabecalho, 'Verificado');
  alvo.aba.getRange(alvo.linha, col + 1).setValue(valor);
}

/* ══════════ Chaves ══════════ */

/**
 * Dá chave a quem ainda não tem. Rode uma vez, pelo editor, para os cadastros
 * que já existiam antes desta página — os novos já nascem com a sua.
 */
function gerarChaves() {
  var aba = abrirPlanilha().getSheets()[0];
  var ultima = aba.getLastRow();
  if (ultima < 2) return;
  var cabecalho = aba.getRange(1, 1, 1, Math.max(aba.getLastColumn(), 1)).getValues()[0];
  var col = colunaControle(aba, cabecalho, COL_CHAVE);
  var valores = aba.getRange(2, col + 1, ultima - 1, 1).getValues();
  var novas = 0;
  for (var i = 0; i < valores.length; i++) {
    if (String(valores[i][0] || '').trim()) continue;
    aba.getRange(i + 2, col + 1).setValue(novaChave());
    novas++;
  }
  Logger.log(novas + ' chave(s) gerada(s).');
}

/**
 * Troca TODAS as chaves, inclusive as que já existem. Serve para quando a
 * coluna vazou — uma cópia da planilha que saiu da sua mão, um print, um PDF.
 *
 * O preço: todo link /meu/ já enviado para de funcionar, e é preciso mandar
 * os novos. Por isso só use quando houver motivo; para o dia a dia, gerarChaves
 * basta, porque ele não mexe em quem já tem.
 */
function trocarChaves() {
  var aba = abrirPlanilha().getSheets()[0];
  var ultima = aba.getLastRow();
  if (ultima < 2) { Logger.log('Planilha sem cadastros.'); return; }
  var cabecalho = aba.getRange(1, 1, 1, Math.max(aba.getLastColumn(), 1)).getValues()[0];
  var col = colunaControle(aba, cabecalho, COL_CHAVE);
  var trocadas = 0;
  for (var i = 2; i <= ultima; i++) {
    aba.getRange(i, col + 1).setValue(novaChave());
    trocadas++;
  }
  Logger.log(trocadas + ' chave(s) trocada(s). Os links antigos morreram.');
}

/** Aleatória e longa o bastante para não se adivinhar por tentativa. */
function novaChave() {
  var letras = 'abcdefghijkmnopqrstuvwxyz23456789';   // sem l/1/0/o, que se confundem
  var s = '';
  for (var i = 0; i < 28; i++) s += letras.charAt(Math.floor(Math.random() * letras.length));
  return s;
}

/** Coluna de controle: acha, ou cria à direita de tudo. */
function colunaControle(aba, cabecalho, rotulo) {
  var i = acharColuna(cabecalho, rotulo);
  if (i !== -1) return i;
  i = cabecalho.length;
  aba.getRange(1, i + 1).setValue(rotulo);
  cabecalho.push(rotulo);
  return i;
}

function acharColuna(cabecalho, rotulo) {
  var alvo = normalizar(rotulo);
  for (var i = 0; i < cabecalho.length; i++) if (normalizar(cabecalho[i]) === alvo) return i;
  return -1;
}

/* ───────────────────────────────────────────────────────────── */

function abrirPlanilha() {
  var v = String(PLANILHA || '').trim();
  if (v) {
    var m = /\/d\/([a-zA-Z0-9_-]+)/.exec(v);
    return SpreadsheetApp.openById(m ? m[1] : v);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/** Descobre a coluna de cada campo; cria a que faltar, à direita de tudo. */
function mapear(aba, cabecalho) {
  var mapa = {};
  var usadas = {};
  for (var c = 0; c < CAMPOS.length; c++) {
    var campo = CAMPOS[c];
    var achou = -1;
    for (var i = 0; i < cabecalho.length && achou === -1; i++) {
      if (usadas[i]) continue;
      var h = normalizar(cabecalho[i]);
      if (!h) continue;
      for (var a = 0; a < campo.apelidos.length; a++) {
        if (h.indexOf(campo.apelidos[a]) !== -1) { achou = i; break; }
      }
    }
    if (achou === -1) {
      achou = cabecalho.length;
      aba.getRange(1, achou + 1).setValue(campo.rotulo);
      cabecalho.push(campo.rotulo);
    }
    usadas[achou] = true;
    mapa[campo.chave] = achou;
  }
  return mapa;
}

/** Mesmo par que a sincronização usa para desduplicar: nome + fim do telefone. */
function jaExiste(aba, colunas, nome, tel) {
  var ultima = aba.getLastRow();
  if (ultima < 2) return false;
  var alvoNome = normalizar(nome);
  var alvoTel = tel.slice(-8);
  var dados = aba.getRange(2, 1, ultima - 1, aba.getLastColumn()).getValues();
  for (var i = 0; i < dados.length; i++) {
    var n = normalizar(dados[i][colunas.nome]);
    var t = String(dados[i][colunas.telefone] || '').replace(/\D/g, '').slice(-8);
    if (alvoNome && n === alvoNome && alvoTel && t === alvoTel) return true;
  }
  return false;
}

/** Freio contra enxurrada. Não distingue pessoas — conta o total no minuto. */
function excedeuLimite() {
  var cache = CacheService.getScriptCache();
  var chave = 'cadastros-' + Math.floor(Date.now() / 60000);
  var n = Number(cache.get(chave) || 0) + 1;
  cache.put(chave, String(n), 120);
  return n > LIMITE_POR_MINUTO;
}

/** Mesmo formato do carimbo do Forms, para a sincronização ler igual. */
function carimbo() {
  return Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss');
}

function limpar(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 600);
}

function normalizar(v) {
  return String(v == null ? '' : v)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
