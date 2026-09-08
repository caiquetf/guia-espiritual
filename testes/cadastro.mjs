/**
 * O script público: cadastrar-se e cuidar do próprio cadastro.
 *
 * O que se protege aqui é o que dói quando quebra — cadastro perdido, chave
 * fraca, promessa desmentida.
 */
import { ok, secao, carregarScript, CABECALHO as CAB } from './ajuda.mjs';

const BASE = { nome:'Terreiro de Teste', dirigente:'Pai Zé', tradicao:'Umbanda', cidade:'Piracicaba',
  bairro:'Centro', endereco:'Rua A, 10', modalidade:'Presencial', telefone:'(19) 99999-1234',
  redes:'@teste', horarios:'Sábados 20h', servicos:'Consultas', regras:'Traje branco',
  tempo:'10 anos', email:'a@b.c', website:'', autorizacao:true };

const novo = () => carregarScript('publico.gs', [CAB]);

secao('cadastro pelo site');
{
  const s = novo();
  const r = s.post(BASE);
  ok('aceita um cadastro completo', r.ok === true);
  ok('grava uma linha só', s.L.length === 2);
  ok('o nome vai para a coluna certa', s.L[1][s.coluna('NOME DO ESPAÇO ESPIRITUAL')] === 'Terreiro de Teste');
  ok('a autorização é gravada com a palavra que a sincronização exige',
     /\bautorizo\b/i.test(s.L[1][s.coluna('AUTORIZAÇÃO DE DIVULGAÇÃO')]));
  ok('e a coluna que faltava é criada, em vez de o dado se perder',
     s.L[0].includes('BAIRRO') && s.L[1][s.coluna('BAIRRO')] === 'Centro');
}
{
  const s = novo();
  ok('recusa sem autorização', s.post({ ...BASE, autorizacao:false }).ok === false && s.L.length === 1);
}
{
  const s = novo();
  ok('recusa telefone sem DDD', s.post({ ...BASE, telefone:'1234' }).ok === false && s.L.length === 1);
}
{
  const s = novo();
  const r = s.post({ ...BASE, website:'http://spam' });
  ok('robô que cai na armadilha não grava nada', s.L.length === 1);
  ok('e não descobre que caiu', r.ok === true);
}
{
  const s = novo();
  s.post(BASE);
  ok('recusa o mesmo espaço duas vezes', s.post(BASE).ok === false);
  ok('mas aceita outro espaço no mesmo telefone', s.post({ ...BASE, nome:'Outra Casa' }).ok === true);
}

secao('a chave, que é a única credencial que existe');
{
  const s = novo();
  s.post(BASE);
  const chave = s.L[1][s.coluna('Chave')];
  ok('cadastro novo nasce com chave', typeof chave === 'string' && chave.length === 28);
  ok('sem letras que se confundem ao ditar', /^[abcdefghijkmnopqrstuvwxyz23456789]+$/.test(chave));
  const usouRandom = [];
  const rnd = Math.random;
  Math.random = () => { usouRandom.push(1); return rnd(); };
  s.ctx.novaChave();
  Math.random = rnd;
  ok('não sai do Math.random, que é previsível', usouRandom.length === 0);
  const muitas = new Set();
  for (let i = 0; i < 300; i++) muitas.add(s.ctx.novaChave());
  ok('300 chaves seguidas, nenhuma repetida', muitas.size === 300);
  ok('a chave abre o cadastro dela', s.post({ acao:'ler', chave }).dados.nome === 'Terreiro de Teste');
  ok('e chave inventada não abre nada', s.post({ acao:'ler', chave:'z'.repeat(28) }).ok === false);
}

secao('o responsável cuidando do próprio cadastro');
{
  const s = novo();
  s.post({ ...BASE, horarios:'Segunda 20h\nQuarta 19h30' });
  const chave = s.L[1][s.coluna('Chave')];
  const cH = s.coluna('QUAIS DIAS E HORÁRIOS ACONTECEM OS TRABALHOS?');
  ok('a quebra de linha sobrevive ao cadastro', s.L[1][cH] === 'Segunda 20h\nQuarta 19h30');
  s.post({ acao:'salvar', chave, dados:{ ...BASE, horarios:'Segunda 20h\nQuarta 19h30\n\n\nSábado 15h' } });
  ok('e sobrevive ao salvar', s.L[1][cH] === 'Segunda 20h\nQuarta 19h30\n\nSábado 15h');
  ok('mas campo curto continua numa linha só',
     (s.post({ acao:'salvar', chave, dados:{ ...BASE, nome:'Casa\ncom\nquebras' } }),
      s.L[1][s.coluna('NOME DO ESPAÇO ESPIRITUAL')] === 'Casa com quebras'));
  ok('salvar acende o selo, porque quem reviu foi o responsável',
     /^sim$/i.test(s.L[1][s.coluna('Verificado')] || ''));
}
{
  const s = novo();
  s.post(BASE);
  const chave = s.L[1][s.coluna('Chave')];
  ok('confirmar acende o selo', s.post({ acao:'confirmar', chave }).ok === true
     && /^sim$/i.test(s.L[1][s.coluna('Verificado')]));
  ok('sair marca a linha, sem apagá-la',
     s.post({ acao:'remover', chave }).ok === true && s.L.length === 2);
  ok('quem saiu não é mais lido', s.post({ acao:'ler', chave }).removido === true);
  ok('e pode voltar, como a página promete', s.post(BASE).ok === true);
}
{
  const s = novo();
  s.post(BASE);
  const chave = s.L[1][s.coluna('Chave')];
  let barrou = 0;
  for (let i = 0; i < 25; i++) if (!s.post({ acao:'ler', chave }).ok) barrou++;
  ok('martelar a mesma chave acaba barrado', barrou > 0);
}
{
  const s = novo();
  s.post(BASE);
  const chave = s.L[1][s.coluna('Chave')];
  for (let i = 0; i < 10; i++) s.post({ acao:'ler', chave });
  ok('uso normal não esbarra no freio', s.post({ acao:'ler', chave }).ok === true);
}
{
  const s = novo();
  s.post(BASE);
  const chave = s.L[1][s.coluna('Chave')];
  for (let i = 0; i < 70; i++) s.post({ acao:'ler', chave:'z'.repeat(20) + i });
  ok('varrer chaves no escuro fecha a porta', s.post({ acao:'ler', chave }).ok === false);
}

secao('autoteste do endereço');
{
  const s = novo();
  const r = s.post({ acao:'quemsou' });
  ok('sabe dizer que é o cadastro', r.ok === true && r.servico === 'cadastro');
  ok('e que alcança a planilha', r.planilha === true);
  ok('sem escrever nada', s.L.length === 1);
}
