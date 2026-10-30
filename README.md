# session-band

Um mod do Claude Code que mostra uma faixa acima da caixa de digitação com:

- **Contexto usado**, em % e tokens. A bolinha fica verde abaixo de 60%, amarela até 85% e vermelha acima disso.
- **Branch do git**, com `*` quando há mudança não commitada e `↑`/`↓` em relação ao upstream.
- **Rate limit de 5h**, com a hora do reset.

```
● 42% contexto 84k/200k │ ⎇ feat/login* ↑2 ↓1 │ 5h 31% · reset 14:20
```

Com o contexto em 85% ou mais, aparece um botão **Compactar**. Ele fica escondido enquanto o Claude está trabalhando. Um aviso aparece quando o contexto passa de 80% e quando o rate limit de 5h passa de 90%.

## Instalação

No terminal, com o Claude Code:

```
/plugin install session-band --marketplace gitlherme/session-band
```

Responda `y` para adicionar o marketplace e escolha o escopo.

No app desktop: clique no **+** ao lado da caixa de digitação, depois **Plugins**, **Add marketplace** com `gitlherme/session-band` e por fim **Add plugin**.

## Como atualiza

- Contexto e rate limit: depois de cada chamada de ferramenta, no fim de cada turno e depois de compactar.
- Git: depois de `Bash`, `Edit` ou `Write`, no fim de cada turno e a cada 30s.

O rate limit só aparece depois da primeira resposta da API na sessão. Fora de um repositório git, a parte da branch some.
