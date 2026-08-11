# Guia Espiritual — Piracicaba e Região

Diretório de espaços espirituais, terreiros e oraculistas de Piracicaba e região.
Aplicativo de página única (SPA) em **um único arquivo** — `index.html` — com Tailwind CSS e JavaScript puro.

## Como usar

Abra `index.html` no navegador (duplo clique já basta — não precisa de servidor nem instalação).

## Roteiro de instalação

O site funciona sozinho depois de configurado. São **duas implantações do Apps Script** e
**três variáveis** no repositório — abaixo, na ordem, com o que cada uma destrava.

| # | O quê | Onde | Destrava |
|---|---|---|---|
| 1 | Publicar a planilha como CSV | Planilha → Arquivo → Compartilhar → Publicar na web | a sincronização |
| 2 | Variável `PLANILHA_CSV_URL` | Settings → Variables | idem |
| 3 | `scripts/publico.gs` → App da Web, **qualquer pessoa** | script.google.com | cadastro em `/cadastrar/` e a página do responsável em `/meu/` |
| 4 | Rodar `gerarChaves` uma vez | editor do Apps Script | dá chave aos cadastros que já existem |
| 5 | Variável `CADASTRO_URL` com a URL `/exec` | Settings → Variables | idem |
| 6 | `scripts/verificar.gs` → App da Web, **somente eu** | script.google.com | o painel `verificar/` e o aviso com link privado |
| 7 | Variável `VERIFICAR_URL` e a constante `API_DONO` | Settings → Variables e `avisos/index.html` | idem |

A diferença entre "qualquer pessoa" e "somente eu" é o coração da segurança aqui:
o script público recebe cadastros e obedece a quem tem a **chave** de um espaço; o script
privado obedece só a você, autenticada pelo Google — e é por isso que é ele quem lê as
chaves para montar as mensagens.

Enquanto os passos 3 a 7 não estiverem prontos, nada quebra: cada página mostra o que
falta e oferece o caminho antigo (formulário do Google, WhatsApp) no lugar.

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
e só então marcar.

### Marcar com um clique

Digitar na planilha funciona, mas é lento. `verificar/` lista os cadastros com um botão
cada: o clique abre uma janelinha para um Apps Script publicado **dentro da própria
planilha**, que escreve na coluna e se fecha.

Quem garante que só você marca é o Google, não o site: o script é publicado com
**"Quem tem acesso: somente eu"**, então qualquer outra pessoa que clique cai na tela de
login e não grava nada. Não existe token nem senha guardada em página pública — a URL
que o painel abre não carrega segredo nenhum, só o nome e o telefone do cadastro.

A instalação está comentada no topo de `scripts/verificar.gs`, e o próprio painel mostra
o passo a passo enquanto a variável `VERIFICAR_URL` não existir. Resumindo: criar um
projeto em **script.google.com**, colar o arquivo, pôr o link da planilha na constante
`PLANILHA`, implantar como App da Web com acesso "somente eu", e criar a variável
`VERIFICAR_URL` com a URL `/exec` gerada.

O script é **solto**, não preso à planilha, justamente para caber num celular: o link de
uma planilha é sequestrado pelo aplicativo do Sheets, onde não existe menu de Apps
Script, mas o `script.google.com` não tem aplicativo e abre no navegador. Quem instalar
por um computador pode continuar usando **Extensões → Apps Script**; nesse caso é só
deixar `PLANILHA` vazia, que o script usa a planilha que o hospeda.

O painel não finge que o selo já saiu: o cadastro clicado fica marcado como *aguardando
a sincronização* até a planilha voltar confirmando. Se a planilha contradisser o clique,
o clique é esquecido — a planilha é a verdade.

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

## O responsável cuidando do próprio cadastro

`meu/?c=<chave>` é a página de quem está listado. Ela mostra os dados do espaço já
preenchidos e oferece três caminhos: **Está tudo certo** (acende o selo), **Salvar
correções** (edita e confirma junto — quem acabou de rever cada campo é justamente quem
pode dizer que estão certos) e **Não quero mais aparecer**.

A **chave** é um código de 28 letras guardado na coluna `Chave` da planilha. Sem ela não
se lê nem se altera nada, e ela **nunca é publicada**: a sincronização só copia as
colunas que conhece, e essa não está entre elas. O link só chega ao responsável pela
mensagem que você envia.

Por isso o botão **Avisar no WhatsApp**, na `avisos/`, passa pelo Apps Script "somente
eu" (`API_DONO`): é ele que lê a chave e devolve a mensagem pronta com o link, sem que o
segredo passe pelo site público. Sem `API_DONO` configurado, o botão volta à mensagem
antiga — que avisa, mas não dá autonomia a ninguém.

**Sair não apaga a linha.** Marca `Removido` = sim, e a sincronização para de publicar.
A resposta original continua registrada, inclusive a autorização que um dia foi dada —
apagar seria perder a prova de que o cadastro existiu.

Depois de instalar, rode **uma vez** a função `gerarChaves` pelo editor do Apps Script:
ela dá chave aos cadastros que já existiam. Os novos já nascem com a sua.

## Cadastro pelo próprio site

O formulário vive em `cadastrar/`, com a cara do guia. Ele não passa pelo Google Forms:
envia direto para um Apps Script (`scripts/publico.gs`) que grava uma linha na planilha
de respostas. A sincronização horária não sabe a diferença — para ela é só mais uma
resposta.

São **duas implantações do Apps Script**, e a diferença entre elas é o ponto todo:

| arquivo | quem pode acessar | para quê |
|---|---|---|
| `scripts/verificar.gs` | **somente eu** | acender o selo — só a dona da planilha |
| `scripts/publico.gs` | **qualquer pessoa** | receber cadastro — quem envia é o visitante |

A URL `/exec` da segunda vai na variável **`CADASTRO_URL`** do repositório. A
sincronização a copia para o `dados.json`, e `/cadastrar/` e `/meu/` a leem de lá —
ligar não exige editar HTML. (A constante `API_PUBLICA`, no topo das duas páginas,
continua valendo como atalho para testar sem esperar a sincronização.)

Enquanto ela não existir, o formulário nem aparece: a página oferece o formulário antigo
do Google (se `formulario` ainda estiver no `dados.json`) e o WhatsApp. Ninguém deve
encontrar uma porta que não abre.

O script recusa o que não deve entrar: sem autorização de divulgação, sem nome, telefone
sem DDD, espaço já cadastrado, ou enxurrada acima de `LIMITE_POR_MINUTO`. Tem também um
campo-armadilha invisível — se vier preenchido, a resposta é "ok" e nada é gravado, para
o robô não descobrir que caiu.

**Coluna que falta é criada, não descartada.** Se a planilha não tiver uma coluna para
bairro, por exemplo, ela é acrescentada à direita em vez de o dado se perder.

O site não consegue ler a resposta do Google quando a rede falha. Nesse caso a página
**não diz que recebeu**: mostra o erro e oferece mandar tudo por WhatsApp, com os dados
já preenchidos na mensagem.

## Link do formulário antigo (rede de segurança)

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

## Revisar cadastros

`revisar/` mostra o que falta em cada cadastro e, junto, **o que a falta custa**: sem
cidade o espaço some do filtro de cidade, sem modalidade some dos filtros Presencial e
Online, sem telefone com DDD o cartão fica sem o botão verde. O placar no topo conta
quantos estão em cada situação e filtra a lista; "Copiar os nomes desta lista" entrega
o recorte pronto para levar até a planilha.

Nada se corrige por ali — a correção é feita na planilha de respostas, e o site
acompanha na sincronização seguinte.

Duas regras merecem nota. Endereço só é cobrado de quem **declarou** atender
presencialmente: para quem atende só online, o campo em branco é a resposta certa. E
"cadastro antigo" e "ainda sem selo" contam como avisos leves — não são erro de
preenchimento, e por isso um cadastro que só tem esses dois entra em "nada a corrigir".

Como a `avisos/`, a página não é indexada (`noindex` e `Disallow` no robots.txt).

## Contador de visitas

Ligado, apontando para **caiquetf.goatcounter.com**. Os números ficam em
<https://caiquetf.goatcounter.com>.

A constante `CONTADOR` guarda o nome da conta e vive em três lugares: no topo do script
do `index.html`, no topo do `scripts/gerar-paginas.mjs` — que reimprime as páginas de
espaço e o atalho `/cadastrar/` — e dentro do `sobre/index.html`. **Esvaziar as três
desliga tudo**, e aí o site volta a não fazer nenhuma requisição a terceiros.

O GoatCounter não usa cookie, não guarda IP e não segue ninguém entre visitas: ele
conta a página aberta e esquece quem abriu. Por isso não exige aviso de cookies.

As três páginas de manutenção — `avisos/`, `revisar/` e `verificar/` — ficam de fora
de propósito: a sua própria visita não é público.

### Saber se o cartaz funcionou

O QR do cartaz que leva ao guia aponta para `/?de=cartaz`, e o de cadastro aponta para
`/cadastrar/`, endereço que só existe para ele — o botão do site vai direto ao
formulário. São esses dois caminhos que separam quem chegou pela parede da loja de quem
chegou por link.

Se o GoatCounter juntar `/?de=cartaz` com `/`, há uma opção nas configurações do site
para preservar a parte depois do `?`.

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
