# Relações externas com outro projeto

Objetivo: vincule uma tarefa deste projeto a uma tarefa de outro ficheiro de projeto, para que o seu planeamento tenha em conta o trabalho planeado noutro sítio.

## Quando precisa disto

A sua ampliação só pode começar quando o terreno estiver preparado para a obra, e esse trabalho está no projeto do empreiteiro. Ou o instalador só pode começar quando a sua estrutura estiver concluída, e ele planeia no seu próprio ficheiro. Uma relação normal só funciona entre tarefas do mesmo projeto. Uma **relação externa** vincula uma tarefa a uma tarefa de outro ficheiro.

Uma relação externa não calcula em tempo real com o outro projeto. A aplicação guarda uma **data de ancoragem** fixa: a data da tarefa externa no momento em que a vincula. O cálculo usa essa data como limite. Se o outro projeto mudar, nada se move no seu até atualizar a data de ancoragem.

## Passos

1. Selecione exatamente uma tarefa deste projeto: a tarefa que depende da tarefa externa, ou da qual a tarefa externa depende.
2. Escolha *Início › Tarefas › Vincular ▾ › Adicionar relação externa…*. O mesmo menu está em *Planeamento › Relações* e em *Tabela › Tarefas*. O item só fica disponível se estiver selecionada exatamente uma tarefa.
3. Na janela *Relação externa (entre projetos)*, escolha um dos dois caminhos. Com *Ficheiro de origem*, escolha o ficheiro de projeto em *Escolher um ficheiro recente* e depois a *Tarefa de origem*. A aplicação lê o ficheiro em só leitura. Não o abre como documento, e obtém ela própria a data de ancoragem. Este caminho só funciona na aplicação de secretária e só para um ficheiro da lista de ficheiros recentes. Caso contrário, o botão *Ficheiro de origem* fica desativado. Com *Manual (alternativa)*, preencha o *Id de projeto* e o *Id de tarefa* da tarefa externa, opcionalmente um *Nome da tarefa (opcional)*, e a *Data de ancoragem*. Na versão para navegador, este é o único caminho.
4. Em *Direção*, escolha se a tarefa externa é a sua predecessora ou a sua sucessora: *Predecessora (externa → eu)* ou *Sucessora (eu → externa)*.
5. Escolha o *Tipo de relação* (FS, SS, FF ou SF). Se necessário, preencha um *Atraso (dias úteis)*, por exemplo `0d` ou `2d`.
6. Clique em *Adicionar ligação* e prima **Calcular** (F5).

A data que introduz como data de ancoragem numa relação manual depende da direção e do tipo:

- Com uma **predecessora** externa, conta a primeira letra do tipo: F é a data de fim da tarefa externa, S a data de início. Com FS e FF, introduz, por isso, o fim. Com SS e SF, introduz o início.
- Com uma **sucessora** externa, conta a segunda letra: S é a data de início da tarefa externa, F a data de fim. Com FS e SS, introduz, por isso, o início. Com FF e SF, introduz o fim.

Se planeia em horas (com o planeamento por horas ativo e uma tarefa num calendário com tempos de trabalho), o campo *Data de ancoragem* também pede uma hora.

Exemplo: o projeto do terreno termina na sexta-feira, 18 de junho de 2027. Vincula *Groundwork* a uma predecessora externa do tipo FS, com data de ancoragem 18 de junho de 2027. Depois de **Calcular**, o groundwork começa na segunda-feira, 21 de junho, o primeiro dia útil depois da data de ancoragem. Uma sucessora externa funciona ao contrário: limita até quando a sua tarefa pode terminar.

## O que vê e como o gere

- As relações externas aparecem como texto nas colunas *Predecessoras* e *Sucessoras* da tabela de tarefas. Acrescente-as com o **+** no cabeçalho da tabela, em *Relações*. Aparecem com o nome do projeto, o nome da tarefa e o tipo. Um pequeno triângulo com *Origem em falta* mostra que a origem ainda não foi lida. Passe o rato sobre a relação para ver o projeto (a linha *Id de projeto* mostra o nome do projeto assim que for conhecido), o ID da tarefa, a data de ancoragem e o estado da origem.
- No Gantt, há uma barra fantasma cinzenta na tarefa. Com uma predecessora externa, a barra termina na data de ancoragem. Com uma sucessora externa, começa nela. Uma moldura tracejada com a etiqueta vermelha *obsoleto* significa que a origem ainda não foi lida. Com uma relação manual, isso acontece sempre.
- Clique com o botão direito numa relação na coluna. Aparecem *Editar relação externa…* e *Eliminar relação*. Se a relação tiver um ficheiro de origem, também aparece *Atualizar origem*.
- Escolha *Vincular ▾ › Atualizar todas as relações externas* para ler outra vez os ficheiros de origem e atualizar as datas de ancoragem. Isso só funciona na aplicação de secretária. Se tiver apenas relações manuais, a aplicação mostra *Sem fontes externas atualizáveis (caminho do ficheiro em falta).* Prima **Calcular** depois de atualizar.
- Se altera o tipo ou a direção de modo que a data de ancoragem precise do outro lado da tarefa externa (início em vez de fim, ou o contrário), a aplicação pede uma nova data de ancoragem numa relação manual: *Escolha uma nova âncora: o tipo de relação agora usa o outro lado da tarefa de origem*. Com uma relação que tem ficheiro de origem, a aplicação volta a ler a data de ancoragem por si própria.

## Armadilhas e o que a aplicação faz

**O outro projeto não se move junto.** Se a tarefa externa mudar de data, o seu planeamento continua a calcular com a data de ancoragem antiga, até atualizar ou alterar a data de ancoragem. Com o caminho manual, altere a data de ancoragem por si, clicando com o botão direito na relação e escolhendo *Editar relação externa…*.

**Uma predecessora externa é um limite inferior.** Se a sua tarefa começar mais tarde do que a data de ancoragem exige, por causa das suas próprias predecessoras, essa relação prevalece. A data de ancoragem só empurra.

**Uma sucessora externa é um limite superior.** Se a data de ancoragem for demasiado apertada, a sua tarefa e as tarefas anteriores mostram folga negativa. Não aparece nenhum aviso separado. Por isso, acompanhe a coluna *Folga total*.

**Só um desfasamento fixo.** Numa relação externa não pode indicar um desfasamento em dias de calendário nem em percentagens. A aplicação mostra *As relações externas só suportam um atraso fixo em dias ou tempo de trabalho.* Os dias úteis contam no calendário da sua tarefa. Um desfasamento em horas só conta numa tarefa planeada em horas. Numa tarefa em dias, o cálculo ignora-o. Utilize então dias úteis.

**O Id de projeto de outro ficheiro.** O Id de projeto não está num campo nem numa coluna. Fica guardado como `InternalProjectId` no IFC desse projeto: abra o projeto, vá ao separador *IFC* e escolha *Gerar IFC*. O cálculo usa só a data de ancoragem. O id não é uma simples etiqueta. Ao atualizar, a aplicação reconhece primeiro um ficheiro de origem pelo Id de projeto, e depois pelo caminho do ficheiro. Se introduzir, numa relação manual, o mesmo id de um ficheiro de origem, a relação é atualizada em conjunto quando esse ficheiro for atualizado. O ID de uma tarefa do outro projeto encontra-se na tabela desse projeto, na coluna *ID da tarefa*, em *Técnico*.

## Ver também

- [Relações e desfasamento](docs://uitleg-relaties): como a aplicação calcula uma relação e um desfasamento.
- [Adicionar relações](docs://howto-relaties-leggen): relações entre tarefas do mesmo projeto.
- [Restrições e prazos](docs://uitleg-constraints): limites de datas numa tarefa, sem outro projeto.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): contém uma relação externa em *Car park paving* (uma predecessora externa).
