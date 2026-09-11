/**
 * O script do dono: acender o selo e montar a mensagem de aviso.
 *
 * Duas coisas aqui não podem falhar de jeito nenhum: acender selo que ninguém
 * pediu, e entregar a chave de um espaço ao telefone de outro.
 */
import { ok, secao, carregarScript, CABECALHO } from './ajuda.mjs';

const CAB = [...CABECALHO, 'Chave'];
const CHAVE = 'p4k9m2xr7t3vq8ws5nz6ay2j4hbd';
const linha = (nome, tel, chave = CHAVE) => {
  const l = new Array(CAB.length).fill('');
  l[0] = '30/07/2026 10:00:00';
  l[CAB.indexOf('NOME DO ESPAÇO ESPIRITUAL')] = nome;
  l[CAB.indexOf("TELEFONE / WHAT'S APP")] = tel;
  l[CAB.indexOf('Chave')] = chave;
  return l;
};
const abrir = linhas => carregarScript('verificar.gs', linhas);

secao('acender e apagar o selo');
{
  const s = abrir([CAB, linha('Casa Um', '19998290709')]);
  s.get({ nome:'Casa Um', tel:'19998290709', valor:'sim' });
  ok('marca como confirmado', s.L[1][s.coluna('Verificado')] === 'sim');
  s.get({ nome:'Casa Um', tel:'19998290709', valor:'nao' });
  ok('e tira o selo quando pedido', s.L[1][s.coluna('Verificado')] === '');
}
{
  const s = abrir([CAB, linha('Casa Um', '19998290709')]);
  const html = s.get({ nome:'Casa Um', tel:'19998290709' });          // sem valor
  ok('pedido sem valor não acende selo nenhum', !s.escritas.some(e => e.linha > 1));
  ok('e explica que a versão do script está velha', /pedido desconhecido/i.test(html.normalize('NFC')));
}
{
  const s = abrir([CAB, linha('Casa Um', '19998290709')]);
  s.get({ acao:'avisar', nome:'Casa Um', tel:'19998290709' });
  ok('ação nova em script velho também não acende selo', !s.escritas.some(e => e.linha > 1));
}
{
  const s = abrir([CAB, linha('Casa Um', '19998290709'), linha('Casa Dois', '19998290709', 'outra')]);
  const html = s.get({ nome:'Casa Um', tel:'19998290709', valor:'sim' });
  ok('dois iguais: não escolhe no chute', !s.escritas.some(e => e.linha > 1));
  ok('e diz por quê', /linhas iguais/i.test(html.normalize('NFC')));
}

{
  const s = abrir([CAB, linha('Casa Um', '19998290709')]);
  s.get({ nome:'Casa Um', tel:'19998290709', valor:'sim' });
  ok('o painel do dono também anota a data',
     /^\d{2}\/\d{2}\/\d{4}/.test(s.L[1][s.coluna('Confirmado em')] || ''));
  s.get({ nome:'Casa Um', tel:'19998290709', valor:'nao' });
  ok('e apaga a data ao tirar o selo', s.L[1][s.coluna('Confirmado em')] === '');
}

secao('a mensagem que leva o link privado');
{
  const s = abrir([CAB, linha('Casa Um', '19998290709')]);
  const html = s.get({ acao:'avisar', site:'https://exemplo.org/guia', nome:'Casa Um', tel:'19998290709' })
    .normalize('NFC');
  ok('monta o link privado', html.includes('/meu/?c=' + CHAVE));
  ok('nomeia o espaço', html.includes('Casa Um'));
  ok('abre o WhatsApp do número certo', /wa\.me\/5519998290709\?text=/.test(html));
  ok('pede a conferência', /confira se os dados estão certos/i.test(html));
  ok('mostra o botão de corrigir pelo nome que está na tela', /Editar informações/.test(html));
  ok('e o de confirmar', /Está tudo certo/.test(html));
  ok('avisa para não repassar', /não repasse este link/i.test(html));
  ok('e não escreve nada na planilha', s.escritas.length === 0);
}
{
  // Dois telefones que terminam igual: a comparação é pelos últimos 8 dígitos.
  const s = abrir([CAB, linha('Casa Um', '1998290709'), linha('Casa Dois', '19998290709', 'segredo2')]);
  const html = s.get({ acao:'avisar', site:'https://exemplo.org', nome:'Casa Dois', tel:'19998290709' })
    .normalize('NFC');
  ok('telefone ambíguo não entrega chave nenhuma', !html.includes(CHAVE) && !html.includes('segredo2'));
  ok('e explica onde pegar o link na mão', /coluna Chave/i.test(html));
}
{
  const s = abrir([CABECALHO, linha('Casa Um', '19998290709').slice(0, CABECALHO.length)]);
  ok('sem a coluna Chave, ensina o que rodar',
     /gerarChaves/.test(s.get({ acao:'avisar', nome:'Casa Um', tel:'19998290709' })));
}
{
  const s = abrir([CAB, linha('Casa Um', '19998290709')]);
  ok('cadastro que não existe não vaza chave de ninguém',
     !s.get({ acao:'avisar', nome:'Fantasma', tel:'11911111111' }).includes(CHAVE));
}

secao('autoteste do endereço');
{
  const s = abrir([CAB, linha('Casa Um', '19998290709')]);
  const html = s.get({ acao:'quemsou' }).normalize('NFC');
  ok('sabe dizer que é o painel do dono', /painel do dono/i.test(html));
  ok('sem escrever nada', s.escritas.length === 0);
}
{
  const s = abrir([CAB, linha('Casa Um', '19998290709')]);
  const html = s.get({ nome:'Casa Um', tel:'19998290709', valor:'sim' });
  ok('a resposta só fala com o endereço do site', html.includes('https://caiquetf.github.io'));
  ok('e não grita para qualquer um', !html.includes('"*"'));
}
