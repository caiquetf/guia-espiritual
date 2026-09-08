/**
 * O que sai da planilha e vira site: a sincronização e o gerador de páginas.
 *
 * Roda numa pasta temporária, servindo o CSV por HTTP — é como o robô do
 * GitHub faz, e o fetch do Node não abre arquivo local.
 */
import { ok, secao, RAIZ } from './ajuda.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

// Assíncrono de propósito: o servidor do CSV mora neste mesmo processo, e uma
// chamada bloqueante o impediria de responder — o teste travaria para sempre.
const rodar = promisify(execFile);
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pasta = mkdtempSync(join(tmpdir(), 'guia-'));
const servidor = createServer((req, res) => {
  const arquivo = join(pasta, req.url.split('?')[0]);
  if (!existsSync(arquivo)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type':'text/csv; charset=utf-8' });
  res.end(readFileSync(arquivo));
});
await new Promise(r => servidor.listen(0, '127.0.0.1', r));
const CSV = `http://127.0.0.1:${servidor.address().port}/planilha.csv`;

const cabecalho = 'Carimbo de data/hora,NOME DO ESPAÇO ESPIRITUAL,QUAL O NOME DO DIRIGENTE?,'
  + 'QUAL A VERTENTE ESPIRITUAL?,QUAL A CIDADE?,ENDEREÇO COMPLETO,"TELEFONE / WHAT\'S APP",'
  + 'Endereço de e-mail,AUTORIZAÇÃO DE DIVULGAÇÃO\n';
const escrever = linhas => writeFileSync(join(pasta, 'planilha.csv'), cabecalho + linhas.join('\n') + '\n');
const sincronizar = async () => (await rodar('node', [join(RAIZ, 'scripts/atualizar-dados.mjs')],
  { cwd: pasta, env: { ...process.env, PLANILHA_CSV_URL: CSV, NO_PROXY:'127.0.0.1,localhost', no_proxy:'127.0.0.1,localhost' } })).stdout;
const gerar = () => rodar('node', [join(RAIZ, 'scripts/gerar-paginas.mjs')], { cwd: pasta });
const dados = () => JSON.parse(readFileSync(join(pasta, 'dados.json'), 'utf8'));
const paginas = () => readdirSync(join(pasta, 'espaco')).sort();

const casa = (nome, tel, cidade = 'Piracicaba', quando = '01/08/2026 10:00:00', dirigente = 'Pai Zé') =>
  `${quando},${nome},${dirigente},Umbanda,${cidade},"Rua A, 10",${tel},alguem@exemplo.com,Autorizo a divulgação`;

secao('da planilha para o dados.json');
escrever([casa('Casa Um', '19999990001')]);
await sincronizar();
{
  const d = dados();
  ok('publica o cadastro', d.registros.length === 1 && d.registros[0].nome === 'Casa Um');
  ok('sem o e-mail, como os formulários prometem', !('email' in d.registros[0]));
}
{
  const antes = dados().geradoEm;
  await sincronizar();
  ok('rodar de novo sem mudança não mexe na data', dados().geradoEm === antes);
  escrever([casa('Casa Dois', '19999990001')]);
  await sincronizar();
  ok('e mudando o conteúdo, a data muda', dados().geradoEm !== antes);
}
{
  escrever([casa('Casa Um', '19999990001', 'Piracicaba'),
            casa('Casa Dois', '19999990002', 'Piracicaba-SP'),
            casa('Casa Três', '19999990003', 'piracicaba / sp')]);
  await sincronizar();
  const cidades = new Set(dados().registros.map(r => r.cidade));
  ok('a mesma cidade escrita de três jeitos vira uma só',
     cidades.size === 1 && cidades.has('Piracicaba'));
}
{
  // Quem responde só o nome do pai ou da mãe de santo — comum, quando a casa é
  // conhecida assim. Antes os dois caíam na mesma chave vazia e um sumia.
  escrever([casa('', '', 'Piracicaba', '01/08/2026 10:00:00', 'Pai Joaquim'),
            casa('', '', 'Piracicaba', '01/08/2026 10:00:01', 'Mãe Aparecida')]);
  await sincronizar();
  const nomes = dados().registros.map(r => r.dirigente).sort();
  ok('dois cadastros só com dirigente não se anulam',
     nomes.length === 2 && nomes[0] === 'Mãe Aparecida' && nomes[1] === 'Pai Joaquim');
}
{
  escrever([casa('Casa Sem Autorização', '19999990001').replace('Autorizo a divulgação', 'Não')]);
  let recusou = false;
  try { await sincronizar(); } catch { recusou = true; }
  ok('quem não autorizou não é publicado', recusou || dados().registros.length === 0);
}

secao('das páginas geradas');
escrever([casa('Casa Um', '19999991111')]);
await sincronizar(); await gerar();
ok('gera uma página por cadastro', paginas().length === 1);
{
  const html = readFileSync(join(pasta, 'espaco', paginas()[0], 'index.html'), 'utf8');
  ok('com botão para o mapa, porque há endereço com número', html.includes('Abrir no mapa'));
  ok('e o e-mail não aparece nela', !html.includes('alguem@exemplo.com'));
}
{
  escrever([casa('Casa Um', '19999992222')]);        // telefone corrigido
  await sincronizar(); await gerar();
  ok('o endereço novo existe', paginas().includes('casa-um-2222'));
  ok('e o antigo continua de pé', paginas().includes('casa-um-1111'));
  const velho = readFileSync(join(pasta, 'espaco', 'casa-um-1111', 'index.html'), 'utf8');
  ok('encaminhando para o novo', velho.includes('casa-um-2222'));
  ok('sem entrar no índice dos buscadores', /noindex/.test(velho));
  ok('nem no sitemap', !readFileSync(join(pasta, 'sitemap.xml'), 'utf8').includes('casa-um-1111'));
}
{
  escrever([casa('Casa Xis</script><script>alert(1)</script>', '19999993333')]);
  await sincronizar(); await gerar();
  const html = readFileSync(join(pasta, 'espaco', paginas().find(p => p.startsWith('casa-xis')), 'index.html'), 'utf8');
  ok('cadastro não consegue fechar a tag de script', !html.includes('</script><script>alert'));
  ok('o "<" dele vira \\u003c dentro do JSON', html.includes('\\u003c/script'));
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  ok('e o JSON-LD continua válido', (() => { try { JSON.parse(ld[1]); return true; } catch { return false; } })());
}

servidor.close();
rmSync(pasta, { recursive:true, force:true });
