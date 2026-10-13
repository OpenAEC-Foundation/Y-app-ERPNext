# Criar um hammock

Objetivo: criar uma tarefa que não conhece a sua própria duração, mas que vai do início de uma tarefa até ao fim de outra, como a preparação do estaleiro, a fiscalização ou o aluguer de um contentor de estaleiro.

## Quando precisa disto

O contentor de estaleiro fica ali durante todo o tempo em que a obra decorre, desde os primeiros trabalhos de terraplenagem até à entrega. Se atribuir a essa tarefa uma duração fixa de 13 dias úteis, ela não acompanha o atraso da alvenaria, e o planeamento deixa de estar correto. Um **hammock** (também chamado *nível de esforço*) segue a tarefa à qual o liga: o seu início vem de uma relação de início, o seu fim de uma relação de fim, e a sua duração é a diferença entre os dois.

## Passos

1. Crie a tarefa, por exemplo *Site cabin*, ou selecione uma tarefa existente. Um marco e uma tarefa de resumo (fase) não podem ser um hammock; no painel *Propriedades* e em *Editar tarefa* falta a caixa de verificação para essa tarefa, e na coluna da tabela não pode ser alterada.
2. Marque *Hammock (duração derivada)* no painel *Propriedades*, em *Editar tarefa* (clique com o botão direito na tarefa, *Editar...*) ou na coluna da tabela *Hammock (duração derivada)* em *Planeamento*. O campo *Duração* deixa então de poder ser editado.
3. Adicione uma relação da tarefa com que o hammock começa para o hammock, do tipo **SS** (o hammock começa juntamente com essa tarefa) ou **FS** (o hammock começa depois dessa tarefa). Para isso, selecione o hammock, clique em *Adicionar relação* em *Dependências*, deixe a direção em *Predecessora*, escolha a tarefa e escolha o tipo. Os passos estão em [Adicionar relações](docs://howto-relaties-leggen).
4. Adicione uma relação da tarefa com que o hammock termina para o hammock, do tipo **FF** (o hammock termina juntamente com essa tarefa) ou **SF**.
5. Veja no painel *Propriedades*, em *Hammock (duração derivada)*: aí vê o *Driver de início* com a tarefa e o tipo, e o *Driver de fim* com a tarefa e o tipo. Um driver é uma tarefa da qual o hammock toma o início ou o fim.
6. Carregue em **Calcular** (F5), por exemplo através de *Início › Agendamento › Calcular*. O hammock passa a ir do início do driver de início até ao fim do driver de fim, e *Duração* mostra a duração derivada.

No Gantt, um hammock é uma barra fina azul-petróleo com um gancho em cada extremidade.

Exemplo: *Site cabin* recebe SS de *Groundwork* (segunda-feira 7 de junho de 2027) e FF de *Roofing* (concluída a quarta-feira 23 de junho). Depois de **Calcular**, o hammock vai de segunda-feira 7 a quarta-feira 23 de junho: 13 dias úteis. Se a alvenaria atrasar 2 dias úteis, o fim de *Roofing* passa para sexta-feira 25 de junho e o hammock acompanha, passando a 15 dias úteis.

## O que a aplicação faz com um hammock

- O hammock nunca é crítico e não tem folga. Também não restringe as tarefas das quais toma o início e o fim: por causa do hammock, estas não recebem nenhuma data mais tardia.
- O desfasamento conta. Com SS e desfasamento `1d`, o hammock começa um dia útil depois do driver de início; com FF e desfasamento `2d`, termina dois dias úteis depois do driver de fim.

## Armadilhas e o que a aplicação faz

**Sem driver de fim.** Se o hammock não tiver uma relação FF ou SF, a aplicação não consegue derivar o seu fim. O painel *Propriedades* indica *Sem driver de fim (FF/SF) — o intervalo volta a comprimento zero.* e o painel *Avisos* indica *Hammock sem driver de fim (sem predecessor FF/SF): a duração volta a zero*. O hammock então começa e termina no mesmo dia. Adicione uma relação FF ou SF.

**Um hammock que termina depois da última tarefa.** Se o hammock continuar até depois da última tarefa, por exemplo com FF e um desfasamento de 2 dias úteis, a data de fim do projeto move-se com ele. As tarefas que realmente executa recebem então folga; nenhuma delas deixa de ser crítica.

**Tarefas que esperam por um hammock.** Se adicionar uma relação do hammock para outra tarefa, essa tarefa só começa depois do fim do hammock. Toda a cadeia que precede o hammock, incluindo as tarefas das quais o hammock toma o início e o fim, recebe então folga e deixa de ser crítica, porque o hammock não transmite pressão de volta. Por isso, não deixe tarefas esperarem por um hammock; prefira ligar essas tarefas ao driver de fim do hammock.

**Introduzir uma duração.** O campo *Duração* de um hammock é derivado e não pode ser editado. Uma duração que tenha introduzido antes de marcar a caixa deixa de contar.

## Ver também

- [Adicionar relações](docs://howto-relaties-leggen): os passos para adicionar uma relação do tipo SS ou FF.
- [Relações e desfasamento](docs://uitleg-relaties): o que significam SS e FF e como o desfasamento conta.
- [Caminho crítico e folga](docs://uitleg-kritiek-pad): o que significa crítico e como funciona a folga.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): contém o hammock *Structural works tower A (LOE)*.
