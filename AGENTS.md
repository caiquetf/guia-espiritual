# Guia Espiritual — Piracicaba e Região

Instruções para quem for mexer neste projeto, humano ou assistente. Leia tudo
antes da primeira alteração: há decisões aqui que parecem arbitrárias e não são.

---

## 1. O que é

Um guia público e gratuito de terreiros, casas de axé, oraculistas e terapeutas
de Piracicaba e região. Sem anúncio, sem intermediário, sem cobrança. Qualquer
espaço se cadastra sozinho pelo site; cada um recebe um link privado para
conferir, corrigir ou sair quando quiser.

**No ar:** https://caiquetf.github.io/guia-espiritual/
**Repositório:** `caiquetf/guia-espiritual`
**Ramo de trabalho:** `claude/spiritual-spaces-directory-piracicaba-u66nt3`
**Hoje:** 30 cadastros, 10 confirmados pelos responsáveis.

Quem mantém: Caique (Nova Luz no Horizonte, Rua Dom Pedro I, 1208 — Centro,
Piracicaba/SP).

---

## 2. Como o dado anda

```
pessoa preenche /cadastrar/
        │  POST
        ▼
Apps Script "CADASTRO"  ──escreve──►  planilha do Google
                                           │
                                           │ publicada como CSV
                                           ▼
                        GitHub Actions, de hora em hora
                        scripts/atualizar-dados.mjs   → dados.json
                        scripts/gerar-paginas.mjs     → espaco/, vertente/, sitemap
                                           │
                                           ▼
                                  GitHub Pages (site estático)
```

**A planilha é a fonte da verdade.** O site é uma fotografia dela, refeita de
hora em hora. Nada no site escreve direto na planilha — tudo passa por um dos
dois Apps Script.

**Consequência prática:** qualquer alteração aparece no guia em até uma hora,
nunca na hora. Isso está escrito em todas as telas que gravam algo, e não deve
ser escondido.

---

## 3. As duas peças no Google — leia com atenção

Existem **dois** projetos no Apps Script, com códigos diferentes e níveis de
acesso diferentes. Confundi-los custou uma semana de trabalho. O código fonte
dos dois está em `scripts/`, mas o que roda é a cópia colada dentro do Google.

| | `scripts/publico.gs` | `scripts/verificar.gs` |
|---|---|---|
| Nome do projeto | **CADASTRO** | **VERIFICAR** |
| Quem pode acessar | **Qualquer pessoa** | **Somente eu** |
| Quem usa | o visitante | quem mantém o guia |
| O que faz | cadastrar, ler, salvar, confirmar, remover | acender selo, montar a mensagem de aviso |
| Marca no código | `TEXTO_AUTORIZACAO` | `COLUNA = 'Verificado'` |

**Como saber qual é qual sem depender do nome do projeto:** abra a URL `/exec`
no navegador.

- `{"ok":true,"servico":"cadastro do Guia Espiritual",...}` → é o CADASTRO
- `⚠ Faltou dizer qual cadastro.` → é o VERIFICAR

Os painéis também sabem perguntar: ambos os scripts respondem à ação
`quemsou`, e o `/painel/` tem um botão "Testar este endereço".

### Ao alterar um .gs

1. Edite em `scripts/` e commite — é a versão de referência.
2. Cole o arquivo no projeto correspondente no `script.google.com`.
3. Preencha `var PLANILHA = ''` com o link da planilha (o repositório **não**
   guarda esse link, de propósito).
4. **Implantar → Gerenciar implantações → ✏️ → Versão: Nova versão.**

**Nunca "Nova implantação"** quando já existe uma: ela cria outra URL, e a
configuração do site continua apontando para a antiga. Foi assim que o endereço
do cadastro passou a servir o script do selo, e ninguém conseguia se cadastrar.

Salvar não publica. Sem subir a versão, a URL continua servindo o código velho.

---

## 4. Mapa dos arquivos

### Páginas (HTML escrito à mão, sem framework)

| Caminho | O que é |
|---|---|
| `index.html` | o guia. Página única, Tailwind compilado e embutido, funciona offline |
| `cadastrar/` | formulário público de cadastro |
| `meu/` | página do responsável, aberta por `?c=<chave>` |
| `sobre/` | o que o guia promete |
| `painel/` | **ferramenta de quem mantém**: avisar, conferir selo, revisar dados, ajustes |
| `avisos/`, `verificar/`, `revisar/` | encaminham para as abas do painel (endereços antigos) |

### Gerado — não edite à mão

| Caminho | Gerado por |
|---|---|
| `dados.json` | `scripts/atualizar-dados.mjs` |
| `espaco/<apelido>/` | `scripts/gerar-paginas.mjs` |
| `vertente/<apelido>/` | idem |
| `sitemap.xml`, `robots.txt` | idem |
| `espaco-apelidos.json` | idem — histórico de endereços, para links antigos não morrerem |

### Scripts

| Caminho | O que faz |
|---|---|
| `scripts/atualizar-dados.mjs` | lê o CSV da planilha, limpa, desduplica, escreve `dados.json` |
| `scripts/gerar-paginas.mjs` | escreve as páginas de espaço e de vertente, sitemap e robots |
| `scripts/publico.gs` | o Apps Script do cadastro |
| `scripts/verificar.gs` | o Apps Script do dono |
| `build/embutir-css.mjs` | compila o Tailwind e embute no `index.html` (`npm run css`) |
| `testes/` | ver seção 8 |

### Automação

| Caminho | Quando roda |
|---|---|
| `.github/workflows/sincronizar-planilha.yml` | de hora em hora (`17 * * * *`) e sob demanda |
| `.github/workflows/pages.yml` | a cada push, e chamado pela sincronização |

---

## 5. Configuração

O site não tem arquivo de configuração. Os endereços chegam ao `dados.json`
pela sincronização, lidos de variáveis do repositório — com um valor padrão
escrito no próprio workflow, que vale quando a variável não existe.

| Variável | Para quê |
|---|---|
| `PLANILHA_CSV_URL` | a planilha publicada como CSV |
| `CADASTRO_URL` | `/exec` do Apps Script CADASTRO |
| `VERIFICAR_URL` | `/exec` do Apps Script VERIFICAR |
| `FORMULARIO_URL` | o Google Forms antigo (só como alternativa) |

**A variável vence o padrão do workflow.** Se um endereço parecer errado e o
código parecer certo, olhe em Settings → Secrets and variables → Actions →
Variables: provavelmente há uma variável antiga lá.

Nenhuma dessas é segredo. A URL do VERIFICAR é inofensiva porque a implantação
é "somente eu": quem abrir sem a sessão do Google cai no login.

---

## 6. Regras do produto — não negocie estas sozinho

**Nada é preenchido por dedução.** Se a pessoa não informou o endereço, o
endereço não aparece. Nem "a combinar", nem "consulte", nem nada. Campo vazio
simplesmente não vira linha na tela. Vale para todos os campos, em todas as
páginas.

**Correção de grafia, nunca troca de palavra.** Dá para consertar acento e
caixa ("umbanda" → "Umbanda"). Não dá para trocar o que a pessoa escreveu por
um termo "melhor". Quem escreveu "Bruxa/reikiana" continua "Bruxa/reikiana" na
tela — o agrupamento interno é outra coisa.

**O selo diz uma coisa só:** o responsável conferiu os dados. Ele acende quando
a pessoa confirma pelo link dela, e a data da confirmação vai junto. Acender
selo por conta própria desmente a promessa — o painel permite, para o caso de
confirmação por fora, e isso está escrito lá.

**A chave é o único segredo do sistema.** 28 caracteres por cadastro, numa
coluna da planilha que a sincronização não conhece. Quem tem a chave de um
espaço lê, altera e remove aquele espaço. Ela nunca passa pelo site: a mensagem
que a carrega é montada dentro do Apps Script do dono.

- Nunca publique a chave em lugar nenhum.
- Nunca exporte a planilha inteira com a coluna Chave visível.
- Se vazar, rode `trocarChaves()` no Apps Script do cadastro — mas isso mata
  todos os links já enviados.

**O e-mail não aparece no guia.** Os dois formulários prometem isso com todas
as letras. Ele fica na planilha e é removido do `dados.json` antes de publicar.

**O guia é feito para quem procura, não para quem cadastra.** Quando houver
conflito entre "completar o cadastro" e "respeitar o que a pessoa escolheu não
dizer", vence a segunda.

---

## 7. Como mexer

```bash
npm run css          # recompila o Tailwind e embute no index.html
npm test             # 99 verificações, sem instalar nada
npm run test:web     # + 20 no navegador (precisa de playwright)
```

Depois de mexer no `index.html`, **rode `npm run css`** — o CSS fica embutido,
e esquecer isso deixa a página sem estilo.

Para ver uma mudança nos dados no site: Actions → Sincronizar planilha do
formulário → Run workflow. O painel tem esse lembrete.

Para gerar as páginas localmente: `node scripts/gerar-paginas.mjs` (precisa do
`dados.json` na pasta).

---

## 8. Testes

Moram em `testes/`, rodam contra uma planilha de mentira e uma pasta
temporária. Nada toca na planilha real nem no site.

| Arquivo | Protege |
|---|---|
| `cadastro.mjs` | o Apps Script público: cadastrar, ler, salvar, confirmar, sair, a chave |
| `selo.mjs` | o Apps Script do dono: selo e mensagem com link privado |
| `publicacao.mjs` | da planilha ao `dados.json` e às páginas |
| `paginas.mjs` | as páginas no navegador (precisa de playwright) |
| `ajuda.mjs` | a planilha de mentira e os serviços do Google fingidos |

Os nomes dos testes dizem **o que se perde se quebrar**, não qual função
falhou. Mantenha assim. Ao consertar um defeito, acrescente o teste que o
reproduz — a maior parte da suíte nasceu assim.

---

## 9. Armadilhas que já custaram caro

**Há duas cópias do leitor de planilha.** `index.html` e
`scripts/atualizar-dados.mjs` têm cada um a sua lista `FIELDS`, as regras de
vertente e o normalizador de cidade. É proposital: o `index.html` precisa abrir
sozinho, sem servidor e sem import. **Ao mexer numa, mexa na outra** — há teste
que acusa a divergência. Elas já divergiram, e o navegador passou a descartar a
coluna Serviços da planilha real.

**O apelido da página carrega o fim do telefone.** Corrigir o número muda o
endereço. Por isso existe o `espaco-apelidos.json`: os endereços antigos viram
páginas que encaminham para o novo. Se mexer no `apelido()`, cuide disso.

**Toda pasta gerada precisa estar na lista do workflow.** O robô só comita o
que está em `git add`. Uma pasta gerada e não listada some do site sem ninguém
notar — aconteceu com `vertente/`.

**JSON dentro de `<script>` precisa escapar o `<`.** Um cadastro chamado
`Casa</script><script>…` fechava a tag e rodava código no endereço do guia — o
mesmo endereço do `/meu/`, cuja URL carrega a chave de alguém. Use
`jsonEmScript()`.

**`window.open(..., 'noopener')` devolve `null`.** Quem testa o retorno para
detectar pop-up bloqueado vai achar que foi sempre bloqueado.

**Resposta do Apps Script nem sempre é JSON.** Quando o Google devolve uma tela
de login ou um erro, vem HTML. Leia como texto e tente converter — dizer "pode
ser a conexão" nesse caso manda a pessoa procurar defeito no lugar errado.

**O selo nunca deve acender por falta de informação.** Um pedido que o script
não entende tem que recusar, não assumir "sim".

---

## 10. Estado e pendências

Funcionando: cadastro pelo site, página do responsável com conferir/editar/sair,
selo com data, painel do dono, páginas por vertente, encaminhamento de endereços
antigos, mapa nas páginas de espaço.

Em aberto:

- **Google Search Console** nunca foi configurado. O guia tem 30 cadastros e
  provavelmente ainda não é encontrado por busca. É a coisa de maior impacto
  que falta, e depende da conta Google do mantenedor.
- **Só há cadastros de Piracicaba**, embora o guia se chame "e Região". É
  alcance, não defeito.
- Ideia não feita: um campo **"precisa agendar?"** — quase todos escrevem isso
  no campo de horários, e é a primeira coisa que quem procura quer saber.
- Ideia não feita: **fila de reconfirmação** no painel, para selos com mais de
  seis meses.

---

## 11. Tom

Os textos do site falam com pessoas que não são de tecnologia, sobre um assunto
em que confiança é tudo. Evite jargão, evite entusiasmo de propaganda, e não
prometa o que o sistema não faz. Quando algo der errado numa tela, diga o que
aconteceu e o que a pessoa pode fazer — nunca "ops, algo deu errado".

Os comentários no código seguem a mesma regra: explicam **por que**, não o quê.
Quase todo comentário aqui existe porque alguém se enganou antes.
