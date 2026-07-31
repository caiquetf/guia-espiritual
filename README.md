# Guia Espiritual — Piracicaba e Região

Diretório de espaços espirituais, terreiros e oraculistas de Piracicaba e região.
Aplicativo de página única (SPA) em **um único arquivo** — `index.html` — com Tailwind CSS e JavaScript puro.

## Como usar

Abra `index.html` no navegador (duplo clique já basta — não precisa de servidor nem instalação).

## Sincronização automática com o formulário

O site busca os cadastros de `dados.json`, gerado de hora em hora a partir da planilha
de respostas do Google Forms. Para ligar:

1. Na planilha de respostas: **Arquivo → Compartilhar → Publicar na web** →
   escolha a aba de respostas e o formato **CSV** → **Publicar**. Copie a URL gerada.
2. No repositório: **Settings → Secrets and variables → Actions → aba Variables →
   New repository variable**, com nome `PLANILHA_CSV_URL` e a URL como valor.

A partir daí, o fluxo é automático: alguém responde o formulário → em até uma hora o
workflow busca a planilha, regrava `dados.json`, comita a mudança e republica o site.
Sem a variável configurada, a sincronização apenas se registra como pulada e o site
continua servindo o que já estava publicado.

Para rodar na hora, sem esperar o agendamento: aba **Actions** →
**Sincronizar planilha do formulário** → **Run workflow**.

Testando localmente:

```sh
node scripts/atualizar-dados.mjs "https://docs.google.com/.../pub?output=csv"
```

## Importar um CSV manualmente

Com a sincronização ligada isso raramente é necessário, então não há botão para o
recurso — mas ele continua ali: **arraste um arquivo `.csv` para qualquer lugar da
página** e ele é importado. Exportar e baixar modelo foram removidos junto com o menu
**⋯**; a planilha de respostas já cumpre esse papel.

As colunas são reconhecidas automaticamente pelo texto do cabeçalho — mesmo com variações de acento,
maiúsculas ou pequenas diferenças de redação. Também são aceitos separadores `,`, `;` e tabulação.

| # | Coluna do formulário |
|---|---|
| 1 | Carimbo de data/hora |
| 2 | Endereço de e-mail |
| 3 | Nome do Espaço / Nome Profissional |
| 4 | Dirigente / Responsável / Nome de Terreiro |
| 5 | Tradição / Vertente Espiritual |
| 6 | Município / Cidade da Região |
| 7 | Bairro / Localização |
| 8 | Endereço Completo |
| 9 | Modalidade de Atendimento |
| 10 | Telefone / WhatsApp com DDD |
| 11 | Redes Sociais / Instagram / Site |
| 12 | Dias e Horários das Giras, Trabalhos ou Consultas |
| 13 | Serviços Prestados e Trabalhos oferecidos |
| 14 | Orientações ao Visitante / Regras do Espaço |

Na primeira importação os dados de exemplo são substituídos. Nas seguintes, os registros são
mesclados e duplicatas (mesmo nome + mesmo telefone) são ignoradas.

## Funcionalidades

- **Busca global** por nome, dirigente, bairro, cidade, serviços, horários e regras (vários termos, sem acento).
- **Filtros combinados:** cidade, tradição (chips com contagem) e modalidade. Quem atende "Ambas" aparece nos filtros Presencial e Online.
- **Cartões** em grade ou lista, com badge colorido por tradição.
- **🟢 Chamar no WhatsApp** — abre `wa.me/55…` com mensagem inicial pronta.
- **📋 Copiar ficha completa** — texto formatado para colar na conversa com o cliente.
- **Compartilhar** — abre a bandeja do sistema no celular (WhatsApp, Instagram, o que a
  pessoa quiser) e, onde ela não existe, cai no WhatsApp com a ficha pronta. Também nas
  páginas de espaço.
- **Canal de contato** — "Informação errada, ou quer sair do guia?" em cada ficha e em
  cada página de espaço, abrindo o WhatsApp com o nome do cadastro e o endereço dele já
  na mensagem. Serve para corrigir dados e, principalmente, para quem está listado pedir
  a remoção. Definido em `CANAL_CORRECAO`, no topo do script do `index.html` e do
  `scripts/gerar-paginas.mjs` — aceita `https://wa.me/55...`, `mailto:` ou um formulário,
  e some da tela se ficar vazio.
- **🔍 Ver detalhes** — modal com os 14 campos, link para o Google Maps e para as redes sociais.
- **Ordenação** alternável entre por cidade e mais recentes, lendo o carimbo do formulário.
- **Aviso de cadastro antigo** — passados `MESES_PARA_AVISO` (12) desde a resposta, o
  cartão, a ficha e a página do espaço passam a exibir "Informação de <mês> de <ano> —
  confirme antes de ir". Casa muda de endereço e de horário, e o formulário é respondido
  uma vez só.
- **Edição e exclusão** pelo modal de detalhes, valendo só no navegador de quem edita.
- **Instalável**: com o manifesto, o guia ganha ícone na tela inicial e abre sem barra de navegador.
- **Link direto por espaço** — abrir uma ficha grava `?espaco=` no endereço, e o botão
  **Copiar link** entrega esse endereço pronto. Quem abrir o link cai direto na ficha.
  A ficha do WhatsApp já sai com ele no rodapé.
- **Prévia ao compartilhar** — o link mostra logo, título e descrição no WhatsApp e nas
  redes, a partir de `social.jpg` e das tags Open Graph.
- **Uma página por espaço** em `espaco/<apelido>/`, com título, descrição e dados
  estruturados próprios, mais `sitemap.xml` e `robots.txt`. É o que permite ao buscador
  indexar cada casa e ao WhatsApp montar a prévia daquele espaço, não a do site inteiro.
  Geradas por `scripts/gerar-paginas.mjs`, no mesmo workflow que sincroniza a planilha.
- **Compartilhar o guia** — botão no cabeçalho, com a mesma bandeja do sistema.
- **Filtro de confirmados** — aparece só quando existe pelo menos um cadastro com selo.
- Atalhos: `/` foca a busca, `Esc` fecha os modais.

### Exemplo da ficha gerada

```
📍 *Indicação de Espaço Espiritual em Piracicaba:*

*Nome:* Terreiro de Umbanda Pai Joaquim de Angola
*Tradição:* Umbanda
*Responsável:* Mãe Maria de Oxum
*Bairro:* Vila Rezende - Piracicaba/SP
*Modalidade:* Presencial
*Atendimentos/Giras:* Giras abertas aos sábados às 19h30
*Regras/Observações:* Traje branco obrigatório. Colaboração espontânea.
*Contato:* (19) 99812-4477
```

## Selo de confirmado

Para um cadastro exibir o selo, acrescente uma coluna chamada **Verificado** na planilha
de respostas (à direita das que o Forms cria) e escreva `sim` na linha correspondente.
Também valem `x`, `ok` e `1`; qualquer outra coisa, inclusive `não`, não marca nada.

O selo significa **o responsável confirmou os dados** — não "nós enviamos uma mensagem".
Por isso ele não é aceso pela ferramenta de avisos: o fluxo é avisar, esperar a resposta
e só então escrever `sim` na planilha.

## Página "Sobre"

`sobre/` responde as perguntas que alguém listado — ou pensando em se cadastrar — faz
antes de confiar no guia: que é gratuito e sem posição paga, que a vertente aparece com
as palavras de quem respondeu, que só entra quem autoriza a divulgação no formulário,
o que o selo significa (e o que não significa), o que o guia não faz, e principalmente
**como corrigir uma informação ou pedir para sair** — sem justificativa e sem burocracia.

É alcançada pelo botão **Sobre** no cabeçalho do guia, pelo rodapé de todas as páginas,
e entra no `sitemap.xml`. A página é independente: tem o próprio `<style>` e não depende
do `index.html`.

A seção **Quem mantém** traz a marca da Nova Luz no Horizonte (`nova-luz.webp`), o
endereço, o WhatsApp e botões de rota para o Google Maps e o Waze. Dois detalhes de
manutenção: o logo fica sobre um painel claro porque o letreiro dele é grafite escuro e
sumiria no fundo do site; e o endereço aparece em três lugares da página — o texto e os
dois links de rota —, então mudar um exige mudar os três.

## Link do formulário de cadastro

Sem ele o guia só pode ser lido: não há como alguém se cadastrar pelo site.

Para ligar, crie a variável `FORMULARIO_URL` no mesmo lugar da `PLANILHA_CSV_URL`
(**Settings → Secrets and variables → Actions → Variables**), com o link público do
formulário — o que sai em **Enviar → 🔗** no Google Forms, terminando em `/viewform`.
Não use o endereço da barra do navegador enquanto você edita o formulário: aquele
termina em `/edit` e só abre para quem tem permissão de edição.

Na sincronização seguinte o link é gravado em `dados.json` e passa a aparecer em três
lugares: o convite ao fim da lista do guia, o rodapé de todas as páginas, e a seção
"Como um espaço entra" da página Sobre.

Enquanto a variável não existir, nada disso é desenhado — é melhor não ter botão do que
ter um botão que não leva a lugar nenhum. Só endereços `http`/`https` são aceitos.

## Avisar quem foi cadastrado

Como qualquer pessoa pode cadastrar qualquer espaço, `avisos/` lista os cadastros e
oferece, para cada um, um botão que abre o WhatsApp do número informado com uma
mensagem pronta: o nome do espaço, o link da página dele e o convite a pedir correção
ou remoção. É assim que o responsável descobre que está no guia.

Nada sai sozinho — cada mensagem parte de um toque seu. O que já foi avisado fica
marcado no `localStorage` daquele navegador, então em outro aparelho a lista aparece
zerada. A página não é indexada (`noindex` e `Disallow` no robots.txt).

## Observações

- **Nada é deduzido.** O guia mostra apenas o que a pessoa preencheu no formulário:
  campo em branco não aparece no cartão, nos detalhes nem na ficha, e o cadastro não é
  alcançado pelos filtros daquele campo. A vertente é exibida com as palavras de quem
  respondeu; a categorização existe só para colorir o selo e alimentar os chips.
- Os cadastros oficiais vêm de `dados.json`. Importações e edições feitas no app ficam
  no **`localStorage` do navegador** e sobrevivem até a próxima atualização oficial,
  quando são substituídas pela versão nova. Use **Exportar CSV** para guardar uma cópia.
- Os cadastros que vêm pré-carregados são **fictícios**, apenas para demonstração.
- A **arte de fundo** é a foto `fundo.webp` (94 KB), abafada por uma camada escura.
  Duas variáveis no topo do `<style>` controlam isso: `--arte-fundo` aponta para o
  arquivo e `--escurecer` define o quanto ele some — `0` mostra a foto crua, `1`
  deixa preto. Está em `.84`.
- A **identidade** vem de três arquivos gerados a partir do logo: `marca.webp` (o
  emblema do cabeçalho, recortado no círculo interno porque o medalhão inteiro vira
  borrão em tamanho pequeno), `logo.webp` (o conjunto completo, no rodapé) e
  `favicon.png` (ícone da aba). Todos com fundo transparente.
- O CSS já vem **embutido no arquivo**: nenhuma requisição externa, carrega na hora e
  funciona offline. Ele é gerado pelo Tailwind a partir das classes realmente usadas.

## Mexendo no visual

O `index.html` continua sendo um arquivo só, pronto para abrir. Mas se você **adicionar ou
remover uma classe do Tailwind** no HTML, é preciso regerar o CSS embutido:

```sh
npm install     # só na primeira vez
npm run css
```

O comando recompila e reescreve o bloco `<style>` do `index.html`. Estilos próprios
(cores, textura, ornamentos, ícones) ficam no segundo `<style>`, escrito à mão — esses
podem ser editados direto, sem recompilar.
