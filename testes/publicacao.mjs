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

secao('as duas cópias do leitor de planilha');
{
  // index.html precisa abrir sozinho, sem servidor e sem import, então carrega
  // a própria cópia das regras. Duas cópias divergem com o tempo — e já
  // divergiram: o navegador perdia a coluna Serviços da planilha de verdade.
  const campos = txt => {
    const i = txt.indexOf('const FIELDS = [');
    const bloco = txt.slice(i, txt.indexOf('];', i));
    const saida = {};
    for (const m of bloco.matchAll(/key:'(\w+)'[\s\S]*?aliases:\[(.*?)\]/g))
      saida[m[1]] = m[2].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean).sort();
    return saida;
  };
  const A = campos(readFileSync(join(RAIZ, 'index.html'), 'utf8'));
  const B = campos(readFileSync(join(RAIZ, 'scripts/atualizar-dados.mjs'), 'utf8'));
  ok('conhecem os mesmos campos',
     JSON.stringify(Object.keys(A).sort()) === JSON.stringify(Object.keys(B).sort()));
  const diferentes = Object.keys(B).filter(k => JSON.stringify(A[k]) !== JSON.stringify(B[k]));
  ok('e os mesmos apelidos de coluna', diferentes.length === 0);
  for (const k of diferentes) console.log('        divergem em ' + k);

  const vertentes = txt => {
    const i = txt.indexOf('const VERTENTES = [');
    return txt.slice(i, txt.indexOf('];', i)).replace(/\s+/g, ' ');
  };
  ok('e as mesmas regras de vertente',
     vertentes(readFileSync(join(RAIZ, 'index.html'), 'utf8'))
     === vertentes(readFileSync(join(RAIZ, 'scripts/atualizar-dados.mjs'), 'utf8')));
}

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

secao('vertentes: um espaço pode ser de mais de uma');
{
  escrever([
    casa('Casa A', '19999990001').replace(',Umbanda,', ',Quimbanda/Umbanda,'),
    casa('Casa B', '19999990002').replace(',Umbanda,', ',Umbanda e também kardecismo,'),
    casa('Casa C', '19999990003').replace(',Umbanda,', ',Luciferiana,')
  ]);
  await sincronizar();
  const porNome = Object.fromEntries(dados().registros.map(r => [r.nome, r.grupos]));
  ok('quem escreveu duas vertentes fica nas duas',
     JSON.stringify(porNome['Casa A']) === JSON.stringify(['Umbanda','Quimbanda']));
  ok('inclusive quando escreveu por extenso',
     JSON.stringify(porNome['Casa B']) === JSON.stringify(['Umbanda','Espiritismo/Kardecismo']));
  ok('e o que não casa com nada continua em Outros',
     JSON.stringify(porNome['Casa C']) === JSON.stringify(['Outros']));
  ok('a primeira continua sendo a principal, que dá a cor',
     dados().registros.every(r => r.grupo === r.grupos[0]));
}

secao('página por vertente, para quem busca no Google');
{
  escrever([casa('Casa A', '19999990001').replace(',Umbanda,', ',Quimbanda/Umbanda,'),
            casa('Casa B', '19999990002')]);
  await sincronizar(); await gerar();
  const feitas = readdirSync(join(pasta, 'vertente')).sort();
  ok('gera uma pasta por vertente', feitas.includes('umbanda') && feitas.includes('quimbanda'));
  const umbanda = readFileSync(join(pasta, 'vertente', 'umbanda', 'index.html'), 'utf8');
  ok('lista os dois espaços de Umbanda', (umbanda.match(/<li>/g) || []).length === 2);
  const quimbanda = readFileSync(join(pasta, 'vertente', 'quimbanda', 'index.html'), 'utf8');
  ok('e o de vertente dupla aparece também na outra lista', quimbanda.includes('Casa A'));
  ok('o título fala como as pessoas procuram', /Terreiros de Umbanda em/.test(umbanda));
  ok('leva ao guia já filtrado', umbanda.includes('?vertente=umbanda'));
  ok('e aponta as outras vertentes, para não ser um beco', /Outras vertentes/.test(umbanda));
  ok('entra no sitemap', readFileSync(join(pasta, 'sitemap.xml'), 'utf8').includes('/vertente/umbanda/'));
  ok('"Outros" não vira página', !feitas.includes('outros'));
  // O robô da sincronização só comita a lista de arquivos que estiver no
  // workflow. Uma pasta gerada e não listada some do site sem ninguém notar.
  const fluxo = readFileSync(join(RAIZ, '.github/workflows/sincronizar-planilha.yml'), 'utf8');
  for (const pasta of ['dados.json','espaco','espaco-apelidos.json','vertente','sitemap.xml','robots.txt'])
    ok(`a sincronização publica "${pasta}"`, new RegExp('git add [^\n]*\\b' + pasta.replace('.','\\.') + '\\b').test(fluxo));
  const espaco = readFileSync(join(pasta, 'espaco', 'casa-a-0001', 'index.html'), 'utf8');
  ok('a página do espaço leva às vertentes dele',
     espaco.includes('vertente/umbanda/') && espaco.includes('vertente/quimbanda/'));
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
