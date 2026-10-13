# Escolher uma regra de trabalho

Objetivo: definir, por tarefa, o que a aplicação ajusta quando altera a duração, as unidades ou o trabalho: a própria duração, as unidades ou o trabalho.

## Quando precisa disto

Já atribuiu recursos a uma tarefa e quer que a aplicação calcule da forma como o faz. Um exemplo: a grua é alugada por um dia e esse dia é fixo. Outro exemplo: sabe que há 160 horas de alvenaria e quer ver quanto tempo demora com três pessoas em vez de duas. Estas duas situações precisam de regras de trabalho diferentes.

A regra decide qual das três grandezas (duração, unidades e trabalho) acompanha a alteração quando muda outra. O contexto e os exemplos resolvidos estão em [Regras de trabalho: duração, unidades e trabalho](docs://uitleg-werkregels).

## Passos

### Mostrar a regra de trabalho

A regra de trabalho não aparece por padrão. Ative-a uma só vez:

1. Escolha *Definições › Projeto › Definições*, separador *Planeamento*.
2. No grupo *Cálculo*, marque *Mostrar regras de trabalho e trabalho*.
3. Feche a janela com *Fechar*.

Esta é uma definição da aplicação, não do ficheiro do projeto. Se um ficheiro já contiver regras de trabalho ou trabalho guardado, como um ficheiro do MS Project ou do Primavera P6, a aplicação mostra a regra de trabalho desse ficheiro, mesmo sem esta definição. O mesmo acontece assim que escolhe uma regra de trabalho num ficheiro: a visualização fica então ativa para esse ficheiro, mesmo que volte a desligar a definição. Fica ativa enquanto o ficheiro estiver aberto e, depois de reabrir, enquanto o ficheiro contiver uma regra de trabalho ou trabalho guardado.

### Escolher uma regra

1. Selecione a tarefa. O painel *Propriedades* está à direita; se não o vir, ative-o com *Visualização › Painéis › Propriedades*.
2. Em *Regra de trabalho*, escolha uma das cinco opções: *Predefinição do projeto (Duração e unidades fixas)*, *Duração e unidades fixas*, *Duração e trabalho fixos*, *Trabalho fixo* ou *Unidades fixas*. Com *Predefinição do projeto*, a tarefa segue a predefinição do projeto.
3. Por baixo da lista pendente, a aplicação mostra o que a regra protege, por exemplo *Protegido: trabalho (a duração segue as unidades)*.

*Predefinição do projeto* é a primeira opção e é o que uma tarefa tem por padrão. A regra entre parênteses é a que o projeto tem atualmente como predefinição. A aplicação não tem nenhum botão para alterar essa predefinição do projeto: ela vem de uma importação (por exemplo, do MS Project ou do Primavera P6) ou da ligação MCP. Se quiser outra regra para uma tarefa, escolha-a aqui.

Também pode escolher a regra na tabela. Clique no **+** à direita do cabeçalho da tabela de tarefas (*Adicionar coluna*) e, em *Planeamento*, escolha a coluna *Regra de trabalho*.

Uma tarefa sem atribuição não tem nada para ligar, por isso a regra não tem efeito nela. Atribua primeiro um recurso (veja [Atribuir recursos com uma curva](docs://howto-resource-toewijzen)).

### Ver e alterar o trabalho

Para uma tarefa com atribuições, aparece uma coluna *Trabalho (rest.)* no bloco *Atribuições* do painel *Propriedades*, ao lado de *Unid./dia*. É o trabalho restante desse recurso, em horas. Um pequeno cadeado sobre uma coluna mostra o que a regra mantém: *Unid./dia* com *Duração e unidades fixas* e com *Unidades fixas*, *Trabalho (rest.)* com *Duração e trabalho fixos* e com *Trabalho fixo*.

Se quiser alterar o trabalho, introduza as horas no campo e prima Enter. A aplicação não aceita um valor de 0 ou menos: o campo volta ao valor anterior.

### Ver o que acontece

Se escolher uma regra, ainda nenhum número muda. Com uma regra que protege o trabalho, a aplicação fixa apenas o trabalho atual, por isso *Trabalho (rest.)* tem um valor guardado. Só na alteração seguinte é que a regra decide o que acompanha a mudança. Altere, por exemplo, *Unid./dia* e veja o que acontece à duração e ao trabalho.

Se isso alterar a duração da tarefa, a barra de estado mostra *Desatualizado — recalcule (F5)*. Prima **Calcular** (F5), por exemplo em *Início › Agendamento › Calcular*, para ver as novas datas. Se *Calcular automaticamente* estiver ativo (no mesmo separador *Planeamento*, grupo *Cálculo*), a aplicação faz isto por si.

## Qual regra convém

- **Duração e unidades fixas** convém quando a duração é um acordo e as unidades são a sua entrada. O trabalho resulta destas duas. É o valor por padrão. A grua alugada por um dia pertence aqui: o dia é fixo e decide quantas gruas há nele.
- **Duração e trabalho fixos** convém quando a tarefa tem de terminar dentro de um prazo fixo e sabe quanto trabalho contém. Se a duração mudar, a aplicação ajusta as unidades.
- **Trabalho fixo** convém quando sabe quantas horas de trabalho tem e quer ver como a duração muda com o número de pessoas. As 160 horas de alvenaria com três pessoas em vez de duas pertencem aqui. O reboco do projeto de prática usa esta regra.
- **Unidades fixas** convém quando as unidades são fixas, por exemplo uma grua, e o trabalho decide a duração.

## Erros comuns e o que a aplicação faz nesse caso

**Falta o campo *Regra de trabalho*.** Nesse caso, a definição *Mostrar regras de trabalho e trabalho* está desligada e o ficheiro ainda não tem regras de trabalho, ou selecionou um marco, uma fase, um hammock ou uma tarefa com o tipo de duração *Tempo decorrido*. Ali não há regra de trabalho. Selecione uma tarefa normal.

**A duração muda sem que a altere.** Com *Trabalho fixo* e *Unidades fixas*, a duração resulta das unidades e do trabalho. Se alterar uma destas grandezas ou o número de recursos, a aplicação ajusta a duração, arredondada para cima até dias úteis inteiros. Numa tarefa em horas, a aplicação arredonda para cima até minutos inteiros.

**O trabalho não coincide exatamente com unidades × duração.** O arredondamento pode causar isso. Ao lado de *Trabalho (rest.)* aparece então um sinal de aviso, *Difere de unidades × duração*. O histograma segue o trabalho guardado.

**O material não conta.** Para um recurso de material, *Trabalho (rest.)* mostra um traço. O material nunca determina a duração.

**Uma tarefa com progresso.** A regra atua sobre a parte restante. Por isso, *Trabalho (rest.)* mostra apenas o que ainda tem de acontecer.

**Anular uma alteração.** Escolher uma regra, e cada alteração que a regra calcula, é um só passo para *Desfazer* (Ctrl+Z). A regra deixa então de estar aplicada, mas o campo *Regra de trabalho* continua visível.

## Ver também

- [Regras de trabalho: duração, unidades e trabalho](docs://uitleg-werkregels): como a aplicação liga a duração, as unidades e o trabalho, com exemplos resolvidos.
- [Atribuir recursos com uma curva](docs://howto-resource-toewijzen): colocar um recurso numa tarefa.
