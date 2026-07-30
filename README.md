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

1. No Google Forms, abra a planilha de respostas → **Arquivo → Fazer download → CSV**.
2. No app, clique em **📥 Importar CSV** (ou arraste o arquivo para qualquer lugar da página).

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

O menu **⋯** (celular) traz também **Baixar modelo de planilha** e **Exportar cadastros (CSV)**.

## Funcionalidades

- **Busca global** por nome, dirigente, bairro, cidade, serviços, horários e regras (vários termos, sem acento).
- **Filtros combinados:** cidade, tradição (chips com contagem) e modalidade. Quem atende "Ambas" aparece nos filtros Presencial e Online.
- **Cartões** em grade ou lista, com badge colorido por tradição.
- **🟢 Chamar no WhatsApp** — abre `wa.me/55…` com mensagem inicial pronta.
- **📋 Copiar ficha completa** — texto formatado para colar na conversa com o cliente.
- **📤 Enviar para cliente** — abre o WhatsApp já com a ficha no corpo da mensagem.
- **🔍 Ver detalhes** — modal com os 14 campos, link para o Google Maps e para as redes sociais.
- **Cadastro manual** (＋ Novo cadastro), edição e exclusão.
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

## Observações

- **Nada é deduzido.** O guia mostra apenas o que a pessoa preencheu no formulário:
  campo em branco não aparece no cartão, nos detalhes nem na ficha, e o cadastro não é
  alcançado pelos filtros daquele campo. A vertente é exibida com as palavras de quem
  respondeu; a categorização existe só para colorir o selo e alimentar os chips.
- Os cadastros oficiais vêm de `dados.json`. Importações e edições feitas no app ficam
  no **`localStorage` do navegador** e sobrevivem até a próxima atualização oficial,
  quando são substituídas pela versão nova. Use **Exportar CSV** para guardar uma cópia.
- Os cadastros que vêm pré-carregados são **fictícios**, apenas para demonstração.
- O Tailwind é carregado via CDN. Sem internet, um CSS de fallback embutido mantém o app legível e totalmente funcional.
