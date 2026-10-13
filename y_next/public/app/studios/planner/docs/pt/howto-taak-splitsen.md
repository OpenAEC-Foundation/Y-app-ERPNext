# Dividir uma tarefa

Objetivo: interromper uma tarefa, para que o trabalho pare e continue mais tarde, sem a transformar em duas tarefas.

## Quando precisa disto

Colocar as armaduras demora oito dias úteis, mas ao fim de quatro dias a grua tem de ir para outra obra e o trabalho continua dois dias depois. Criar duas tarefas separadas obriga a manter as relações e as atribuições em duplicado. Com uma **interrupção**, continua a ser uma tarefa, com uma barra que tem um intervalo. A aplicação também chama *pausa* à interrupção.

A quantidade de trabalho mantém-se, mas a tarefa passa a durar mais tempo no calendário. Um exemplo: uma tarefa de 8 dias úteis que começa na terça-feira, 29 de setembro de 2026, termina na quinta-feira, 8 de outubro. Se colocar uma interrupção de 2 dias úteis após 4 dias úteis, termina na segunda-feira, 12 de outubro. A duração mantém-se em 8 dias úteis; só o fim se move dois dias úteis.

## Passos

### Dividir no Gantt

1. Escolha *Início › Tarefas › Dividir tarefa* (ou *Planeamento › Relações › Dividir tarefa*). Acima do planeamento aparece o aviso *Clique numa barra no dia em que a interrupção começa e arraste para a direita para definir a duração. Esc para sair*. O botão também está no separador *Tabela* (*Tabela › Tarefas › Dividir tarefa*), mas está desativado aí.
2. Mova o rato sobre a barra. Uma linha tracejada e uma etiqueta com a data mostram onde a interrupção começaria. Prima a barra no dia em que a interrupção começa.
3. Arraste para a direita. A etiqueta mostra o comprimento, por exemplo *2 dias úteis de pausa*: a distância em dias úteis até ao dia sob o rato. Solte.

Se clicar apenas, sem arrastar, a pausa passa a ter um dia útil. Se arrastar para a esquerda, a pausa fica outra vez mais curta, até um mínimo de um dia útil. Numa tarefa horária, funciona em horas.

O modo mantém-se ativo, para poder dividir mais tarefas. Sai com Esc ou com o botão *Sair* do aviso. Se premir Esc enquanto arrasta, a aplicação anula a pausa e o modo termina. Cada gesto é um passo para *Desfazer*.

Depois de uma divisão, o planeamento deixa de estar atualizado. Prima **Calcular** (F5) para obter as datas finais.

### Arrastar uma interrupção existente no Gantt

Isto funciona sem o modo de divisão, diretamente numa barra que tem uma interrupção.

- Arraste o trecho **após** a pausa para a direita ou para a esquerda. A pausa fica mais longa ou mais curta, com a etiqueta *3 dias úteis de pausa*. Se arrastar esse trecho para trás até à pausa ser 0, a etiqueta mostra *Juntar* e os dois trechos voltam a ser um só.
- Arraste a extremidade direita do trecho **antes** da pausa. Esse trecho fica mais longo ou mais curto, com a etiqueta *Trecho: 5 dias úteis*. A duração da tarefa muda com ele.
- Se arrastar o primeiro trecho, move a tarefa inteira, como em qualquer barra.

### Dividir e ajustar no painel de propriedades

Selecione a tarefa. No painel *Propriedades*, o bloco *Interrupções* fica abaixo de *Dependências* e acima de *Atribuições*. Se for preciso, desloque-se até ao bloco.

- *Adicionar interrupção* coloca uma pausa de um dia útil a meio do trecho mais longo.
- Cada pausa tem duas caixas: *após* (quantos dias úteis de trabalho ficam antes da pausa) e *pausa* (o comprimento da pausa). Ao lado estão as datas do trecho após a pausa. Numa tarefa horária, mostram horas.
- Se definir *pausa* como 0, a interrupção desaparece. O pequeno ícone do caixote do lixo (*Remover a interrupção*) faz o mesmo.

Tenha cuidado com *após*: esta caixa aumenta ou diminui o trecho de trabalho antes da pausa e, com ele, a duração da tarefa inteira. Com *pausa*, só o fim muda.

### Remover uma interrupção

Clique com o botão direito na interrupção no Gantt, ou no trecho a seguir a ela, e escolha *Remover a interrupção*. *Remover todas as interrupções* está no menu do botão direito de cada barra que tem uma interrupção. Ou use o bloco *Interrupções* no painel *Propriedades*, como acima.

### Com um assistente de IA

Um assistente de IA ligado define interrupções com a ferramenta `planner_set_task_splits`, na mesma forma do painel: após quantos dias úteis (ou horas úteis) de trabalho, e quantos dias úteis (ou horas úteis) de pausa. Envia sempre a lista completa; uma lista vazia remove todas as interrupções. Lê-as de volta com `planner_get_task`. Aplicam-se as mesmas regras que abaixo: uma tarefa que não pode ser dividida, o assistente também não a pode dividir. Ao contrário de uma divisão feita manualmente, a aplicação recalcula o planeamento depois, sozinha. Como ligar um assistente está descrito em [Ligar um assistente de IA (MCP)](docs://howto-ai-assistent-koppelen).

## Armadilhas e o que a aplicação faz

**Nem todas as tarefas podem ser divididas.** Não pode dividir um marco, uma tarefa de resumo, uma tarefa com *Hammock (duração derivada)* ativado (veja [Criar um hammock](docs://howto-hammock)), uma tarefa com tipo de duração *Tempo decorrido*, uma tarefa que está *Agendada manualmente* ou uma tarefa com menos de dois dias úteis. No modo de divisão, o rato mostra um cursor de não permitido e nada acontece. Para essa tarefa, também falta o bloco *Interrupções* em *Propriedades*.

**No separador Tabela, o botão não funciona.** *Dividir tarefa* fica desativado aí, com a dica *Disponível apenas quando o gráfico de Gantt está visível*. O gesto precisa de uma barra. O modo de divisão e o modo de vinculação desativam-se mutuamente.

**Um clique sem efeito.** Uma interrupção não pode começar no primeiro dia da tarefa, nem dentro de uma pausa existente. Cada trecho de trabalho tem também de durar pelo menos um dia útil. Se clicar num desses locais, nada acontece, sem mensagem.

**Uma tarefa com progresso.** Se a tarefa tiver progresso, uma interrupção só pode começar depois do trabalho que já está concluído. Com 50% de 8 dias úteis, o mais cedo é o quinto dia útil. Um clique na parte concluída não faz nada, e uma tarefa com 100% de conclusão já não pode ser dividida. No painel, *Adicionar interrupção* fica então desativado. Isto aplica-se também se o meio do trecho mais longo cair em trabalho concluído, por exemplo com 75% de 8 dias úteis.

**O nivelamento também cria interrupções.** Aparecem no bloco *Interrupções*, com a etiqueta *nivelamento*. *Recursos › Nivelamento › Limpar nivelamento* remove-as outra vez. Se editar manualmente as interrupções de uma tarefa destas, todas as pausas de nivelamento dessa tarefa passam a ser manuais e *Limpar nivelamento* deixa de as remover.

**As interrupções não são transferidas para o MS Project nem para o Primavera.** Se exportar para *MS Project XML* ou *Primavera P6 XML*, esse programa só conhece uma interrupção como distribuição do trabalho de uma atribuição. Sem essa distribuição, a tarefa chega sem interrupção, e a aplicação indica quantas tarefas são: *1 tarefa com interrupções foi exportada sem as suas interrupções: o MS Project/P6 só as conhece como distribuição do trabalho*. No ficheiro IFC da aplicação, as interrupções mantêm-se.

**Um ficheiro com interrupções que a aplicação não pode editar.** As interrupções de um ficheiro de origem que não cabem na forma da aplicação mostram, no painel, a mensagem *Estas interrupções vêm do ficheiro de origem numa forma que não pode ser editada aqui*, com apenas *Remover todas as interrupções*.

## Ver também

- [Caminho crítico e folga](docs://uitleg-kritiek-pad): como o planeamento conta em dias úteis e porque é que o fim se move.
- [Adicionar relações](docs://howto-relaties-leggen): outro modo no Gantt, que se usa ao arrastar uma barra.
- [Caixa de diálogo da tarefa e painel de propriedades](docs://ref-taak-eigenschappen): a secção Interrupções no painel de propriedades.
