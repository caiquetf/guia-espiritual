# Guia Espiritual — Piracicaba e Região

Diretório de espaços espirituais, terreiros e oraculistas de Piracicaba e região.
Aplicativo de página única (SPA) em **um único arquivo** — `index.html` — com Tailwind CSS e JavaScript puro.

## Como usar

Abra `index.html` no navegador (duplo clique já basta — não precisa de servidor nem instalação).

## Importar os cadastros do Google Forms

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

- Os dados ficam salvos apenas no **`localStorage` do navegador** — não há servidor nem envio para a internet. Use **Exportar CSV** para fazer backup.
- Os cadastros que vêm pré-carregados são **fictícios**, apenas para demonstração.
- O Tailwind é carregado via CDN. Sem internet, um CSS de fallback embutido mantém o app legível e totalmente funcional.
