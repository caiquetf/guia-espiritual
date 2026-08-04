/**
 * Recebe cadastros feitos no próprio site e grava na planilha de respostas.
 *
 * É o que substitui o Google Forms: o formulário passa a viver em /cadastrar/,
 * com a cara do guia, e a planilha continua sendo o coração de tudo — a
 * sincronização horária não muda em nada.
 *
 * Este arquivo é irmão do verificar.gs, mas NÃO pode morar na mesma implantação:
 * aquele é publicado como "somente eu", porque só a dona da planilha acende
 * selos; este precisa ser "qualquer pessoa", porque quem envia é o visitante.
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
 *  7. Me mande essa URL, ou cole você mesmo em API_CADASTRO, no topo do
 *     script de cadastrar/index.html.
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
