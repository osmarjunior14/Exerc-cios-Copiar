# PLANNUM360

Protótipo web para cadastro de aluno, avaliação física, biblioteca de exercícios e prescrição de treino.

## Recursos

- Dashboard com métricas do aluno, aderência, biblioteca, avaliações e próximas ações.
- Cadastro do aluno com objetivo, nível e restrições.
- Anamnese estruturada com PAR-Q, sono, estresse, rotina, dores e alertas.
- Avaliação física completa com perimetrias, 7 dobras Jackson-Pollock, IMC, RCQ, RCE, índice de conicidade, ITM e histórico local.
- Composição corporal com % gordura, massa gorda, massa livre de gordura, peso residual, peso ósseo e peso muscular estimado.
- Cards de resultado com classificação, barra de composição corporal, indicadores de risco e gráfico de simetria entre membros.
- Periodização com blocos, frequência, estratégia e notas.
- Biblioteca de exercícios com vídeos do YouTube.
- Favoritos na biblioteca.
- Prescrição de treino com séries, repetições, peso, intervalo e observações.
- Campos avançados de prescrição: dia da semana, método, intensidade alvo, tempo e RPE.
- Modelos rápidos de treino: superior, inferior e full body.
- Área do aluno com layout mobile, vídeos, checklist de séries, timer de descanso e feedback.
- Vídeos do treino em autoplay sem som e loop, funcionando como prévia curta tipo GIF.
- Progresso do treino por séries concluídas e feedback visual por notificações.
- Predição de carga pelo protocolo de Baechle, 1992:

```txt
1RM estimado = peso usado * (1 + repetições realizadas / 30)
carga sugerida = 1RM estimado / (1 + repetições prescritas / 30)
```

- Exportação/importação dos dados em JSON.
- Acompanhamento de execução com status, RPE geral, dor, fadiga, feedback e ajustes.
- Agenda para check-ins, reavaliações, trocas de treino, pagamentos e consultas.
- Financeiro local para planos, recorrência, valores, vencimentos e status.
- Relatórios profissionais com evolução, aderência, alertas, agenda e financeiro.
- Link rápido de WhatsApp com relatório preenchido.
- Cópia de resumo da prescrição para envio ao aluno.
- PIN local opcional para uso pessoal.
- Tela de login local com acesso separado para professor e aluno.
- Professor acessa o sistema completo; aluno entra direto em treino e relatório.
- Login do aluno usa e-mail cadastrado e data de nascimento como senha, sem envio de e-mail.
- Estrutura pronta para PWA com `manifest.webmanifest` e `sw.js`.

## Como usar

Abra `index.html` no navegador ou rode um servidor local:

```bash
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## Sincronizar exercícios do YouTube

O script abaixo tenta extrair os vídeos públicos do canal informado e atualizar `data/exercises.json`:

```bash
node scripts/sync-youtube.mjs
```

Também é possível passar outra URL:

```bash
node scripts/sync-youtube.mjs "https://www.youtube.com/@fifteensecondsforfit/videos"
```

Sem uma API oficial do YouTube, essa sincronização depende do HTML público do canal e pode precisar de ajuste se o YouTube alterar a página.
