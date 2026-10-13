# Rastrear um caminho

Objetivo: tornar visível a cadeia de tarefas antes ou depois de uma tarefa, para ver o que determina a data de uma tarefa e o que se desloca se ela atrasar.

## Quando precisa disto

A cobertura só começa daqui a três semanas e quer saber qual tarefa define essa data. Ou o pedreiro atrasa-se uma semana e quer ver quais as tarefas seguintes que são deslocadas. Num planeamento com dezenas de relações, não se vê isso pelas linhas. Com o **rastreamento de caminho**, a aplicação colore todas as **predecessoras** (tarefas que vêm antes da tarefa escolhida, diretamente ou através de outras tarefas) e as **sucessoras** (tarefas que vêm depois dela) e esbate o resto.

## Passos

1. Selecione a tarefa cujo caminho quer ver, na tabela de tarefas ou na respetiva barra no Gantt. Se selecionar várias tarefas, a aplicação rastreia a partir da tarefa que selecionou primeiro.
2. Escolha *Planeamento › Rastreamento de caminho › Predecessoras* para tudo o que vem antes da tarefa, ou *Planeamento › Rastreamento de caminho › Sucessoras* para tudo o que vem depois dela. Os dois botões podem estar ativos ao mesmo tempo. Os mesmos dois botões estão no separador *Tabela*, no grupo *Rastreamento de caminho*.
3. Se quiser as duas direções de uma vez, clique com o botão direito na tarefa, no Gantt ou na tabela de tarefas, e escolha *Rastrear caminho*.
4. Veja o resultado no Gantt e na tabela de tarefas. A forma de o ler é explicada abaixo.
5. Para parar, clique de novo no botão ativo, clique com o botão direito numa tarefa e escolha *Parar rastreamento*, ou prima Esc. Esc também limpa a seleção.

Se selecionar outra tarefa durante o rastreamento, o caminho segue a nova seleção.

## Como ler o resultado

- As predecessoras são de cor dourada, as sucessoras de cor roxa. No Gantt, as barras mudam de cor; na tabela de tarefas aparece uma faixa à esquerda da linha: contínua para as predecessoras, tracejada para as sucessoras. A tarefa escolhida tem um contorno.
- Uma cor mais escura, na tabela de tarefas uma faixa mais grossa com texto a negrito, marca a cadeia de **relações determinantes**: as relações que determinam de facto as datas. O que isso significa está explicado em [Relações e desfasamento](docs://uitleg-relaties).
- Todas as tarefas fora do caminho ficam esbatidas. As linhas de relação que não pertencem ao caminho ficam mais ténues e pontilhadas.

## Armadilhas e o que a aplicação faz

**Nenhuma tarefa selecionada.** Sem tarefa selecionada não há nada para rastrear: o botão fica ativo, mas nada muda no ecrã. Selecione primeiro uma tarefa.

**Sem destaque na cadeia de relações determinantes.** O destaque vem do último cálculo. Se o planeamento ainda não foi calculado, ou o cálculo dá erro, a aplicação colore todas as predecessoras e sucessoras com a mesma intensidade. Prima **Calcular** (F5), por exemplo em *Início › Agendamento › Calcular*, e volte a ver o caminho. Depois de uma alteração, o destaque mantém-se com o cálculo anterior enquanto a barra de estado indicar *Desatualizado — recalcule (F5)*.

**Uma relação numa fase.** O rastreamento segue as relações tal como as definiu. Uma relação de ou para uma fase (tarefa de resumo) liga a própria fase. Para o cálculo, aplica-se a todas as tarefas dessa fase, mas o caminho não continua para as tarefas dentro dela. Se rastrear uma tarefa dentro de uma fase que está ligada a outra tarefa por uma relação na própria fase, por isso não vê essa relação. Nesse caso, selecione a própria fase.

**Só a direção escolhida.** Se só *Predecessoras* estiver ativo, não vê o que vem depois da tarefa, e o contrário.

## Ver também

- [Relações e desfasamento](docs://uitleg-relaties): porque é que uma relação é determinante e como a aplicação calcula a data de início de uma tarefa.
- [Caminho crítico e folga](docs://uitleg-kritiek-pad): qual a cadeia que determina o fim do projeto.
- [Adicionar relações](docs://howto-relaties-leggen): como adicionar uma relação se lhe faltar uma ligação no caminho.
