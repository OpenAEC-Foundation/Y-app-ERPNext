# Definir uma restrição ou um prazo

Objetivo: registar um acordo de data numa tarefa, para que o planeamento o tenha em conta ou mostre que não o cumpre.

## Quando precisa disto

Os tijolos só são entregues a 21 de junho, por isso a alvenaria não pode começar mais cedo: uma **restrição** *não começar antes de*. O telhado tem de estar fechado antes do feriado da construção, e quer ser avisado se isso não correr bem: um **prazo**. A betonagem está fixada num dia porque a central de betão a prometeu: *deve começar em*. Qual tipo serve em cada caso, e o que a aplicação faz com ele, explica-se em [Restrições e prazos](docs://uitleg-constraints).

## Passos

Define uma restrição e um prazo no painel *Propriedades*.

1. Selecione a tarefa. Se não vir o painel *Propriedades*, ative-o em *Visualização › Painéis › Propriedades*.
2. Em *Restrição*, escolha o tipo, por exemplo *Não começar antes de (SNET)*.
3. Com todos os tipos, exceto *O mais cedo possível (ASAP)* e *O mais tarde possível (ALAP)*, aparece o campo *Data da restrição*. Escreva a data nas três caixas para dia, mês e ano, por exemplo 21, 06 e 2027, e prima Enter. A aplicação passa sozinha para a caixa seguinte, logo que uma caixa esteja cheia. Depois de escolher o tipo, já lá está uma data: a da restrição anterior ou, se não houver, o início planeado original da tarefa. Esta data pode ser diferente do início que o painel mostra. Introduza, por isso, sempre a data que pretende.
4. Se quiser fixar a tarefa nessa data, mesmo antes das suas predecessoras, escolha *Deve começar em (MSO)* ou *Deve terminar em (MFO)* e marque *Obrigatório (fixação de data)*. Isto é uma fixação rígida; use-a só para uma data que seja realmente fixa.
5. Se quiser também um segundo limite, por exemplo uma tarefa que não pode começar antes de 14 de junho e tem de terminar até 17 de junho, escolha um tipo em *Restrição secundária* e preencha a *Data secundária*. Este campo aparece com todas as restrições que têm data, exceto com uma fixação rígida. Com MSO e MFO não é permitida uma restrição secundária: a aplicação assinala-a então a vermelho.
6. Para um prazo, preencha o campo *Prazo*, da mesma forma que o campo *Data da restrição*. Um prazo é independente da restrição: pode definir ambos na mesma tarefa.
7. Prima **Calcular** (F5), por exemplo em *Início › Agendamento › Calcular*. Até lá, a barra de estado indica *Desatualizado — recalcule (F5)*.

Os campos também estão na janela *Editar tarefa*, que se abre ao clicar com o botão direito na tarefa e escolher *Editar...*; confirme com *Guardar*.

Na tabela, trabalha-se com colunas. Clique em **+** no cabeçalho da tabela e, em *Restrições*, escolha as colunas *Tipo de restrição*, *Data da restrição* e *Prazo* (há também *Restrição rígida*, *Tipo da restrição secundária* e *Data da restrição secundária*). Faça duplo clique numa célula para a editar: escolha o tipo numa lista e escreva uma data com traços, por exemplo 21-06-2027. *Restrição rígida* só pode ser alterada com MSO e MFO.

Se a tarefa tiver uma predecessora, há um atalho para *Não começar antes de*: basta escrever uma nova data de início no campo *Início* (no painel *Propriedades*, em *Editar tarefa* ou na tabela), ou mover a barra no Gantt. A aplicação transforma-a então, por si, numa restrição *Não começar antes de (SNET)* e informa disso.

## Verificar o resultado

- No Gantt há um pequeno losango acima da barra, do lado do início numa restrição de início e do lado do fim numa restrição de fim: azul para SNET e FNET, violeta para SNLT, FNLT, MSO e MFO, vermelho se a restrição estiver violada. Uma fixação rígida tem um pino. Um prazo é uma seta para baixo na data do prazo: verde enquanto a tarefa estiver concluída a tempo, vermelha se estiver atrasada.
- Uma restrição violada ou um prazo não cumprido aparece no painel *Avisos* (*Planeamento › Agendamento › Avisos*) e na barra de estado. A *Folga total* da tarefa e das tarefas anteriores fica então negativa.
- Com um limite superior (*não começar depois de*, *não terminar depois de*) ou um prazo, a ausência de aviso significa que o planeamento cumpre a data.

## Remover uma restrição ou um prazo

Em *Restrição*, escolha outra vez *O mais cedo possível (ASAP)*. Assim remove também a restrição secundária. Para remover um prazo, esvazie as três caixas e prima Enter. Depois, prima **Calcular**.

## Armadilhas e o que a aplicação faz

**Uma restrição numa fase.** Uma restrição ou um prazo numa fase (tarefa de resumo) não tem efeito. Coloque-o na própria tarefa.

**Uma tarefa que já começou.** Se a tarefa tiver um início real ou progresso, mantém o seu início real. Uma restrição *não começar antes de* com uma data posterior não a move.

**Escrever uma data de início quando já há outra restrição.** Se a tarefa tiver uma predecessora e já tiver outra restrição, por exemplo *O mais tarde possível (ALAP)*, a aplicação não aplica o início escrito. Uma mensagem indica a restrição; altere essa restrição se quiser mover o início.

**Uma data no fim de semana.** Uma data num sábado, domingo ou feriado conta como dia útil: um limite inferior (*não começar antes de*, *não terminar antes de*) passa para o dia útil seguinte, um limite superior (*não começar depois de*, *não terminar depois de*) para o dia útil anterior.

**Uma restrição secundária não permitida.** A aplicação assinala uma combinação inválida a vermelho, com o motivo, por exemplo *As restrições primária e secundária não podem limitar o mesmo lado.* Não é permitida uma restrição secundária com ASAP, ALAP, MSO, MFO nem com uma fixação rígida.

**Uma fixação rígida.** Na primeira vez que a ativa, a aplicação avisa que uma fixação rígida substitui as relações. A tarefa fica então na data, mesmo antes das suas predecessoras; essas predecessoras ficam com folga negativa.

**Nada muda depois de a definir.** As restrições só funcionam depois de **Calcular**. Se um limite superior (*não começar depois de*, *não terminar depois de*) não tiver efeito nas barras, isso é normal: um limite superior não move nada; torna a folga negativa se a data não for cumprida.

## Ver também

- [Restrições e prazos](docs://uitleg-constraints): o que faz cada tipo, e a explicação de fixação rígida, folga negativa e prazo.
- [Caminho crítico e folga](docs://uitleg-kritiek-pad): o que a folga negativa faz ao caminho crítico.
- [Relações e desfasamento](docs://uitleg-relaties): as relações que estão ao lado de uma restrição.
- [Notificações e avisos](docs://ref-meldingen): os avisos para uma restrição violada ou um prazo não cumprido.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): uma restrição de licença *não começar antes de* em *Demolish existing extension* (14 de maio de 2027) e um prazo que é cumprido com alguma margem.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): um prazo propositadamente apertado em *Contractual project handover* (15 de julho de 2027): depois de calcular, o fim fica a 17 de agosto e muitas tarefas têm folga negativa.
