/**
 * As páginas no navegador de verdade.
 *
 * Precisa do playwright instalado (npm i -D playwright). Sem ele, o executor
 * pula este arquivo — os outros continuam rodando em qualquer lugar.
 */
import { ok, secao, RAIZ } from './ajuda.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { console.log('  (playwright não instalado — testes de navegador pulados)'); process.exit(0); }

const CAMINHO_CHROME = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome']
  .find(p => existsSync(p));

const TIPOS = { '.html':'text/html', '.json':'application/json', '.css':'text/css',
  '.js':'text/javascript', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg',
  '.txt':'text/plain', '.xml':'application/xml', '.webmanifest':'application/manifest+json' };

const servidor = createServer((req, res) => {
  let caminho = join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  if (existsSync(caminho) && statSync(caminho).isDirectory()) caminho = join(caminho, 'index.html');
  if (!existsSync(caminho)) { res.writeHead(404); return res.end('não encontrado'); }
  res.writeHead(200, { 'Content-Type': (TIPOS[extname(caminho)] || 'application/octet-stream') + '; charset=utf-8' });
  res.end(readFileSync(caminho));
});
await new Promise(r => servidor.listen(0, '127.0.0.1', r));
const B = `http://127.0.0.1:${servidor.address().port}`;
const API = 'https://script.google.com/macros/s/EXEMPLO/exec';

const navegador = await chromium.launch(CAMINHO_CHROME ? { executablePath: CAMINHO_CHROME } : {});
const semRede = p => p.route('https://gc.zgo.at/**', r => r.fulfill({ status:200, body:'' }));

/** Abre uma página do site com o Apps Script trocado por um de mentira. */
async function abrir(caminho, responder){
  const p = await navegador.newPage({ viewport:{ width:420, height:1000 } });
  await semRede(p);
  await p.route(B + caminho + '**', async rota => {
    const r = await rota.fetch();
    const html = (await r.text()).replace(/let API_PUBLICA = '';/, `let API_PUBLICA = '${API}';`);
    await rota.fulfill({ response:r, body:html });
  });
  p.__chamadas = [];
  await p.route(API, async rota => {
    const corpo = JSON.parse(rota.request().postData() || '{}');
    p.__chamadas.push(corpo);
    const resposta = responder(corpo);
    if (resposta === 'cai') return rota.abort('failed');
    await rota.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(resposta) });
  });
  return p;
}

const CHAVE = 'k7m2n8p4q6r3s9t5v7w2x8y4z6a3';
const CADASTRO = { nome:'Terreiro de Teste', dirigente:'Pai Zé', tradicao:'Umbanda',
  cidade:'Piracicaba', bairro:'Centro', endereco:'Rua A, 10', modalidade:'Presencial',
  telefone:'(19) 99999-1234', redes:'@teste', horarios:'Sábados 20h', servicos:'Consultas',
  regras:'Traje branco', tempo:'10 anos', email:'a@b.c', confirmado:false };

secao('a página do responsável');
{
  const p = await abrir('/meu/', c => c.acao === 'ler' ? { ok:true, dados:CADASTRO } : { ok:true });
  await p.goto(B + '/meu/?c=' + CHAVE); await p.waitForTimeout(700);
  ok('abre na ficha, para conferir antes de digitar',
     await p.locator('#ficha').isVisible() && !(await p.locator('#form').isVisible()));
  ok('a chave nunca aparece na tela', !(await p.evaluate(() => document.body.innerText)).includes(CHAVE));
  await p.click('#btnEditar'); await p.waitForTimeout(300);
  ok('o botão de editar abre o formulário preenchido',
     await p.locator('#form input[name=nome]').inputValue() === 'Terreiro de Teste');
  await p.fill('#form input[name=cidade]', 'Errado');
  await p.click('#btnCancelar'); await p.waitForTimeout(300);
  await p.click('#btnEditar'); await p.waitForTimeout(300);
  ok('cancelar joga fora o que foi digitado',
     await p.locator('#form input[name=cidade]').inputValue() === 'Piracicaba');
  await p.close();
}
{
  const p = await abrir('/meu/', () => 'cai');
  await p.goto(B + '/meu/?c=' + CHAVE); await p.waitForTimeout(700);
  const txt = await p.locator('.recado').innerText();
  ok('quando o servidor não responde, não fica muda', /não consegui carregar/i.test(txt));
  ok('e oferece tentar de novo', await p.locator('.recado button').isVisible());
  await p.close();
}
{
  const p = await abrir('/meu/', c => c.acao === 'ler'
    ? { ok:true, dados:{ ...CADASTRO, modalidade:'Presencial e online' } } : { ok:true });
  await p.goto(B + '/meu/?c=' + CHAVE); await p.waitForTimeout(700);
  await p.click('#btnEditar'); await p.waitForTimeout(300);
  ok('modalidade escrita por extenso não é apagada',
     await p.locator('#form select[name=modalidade]').inputValue() === 'Presencial e online');
  await p.close();
}

secao('o cadastro pelo site');
{
  const p = await abrir('/cadastrar/', c => c.acao === 'quemsou'
    ? { ok:true, servico:'cadastro', planilha:true } : { ok:true });
  await p.goto(B + '/cadastrar/'); await p.waitForTimeout(900);
  ok('o formulário aparece quando o endereço se identifica', await p.locator('#form').isVisible());
  ok('e a primeira coisa que a página faz é perguntar quem é',
     p.__chamadas[0] && p.__chamadas[0].acao === 'quemsou');
  await p.close();
}
{
  // O endereço responde, mas é o script errado — foi o que aconteceu de verdade.
  const p = await abrir('/cadastrar/', () => ({ ok:false, erro:'Faltou dizer qual cadastro.' }));
  await p.goto(B + '/cadastrar/'); await p.waitForTimeout(900);
  ok('script errado no endereço: o formulário não é mostrado',
     !(await p.locator('#form').isVisible()));
  await p.close();
}

secao('o guia');
{
  const p = await navegador.newPage({ viewport:{ width:1280, height:900 } });
  await semRede(p);
  await p.goto(B + '/index.html'); await p.waitForTimeout(1500);
  const total = await p.locator('#grid article').count();
  ok('lista os cadastros', total > 0);
  const cidades = await p.evaluate(() =>
    [...document.querySelectorAll('#fCity option')].map(o => o.value).filter(Boolean));
  ok('cada cidade aparece uma vez só no filtro', new Set(cidades).size === cidades.length);
  await p.fill('#q', 'umb');
  await p.click('#btnReset');
  await p.waitForTimeout(500);
  ok('limpar filtros cancela a busca que estava para acontecer',
     await p.locator('#grid article').count() === total && await p.locator('#q').inputValue() === '');
  await p.close();
}

await navegador.close();
servidor.close();
