# Restrições e prazos

Os tijolos só são entregues a 21 de junho. A licença ainda não chegou. O telhado tem de estar fechado antes das férias da construção. As relações registam que uma tarefa espera por outra tarefa, mas os acordos sobre uma data não resultam da ordem do trabalho. Para isso servem as restrições e os prazos. Neste artigo fica a saber o que faz cada tipo, quando uma tarefa se desloca e quando só muda a folga, o que é uma fixação rígida e como a aplicação comunica um conflito.

As regras e os exemplos aplicam-se a um projeto novo, com o perfil de cálculo *Open Planner Studio* e uma semana de trabalho de segunda a sexta-feira.

## O conceito

Uma **restrição** é um limite de data para uma única tarefa, independente das relações da tarefa. Este limite pode funcionar de duas formas:

- **Empurra**: a tarefa não pode começar nem terminar antes da data. Se a tarefa começar mais cedo por causa das suas relações, passa para a data.
- **Vigia**: a tarefa tem de começar ou terminar na data, o mais tardar. A aplicação não move nada. Se o planeamento não cumprir a data, a **folga** da tarefa, e da cadeia antes dela, fica negativa. A folga é o espaço que uma tarefa tem antes de a data de fim do projeto se deslocar. Negativa significa que, no papel, já está atrasado (ver [Caminho crítico e folga](docs://uitleg-kritiek-pad)).

Um **prazo** é uma forma mais simples de vigiar: uma data-alvo para o fim de uma tarefa, sem que a tarefa seja movida por nada.

Todas as restrições são **flexíveis**: o cálculo continua, mesmo que uma data não seja cumprida. Há uma exceção, a **fixação rígida**, que anula as relações. Mais sobre isso abaixo.

## Como a aplicação calcula

### Os oito tipos

Escolha o tipo em *Restrição* no painel *Propriedades*. Eis como calcula cada tipo:

- *O mais cedo possível (ASAP)*: sem limite. Este é o padrão: a tarefa começa logo que as relações o permitam.
- *O mais tarde possível (ALAP)*: a tarefa move-se o mais tarde possível, sem que uma sucessora tenha de começar mais tarde. Por isso usa a sua folga livre. Se ainda tiver folga total depois disso, porque as suas sucessoras têm margem própria, continua não crítica. Se também essa folga se esgotar, fica crítica.
- *Não começar antes de (SNET)*: limite inferior para o início. Se a tarefa começar mais cedo, passa para a data. Se a data for anterior ao que as relações permitem, a restrição não faz nada.
- *Não terminar antes de (FNET)*: o mesmo, mas para o fim da tarefa.
- *Não começar depois de (SNLT)* e *Não terminar depois de (FNLT)*: limite superior para o início ou para o fim. Não movem nada. Se o limite não for cumprido, a aplicação comunica uma restrição violada e a folga fica negativa.
- *Deve começar em (MSO)* e *Deve terminar em (MFO)*: limite inferior e superior ao mesmo tempo. A tarefa passa para a data se esta for mais tarde do que as relações exigem. Se a data for anterior ao que as relações permitem, a tarefa fica onde as relações a põem, e a folga fica negativa.

Se uma data cair num sábado, domingo ou dia não útil, a aplicação lê-a como dia útil: um limite inferior (SNET, FNET) como o dia útil seguinte, um limite superior (SNLT, FNLT) como o dia útil anterior.

### O que significa folga negativa

Um limite superior trabalha ao contrário. Se a restrição puser a data mais tardia de uma tarefa a data mais tardia de uma tarefa antes da data antecipada, a folga total fica negativa. O mesmo vale para as tarefas anteriores: se a alvenaria tiver de começar, o mais tardar, na sexta-feira, 11 de junho, e não puder começar antes de segunda-feira, 14 de junho, as tarefas anteriores ao brickwork também ficam um dia útil atrasadas. Todas as tarefas com folga negativa são críticas; o funcionamento está explicado em [Caminho crítico e folga](docs://uitleg-kritiek-pad).

As barras não se movem por causa de um limite superior. O conflito vê-se na *Folga total* negativa, num losango vermelho acima da barra, no aviso na barra de estado (por exemplo, *1 restrição(ões) violada(s)*) e no painel *Avisos*.

### A fixação rígida

Com MSO e MFO aparece a caixa de verificação *Obrigatório (fixação de data)*. Ao marcá-la, fixa a tarefa na data, mesmo que as suas predecessoras ainda não estejam concluídas até essa data. As relações ficam anuladas:

- A tarefa fica na data (com MSO começa aí, com MFO termina aí) e sobrepõe-se às suas predecessoras.
- As predecessoras ficam com folga negativa. A aplicação comunica uma restrição violada assim que as relações permitam que a tarefa comece mais tarde do que a fixação. A própria tarefa fixada mantém folga 0.
- As sucessoras calculam a partir da tarefa fixada. Por isso podem começar mais cedo do que sem a fixação, mesmo que a lógica anterior ainda não esteja concluída. No exemplo abaixo, o fim do projeto avança três dias úteis por causa disso.

Na primeira vez que ativa a fixação, a aplicação mostra uma breve explicação: uma fixação rígida anula as relações, a barra fica fixa na data, mesmo antes das suas predecessoras.

### A restrição secundária

Uma tarefa tem uma restrição primária. Se também quiser um segundo limite, por exemplo uma tarefa que não pode começar antes de 14 de junho e tem de estar concluída até 17 de junho, acrescenta uma **restrição secundária**. Tem de ser um limite real (SNET, FNET, SNLT ou FNLT) e tem de limitar no sentido oposto ao da primária: um limite inferior (SNET ou FNET) com um limite superior (SNLT ou FNLT). SNET com SNLT é, portanto, permitido. SNET com FNET não é. A aplicação assinala com vermelho as outras combinações, com o motivo, por exemplo *As restrições primária e secundária não podem limitar o mesmo lado.* Com ASAP, ALAP, MSO, MFO e uma fixação rígida não é permitida uma restrição secundária.

### O prazo

Um prazo é uma data separada numa tarefa, ao lado da restrição. É um limite superior para o fim: não move nada, mas torna a folga negativa se a tarefa não terminar a tempo. A aplicação comunica então, no painel *Avisos*, *Prazo … ultrapassado — fim antecipado …*, e a barra de estado conta os prazos ultrapassados. No Gantt há uma seta para baixo na data do prazo: verde enquanto a tarefa termina a tempo, vermelha assim que está atrasada. Um prazo num sábado conta até à sexta-feira anterior, inclusive.

Para a folga, um prazo faz o mesmo que um FNLT. A diferença está na forma de o usar. Um prazo é uma data-alvo que quer vigiar. Fica separado da restrição, por isso uma tarefa pode ter uma restrição e um prazo. O FNLT é uma restrição: uma violação aparece como restrição violada, e não como prazo ultrapassado.

### O que uma restrição não faz

- Numa **fase** (tarefa de resumo) uma restrição ou um prazo não conta: a aplicação calcula com as tarefas da fase. Coloque-o na própria tarefa.
- Uma tarefa que já tem um início real ou progresso mantém esse início. Um SNET com data posterior não a move.
- **Introduzir uma data de início** numa tarefa com predecessora não funciona como início fixo: a predecessora continua a decidir. Por isso a aplicação transforma-a num SNET na data que introduziu, no painel *Propriedades*, em *Editar tarefa*, na tabela e quando move a barra no Gantt. A aplicação avisa-o. Se a tarefa já tiver outra restrição (por exemplo ALAP ou MSO), a aplicação não aplica o novo início e também o indica. Nesse caso, altere essa restrição.

As alterações só aparecem depois de **Calcular** (F5).

## Exemplo trabalhado

O exemplo é uma pequena rede para uma ampliação de casa. Começa na segunda-feira, 7 de junho de 2027:

- *Groundwork* (3 dias úteis): de segunda-feira, 7, a quarta-feira, 9 de junho.
- *Pour foundation* (2): quinta-feira, 10, e sexta-feira, 11 de junho.
- *Brickwork* (5): de segunda-feira, 14, a sexta-feira, 18 de junho.
- *Roofing* (3): de segunda-feira, 21, a quarta-feira, 23 de junho.
- *Scaffolding* (2): segue *Pour foundation* e vem antes de *Roofing*. Decorre na segunda-feira, 14, e na terça-feira, 15 de junho, e tem 3 dias úteis de folga.

O caminho crítico é *Groundwork*, *Pour foundation*, *Brickwork* e *Roofing*. O projeto termina na quarta-feira, 23 de junho. O que muda com uma restrição em *Brickwork*?

- **SNET segunda-feira, 21 de junho** (os tijolos só chegam nessa data): *Brickwork* decorre de segunda-feira, 21, a sexta-feira, 25 de junho, e *Roofing* de segunda-feira, 28, a quarta-feira, 30 de junho. O projeto termina na quarta-feira, 30 de junho. *Groundwork* e *Pour foundation* passam a ter 5 dias úteis de folga e deixam de ser críticas. *Scaffolding* tem 8.
- **SNET quarta-feira, 9 de junho**: sem efeito. As relações só deixam *Brickwork* começar na segunda-feira, 14 de junho, de qualquer modo.
- **SNLT quarta-feira, 16 de junho**: sem efeito. *Brickwork* começa na segunda-feira, 14 de junho e cumpre o limite com folga.
- **SNLT sexta-feira, 11 de junho**: apertado demais. *Brickwork* continua a começar na segunda-feira, 14 de junho, com um dia útil de atraso. *Groundwork*, *Pour foundation* e *Brickwork* ficam com −1 dia útil de folga, e a aplicação comunica *A restrição Não começar depois de (SNLT) 11-06-2027 é ultrapassada pela lógica (folga negativa)*. Nada se move.
- **MSO quarta-feira, 16 de junho** (sem fixação rígida): *Brickwork* passa para quarta-feira, 16 de junho e termina na terça-feira, 22 de junho. *Roofing* decorre de quarta-feira, 23, a sexta-feira, 25 de junho. O projeto termina na sexta-feira, 25 de junho.
- **MSO sexta-feira, 11 de junho** (sem fixação rígida): a data é anterior ao que as relações permitem. *Brickwork* começa, de qualquer modo, na segunda-feira, 14 de junho, e a folga fica −1, tal como com SNLT.
- **MSO quarta-feira, 9 de junho** com fixação rígida: *Brickwork* começa na quarta-feira, 9 de junho e termina na terça-feira, 15 de junho, enquanto *Pour foundation* ainda decorre até sexta-feira, 11 de junho. *Roofing* decorre de quarta-feira, 16, a sexta-feira, 18 de junho: o projeto termina três dias úteis mais cedo do que sem a fixação. *Groundwork* e *Pour foundation* ficam com −3 dias úteis de folga.

E com uma restrição ou um prazo noutra tarefa:

- **ALAP em** *Scaffolding*: a tarefa move-se para quinta-feira, 17, e sexta-feira, 18 de junho, o momento mais tardio antes de *Roofing*. *Roofing* é a sua única sucessora e tinha espaço para exatamente os seus 3 dias úteis de folga. Esse espaço fica agora esgotado, e *Scaffolding* é crítica.
- **SNET sábado, 19 de junho** em *Scaffolding*: o limite conta como segunda-feira, 21 de junho. *Scaffolding* decorre na segunda-feira, 21, e na terça-feira, 22 de junho, e *Roofing* passa a decorrer de quarta-feira, 23, a sexta-feira, 25 de junho.
- **Prazo sexta-feira, 18 de junho** em *Roofing*: nada se move, *Roofing* fica de segunda-feira, 21, a quarta-feira, 23 de junho. *Groundwork*, *Pour foundation*, *Brickwork* e *Roofing* ficam com −3 dias úteis de folga, e a aplicação comunica *Prazo 18-06-2027 ultrapassado — fim antecipado 23-06-2027*. *Scaffolding* fica com 0 dias úteis de folga e também fica crítica.
- **SNET segunda-feira, 21 de junho** em *Brickwork*, **prazo sexta-feira, 25 de junho** em *Roofing*: a restrição empurra o brickwork uma semana para trás, e o prazo indica que *Roofing* está atrasada na quarta-feira, 30 de junho. *Brickwork* e *Roofing* ficam com −3 dias úteis de folga. *Groundwork* e *Pour foundation* mantêm 2 dias úteis.

No tutorial 3, defina uma restrição e um prazo no projeto do tutorial e veja como o planeamento se desloca.

## Consequências e ideias erradas

**«Uma restrição move a tarefa.»** Só SNET, FNET, MSO e MFO podem pôr uma tarefa mais tarde do que as suas relações, e ALAP pode deslocá-la para mais tarde, dentro da sua folga livre. SNLT e FNLT nunca movem nada: apenas avisam. Cumprir a data significa, então, encurtar a cadeia anterior.

**«Folga negativa é uma falha da aplicação.»** É o sinal de que o planeamento entra em conflito com o acordo de datas. Resolve-o encurtando a cadeia, flexibilizando o acordo ou aceitando o conflito de propósito.

**«Uma fixação rígida resolve o conflito.»** Uma fixação rígida esconde o conflito: a tarefa está na data, mas as suas predecessoras não estão prontas para ela, e as sucessoras calculam como se estivessem. Use-a apenas para uma data que está mesmo fixada, como uma data legal de entrega, e não como forma de pôr uma tarefa numa data.

**«Basta introduzir uma data de início.»** Numa tarefa com predecessora, a data torna-se um SNET. Se essa data for anterior ao que a predecessora permite, não faz nada.

**«Prazo ou FNLT?»** Escolha um prazo para uma data-alvo que quer vigiar, e uma restrição para uma data que é, de facto, uma condição-limite para o planeamento.

**«Uma restrição na fase.»** Isso não conta. Coloque-a na própria tarefa.

## Ver também

- [Definir uma restrição ou um prazo](docs://howto-constraint-deadline-zetten): os passos para definir uma restrição ou um prazo.
- [Relações e desfasamento](docs://uitleg-relaties): as relações com que as restrições convivem.
- [Caminho crítico e folga](docs://uitleg-kritiek-pad): como surge a folga negativa e o que faz ao caminho crítico.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): uma fixação rígida (*Deve começar em (MSO)*) em *Municipal road closure (permitted closure period)* e uma restrição secundária (*Não começar depois de (SNLT)*) em *Lift supply & installation — Tower A*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): um prazo que não é cumprido, com folga negativa.
