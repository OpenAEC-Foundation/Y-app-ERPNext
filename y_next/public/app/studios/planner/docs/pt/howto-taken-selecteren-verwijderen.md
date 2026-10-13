# Selecionar, eliminar e desfazer tarefas

Objetivo: escolher tarefas, retirá-las e desfazer um erro.

## Quando precisa disto

Quase todas as ações no planeamento atuam sobre as tarefas selecionadas: eliminar, copiar, avançar, ativar ou desativar um marco. Elimina tarefas quando o trabalho deixa de ser necessário ou o planeamento é revisto. Como a aplicação não pede confirmação ao eliminar, o *Desfazer* é a sua rede de segurança.

## Passos

### Selecionar tarefas

- **Uma tarefa.** Clique na linha na tabela de tarefas ou na barra no Gantt.
- **Várias tarefas.** Ctrl+clique (⌘+clique no Mac) adiciona uma tarefa à seleção ou remove-a. Na tabela de tarefas, Shift+clique seleciona todas as tarefas desde a tarefa ativa até à tarefa em que clicou.
- **Todas as tarefas visíveis.** Ctrl+A, com o foco na tabela de tarefas ou no Gantt. As tarefas que um filtro oculta ficam de fora, tal como as subtarefas de uma fase recolhida.
- **Uma caixa no Gantt.** Mantenha Ctrl premido e arraste sobre o fundo vazio: são selecionadas todas as tarefas nas linhas que a caixa toca, mesmo que a respetiva barra fique ao lado dela. Só conta a altura da caixa, não o eixo do tempo. Se soltar Ctrl só depois do botão do rato, as tarefas são adicionadas à seleção existente; caso contrário, substituem-na. Sem Ctrl, esse arrastamento desloca a linha do tempo na definição padrão.
- **Nada.** Esc, ou um clique no fundo vazio do Gantt.

Se selecionar uma tarefa de resumo, as respetivas subtarefas não são selecionadas com ela. Eliminar e copiar, no entanto, incluem-nas também.

### Eliminar tarefas

Selecione as tarefas e escolha uma destas formas:

- *Início › Editar › Eliminar*. O mesmo botão está no separador *Tabela*.
- Delete ou Backspace, se o foco não estiver na tabela de tarefas. Por isso, clique primeiro numa barra no Gantt.
- *Eliminar* no menu do botão direito. Se a tarefa em que clicou fizer parte da seleção, a ação aplica-se à seleção inteira. Caso contrário, aplica-se apenas a essa tarefa.
- O pequeno ícone de caixote do lixo no topo do painel *Propriedades* (texto de ajuda *Eliminar tarefa*). O ícone elimina a tarefa que o painel mostra.

A aplicação não pede confirmação. Se eliminar várias tarefas de uma vez, isso conta como um único passo para o *Desfazer*.

O que desaparece com elas: todas as subtarefas de uma tarefa de resumo eliminada, todas as relações de e para as tarefas eliminadas e as respetivas atribuições de recursos. Se eliminar a última subtarefa de uma tarefa de resumo, ela continua como uma tarefa normal. Se *WBS auto* estiver ativo, a aplicação renumera a estrutura. Depois, o planeamento deixa de estar atualizado: prima **Calcular** (F5), a não ser que *Calcular automaticamente* esteja ativo.

### Recolher e expandir

Uma tarefa de resumo tem um triângulo antes do nome na tabela de tarefas. Clique no triângulo para ocultar ou mostrar as subtarefas. Com *Visualização › Estrutura › Recolher* e *Expandir*, faz isso para as tarefas de resumo selecionadas ou para todas, se não houver seleção. O menu do botão direito de uma tarefa de resumo também tem *Recolher* e *Expandir*. Numa vista agrupada, os botões atuam sobre os grupos.

A aplicação guarda o estado de recolhido e expandido para cada documento aberto. Isso não faz parte do *Desfazer* e não está no ficheiro do projeto.

### Desfazer e refazer

- *Início › Editar › Desfazer* e *Refazer* (também no separador *Tabela*), as setas na barra de título, ou Ctrl+Z para desfazer e Ctrl+Y ou Ctrl+Shift+Z para refazer.
- Se fizer uma ação nova depois de um *Desfazer*, o *Refazer* deixa de estar disponível.

O *Desfazer* abrange as alterações aos dados do projeto (tarefas, relações, recursos, calendários e similares) e aplicar um layout. As alterações às colunas da tabela de tarefas também são passos: adicionar, remover, mover, redimensionar, ajustar automaticamente, fixar e repor o layout das colunas para o padrão. Estes passos de colunas pertencem à própria tabela de tarefas e aplicam-se a toda a aplicação, não a um só documento. A aplicação guarda os últimos cem passos por documento, menos num projeto muito grande.

## Armadilhas e o que a aplicação faz

**A tecla Delete na tabela de tarefas não elimina uma tarefa.** Se o foco estiver na tabela de tarefas, Delete (ou Backspace) limpa o conteúdo das células selecionadas. Numa célula obrigatória ou calculada, como o nome ou a duração, a aplicação recusa e mostra uma mensagem por baixo da tabela de tarefas. No caso do nome, por exemplo: *Este valor é obrigatório e não pode ficar vazio.* Nesse caso, não se limpa nada, nem nas outras células selecionadas. Clique numa barra no Gantt ou use *Eliminar* (no separador *Tabela*, onde não há Gantt: *Tabela › Editar › Eliminar* ou o menu do botão direito).

**Uma fase inteira sai de uma vez.** Se eliminar uma tarefa de resumo, as respetivas subtarefas, relações e atribuições saem com ela. *Desfazer* (Ctrl+Z) repõe tudo, incluindo as relações e as atribuições.

**O que não volta.** A seleção, o recolher e o expandir, e o botão *Limpar* na faixa *Não disponível durante a filtragem/agrupamento/ordenação* não fazem parte do *Desfazer*. Se premir Ctrl+Z depois de *Limpar*, o que se desfaz é o passo anterior, não a limpeza.

**Eliminar uma tarefa da qual outras dependem.** As relações de e para essa tarefa também desaparecem. As tarefas que estavam apenas ligadas a ela ficam soltas e, depois de **Calcular**, voltam a começar na sua data de início planeada. Se for preciso, adicione novas relações; veja [Adicionar relações](docs://howto-relaties-leggen).

## Ver também

- [Adicionar tarefas e marcos](docs://howto-taken-en-mijlpalen-toevoegen): o inverso, e copiar tarefas.
- [Ajustar a estrutura](docs://howto-structuur-aanpassen): colocar uma tarefa sob outra fase, em vez de a eliminar.
- [Arrastar, deslocar e ampliar no Gantt](docs://howto-gantt-bedienen): a caixa de seleção e os modos de deslocação.
- [Menus do botão direito](docs://ref-contextmenus): o que *Eliminar* e os outros itens fazem a uma seleção.
