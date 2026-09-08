# Testes

Rodam o código de verdade — os dois arquivos do Apps Script, a sincronização e o
gerador de páginas — contra uma planilha de mentira e uma pasta temporária.
Nada aqui toca na planilha real nem no site publicado.

## Como rodar

```
npm test          # tudo que não precisa de navegador — não instala nada
npm run test:web  # inclui as páginas no navegador
```

O primeiro comando funciona em qualquer computador com Node, sem instalação.
O segundo precisa do playwright:

```
npm i -D playwright && npx playwright install chromium
```

Se ele não estiver instalado, os testes de navegador são pulados em silêncio e
o resto continua valendo.

## O que tem em cada arquivo

| Arquivo | O que protege |
|---|---|
| `cadastro.mjs` | o script público: cadastrar, ler, salvar, confirmar, sair, e a chave |
| `selo.mjs` | o script do dono: acender selo e montar a mensagem com o link privado |
| `publicacao.mjs` | da planilha ao `dados.json` e às páginas de espaço |
| `paginas.mjs` | as páginas no navegador (precisa do playwright) |
| `ajuda.mjs` | a planilha de mentira e os serviços do Google fingidos |

## Por que estes testes existem

Cada verificação aqui corresponde a algo que já quebrou, ou que quebraria caro:

- **A chave** é a única credencial do sistema. Se ela for previsível ou vazar
  para o telefone errado, alguém edita o cadastro de outra pessoa.
- **O e-mail** é a única informação que os formulários prometem não publicar.
- **As quebras de linha** dos horários são conteúdo: achatá-las destrói, na
  planilha, o que a pessoa escreveu.
- **O selo** só pode acender quando o responsável confirma — é o que ele promete
  a quem lê o guia.
- **Os links já enviados** não podem morrer quando alguém corrige o telefone.
- **Um cadastro é texto de estranho**: não pode virar código na página.

## Ao mexer no código

Rode `npm test` antes de publicar. Se um teste falhar, leia o nome dele: está
escrito em português e diz o que se perdeu, não qual função quebrou.
