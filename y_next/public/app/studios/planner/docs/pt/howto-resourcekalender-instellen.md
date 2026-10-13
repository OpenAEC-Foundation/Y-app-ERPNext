# Configurar um calendário de recurso

Objetivo: registar em que dias um recurso está disponível, para que o histograma, a sobrealocação e o nivelamento calculem com ele.

## Quando precisa disto

A equipa de alvenaria trabalha só de segunda a quinta-feira. A grua está noutro projeto nas primeiras duas semanas de agosto. Um subempreiteiro tem quatro dias úteis fixos. Sem um calendário próprio, a aplicação assume que o recurso trabalha nos dias do calendário do projeto.

Um calendário de recurso não altera nenhuma data de tarefa. Só determina quando o recurso está disponível. Se uma tarefa trabalhar num dia em que o recurso não trabalha, a capacidade desse dia é 0 e o dia conta como sobrealocado. Se quiser que a própria tarefa decorra noutros dias, dê-lhe um calendário próprio ([Criar e atribuir um calendário](docs://howto-kalender-maken-en-toewijzen)). A diferença está descrita em [Calendários e dias úteis](docs://uitleg-kalenders).

## Passos

### Criar um novo calendário de recurso

1. Escolha *Recursos › Gerir › Recursos*. Abre-se o painel de recursos. Se o recurso ainda não existir, crie-o com *Novo recurso no projeto*.
2. Encontre a linha do recurso. Na coluna *Calendário*, o padrão é *Calendário do projeto*: o recurso segue então o calendário do projeto.
3. Nessa lista, escolha *+ Calendário do recurso*. Abre-se a janela *Calendário do recurso*. Tem os mesmos campos do formulário de calendário: *Nome*, *Dias de trabalho*, os tempos de trabalho e os *Feriados*. O novo calendário começa como cópia do calendário padrão e chama-se *Calendário do recurso*.
4. Dê ao calendário um nome que corresponda ao recurso, por exemplo *Crew Mon–Thu*, e defina os dias úteis: em *Dias de trabalho*, clique em sexta-feira para a desmarcar. Coloque feriados ou paragens na lista *Feriados* com *Adicionar feriado*.
5. Clique em *Aplicar*. O calendário fica agora na biblioteca de recursos do projeto e ligado ao recurso, num só passo que pode anular com *Desfazer*. Com *Cancelar* não se cria nada.

### Escolher ou ajustar um calendário existente

Na coluna *Calendário*, escolha um calendário da lista. *Calendário do projeto* remove outra vez o calendário próprio. Se quiser ajustar o calendário escolhido, clique no lápis ao lado da lista (*Editar…*). Abre-se a janela *Calendário do recurso* com o calendário atual.

### Verificar o resultado

1. Se a barra de estado indicar *Desatualizado — recalcule (F5)*, prima **Calcular** (F5).
2. Escolha *Recursos › Histograma › Histograma* e clique no recurso na lista à esquerda do histograma. Os dias em que o recurso não trabalha, mas está planeado, são vermelhos. Se passar o rato sobre um deles, a dica indica, por exemplo, *Não trabalha neste dia segundo o calendário "Crew Mon–Thu"*.
3. Em *Recursos › Superalocação* está o número de recursos sobrealocados, e a barra de estado indica, por exemplo, *1 recurso(s) sobrealocado(s)*.

## Armadilhas e o que a aplicação faz nesse caso

**Só contam os dias, não as horas.** Um calendário de recurso determina em que dias o recurso trabalha. O número de unidades disponíveis nesse dia depende do campo *Unidades máx* do recurso, não dos tempos de trabalho do calendário.

**O nivelamento nem sempre resolve isto.** Se não existir um intervalo em que todos os dias da tarefa caiam em dias úteis do recurso, deslocar não ajuda. Escolha *Recursos › Nivelamento › Nivelar…* e clique em *Calcular*. A tarefa fica então em *Conflitos restantes*, com o motivo *O recurso não trabalha em todos os dias que esta tarefa necessita — deslocar não resolve isto.* Depois, atribua a tarefa a outro recurso ou dê-lhe um calendário próprio.

**Um calendário partilhado.** A lista mostra todos os calendários do projeto, portanto também o calendário do projeto e os calendários das tarefas. Se ajustar um desses calendários com o lápis, o planeamento das tarefas que o usam também muda, e a barra de estado indica *Desatualizado — recalcule (F5)*. Prefira criar um calendário próprio para o recurso.

**A sobrealocação nem sempre se deve ao calendário.** Um recurso que trabalha todos os dias também pode ficar sobrealocado: a dica só menciona o calendário se o dia não for um dia útil do recurso.

## Ver também

- [Calendários e dias úteis](docs://uitleg-kalenders): porque é que um calendário de recurso não desloca datas.
- [Criar e atribuir um calendário](docs://howto-kalender-maken-en-toewijzen): os campos do formulário de calendário.
- [Gerar feriados e as férias da construção](docs://howto-feestdagen-genereren): colocar feriados e paragens no calendário.
- [Janelas de calendário](docs://ref-kalenders): todos os campos das janelas de calendário.
