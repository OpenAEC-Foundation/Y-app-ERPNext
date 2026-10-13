# Notificações e avisos

A aplicação indica o que está a acontecer em três sítios: a barra de estado em baixo, o painel *Avisos* na coluna da direita e as notificações que aparecem durante pouco tempo na parte inferior do ecrã. Este artigo indica, para cada sítio, o que vê, quando aparece e o que pode fazer. Porque é que um planeamento é crítico ou tem recursos sobrealocados está em [Caminho crítico e folga](docs://uitleg-kritiek-pad); a resolução de recursos sobrealocados está em [Resolver recursos sobrealocados](docs://howto-overbezetting-oplossen); como criar relações está em [Criar relações](docs://howto-relaties-leggen).

## A diferença entre os três

- **Barra de estado** — uma linha fixa com contadores. Vêm do último cálculo e mantêm-se até voltar a calcular.
- **Painel de avisos** — a lista por detrás desses contadores, com tudo o que o último cálculo encontrou. Um clique leva à tarefa, relação ou recurso. O painel resulta do último cálculo; nada é guardado.
- **Notificações** — mensagens curtas sobre algo que acabou de fazer (falha ao guardar, relação recusada, importação lida). Desaparecem e não estão no painel.

## A barra de estado

A barra em baixo mostra, da esquerda para a direita:

- **Tarefas:** — o número de tarefas folha (as tarefas de resumo não contam).
- **Marcos:** — o número de marcos.
- **Caminho crítico: N tarefas, N dias úteis** — o número de tarefas críticas e a duração do projeto. Só está visível depois de um cálculo.
- **Fim:** — a data de fim do projeto, a partir do cálculo. Só está visível depois de um cálculo; um projeto vazio não tem nenhuma.
- **N prazo(s) ultrapassado(s)**, **N restrição(ões) violada(s)**, **N relação(ões) fora de sequência** e **N recurso(s) sobrealocado(s)** — cada um é um botão com um sinal de aviso, só visível quando o contador é superior a 0 e existe um cálculo. Um clique abre o painel *Avisos* (texto de ajuda: *Abrir o painel de avisos (detalhes e navegação)*). Se estiver no separador *IFC* ou *Relatório*, a aplicação salta ao mesmo tempo para *Início*, porque a coluna da direita não existe nesse separador. O contador *recurso(s) sobrealocado(s)* também se atualiza depois de alterações a recursos e atribuições; os outros contadores só mudam depois de *Calcular*. Os quatro contadores são uma seleção: o que o painel mostra além disso (avanço truncado, relação ignorada, hammock sem driver de fim, data de fim limitada, erro de planeamento) não está na barra de estado.
- **Desatualizado — recalcule (F5)** — com um sinal de aviso (texto de ajuda: *Planificação desatualizada — recalcule (F5)*). Aparece logo que altera algo que afeta o planeamento e ainda não recalculou. Se a opção *Calcular automaticamente* estiver ligada, não aparece, exceto quando o cálculo deu um erro: nesse caso, aparece.
- **Seleção: N tarefa(s)** — o número de tarefas selecionadas; só visível com uma seleção.
- **Escala:** e **Zoom: Npx/dia** — a escala temporal da linha de tempo e o nível de zoom. A escala resulta do zoom.
- **Não guardado** — enquanto o documento tiver alterações que não estão no ficheiro.
- **IA** — um ponto colorido com a palavra IA, só quando o modo IA está ativo. A dica diz *Ponte IA:* com *Desligada*, *Ativa na porta N*, *Porta N ocupada* ou *Erro*. Um clique abre o separador *IA*.
- **Terminal de depuração** — um botão de terminal, só quando o terminal de depuração está ativado; mostra ou oculta o terminal (*Mostrar terminal de depuração* / *Ocultar terminal de depuração*).

## O painel *Avisos*

- **Abertura** — *Planeamento › Agendamento › Avisos*, *Visualização › Painéis › Avisos*, ou um contador na barra de estado. O painel está na coluna da direita, por baixo de *Propriedades* e do painel de recursos, e expande uma coluna recolhida. Por padrão está fechado e não é lembrado entre sessões. Arraste a altura pela margem quando está por baixo de outros painéis; essa altura é lembrada. A cruz no canto superior direito fecha o painel (*Fechar avisos*).
- **Linha de cabeçalho** — *N erro(s), N aviso(s)*. Se ainda não houve cálculo, diz *Ainda não calculado — prima Calcular (F5) para executar as verificações*.
- **Calcular** — um botão na linha de cabeçalho, visível enquanto o planeamento estiver desatualizado ou ainda não tiver sido calculado. Faz o mesmo que *Calcular* no friso.
- **Sinal de aviso na linha de cabeçalho** — aparece quando o planeamento está desatualizado, com a dica *Planeamento desatualizado — esta lista provém do último cálculo. Recalcule (F5)*. A lista não fica oculta; fica apenas marcada como desatualizada.
- **Lista vazia** — *Sem avisos. O planeamento passa em todas as verificações*.
- **Uma linha** — no topo, o sítio (tarefa, relação, recurso ou projeto); por baixo, a descrição. Um erro tem um sinal próprio em forma de octógono; um aviso tem um sinal triangular. Uma tarefa aparece como `nome WBS`. Uma relação aparece como `predecessora → sucessora (FS+2d)`, com tipo e desfasamento. Um clique leva ao sítio (texto de ajuda: *Ir para: …*); consulte abaixo. A linha que pertence à sua tarefa ativa (para uma relação: a sucessora) ou ao recurso escolhido no histograma fica destacada.
- **Ordem** — primeiro os erros; depois, por tipo, pela ordem da lista abaixo; dentro de cada tipo, pela ordem do documento (para uma relação, a da sucessora; para um recurso, a da lista de recursos). Uma tarefa, relação ou recurso eliminado depois do último cálculo deixa de aparecer.

### Tipos de aviso

- **Erro de planeamento** — *O planeamento não pôde ser calculado: …* com o motivo a seguir; consulte abaixo. Um clique: num ciclo, a aplicação seleciona todas as tarefas do ciclo e salta para a primeira; nos outros erros não há para onde saltar, e a linha não é um botão.
- **Prazo ultrapassado** — *Prazo {date} ultrapassado — fim antecipado {date}*. A tarefa tem um prazo e o cálculo não o cumpre. Um clique salta para a tarefa. Para corrigir: ajuste a lógica ou a duração, ou mude o prazo.
- **Restrição violada** — *A restrição {type and date} é ultrapassada pela lógica (folga negativa)*. A restrição não pode ser cumprida sem quebrar a lógica; a folga é negativa. Um clique salta para a tarefa. Consulte [Restrições](docs://uitleg-constraints).
- **Fora de sequência** — *Fora de sequência: o progresso do sucessor contradiz a relação*. O progresso do sucessor não encaixa no tipo de relação; por exemplo, um sucessor que já está em curso enquanto o predecessor ainda não está concluído, numa relação fim-início. Um clique seleciona as duas tarefas, com a sucessora ativa. Verifique as datas reais ou a relação.
- **Avanço truncado** — *Avanço truncado pelo início do projeto — a relação não é totalmente respeitada*. O avanço (desfasamento negativo) da relação ultrapassa o início do projeto. Um clique seleciona as duas tarefas.
- **Relação ignorada** — *Relação ignorada: o predecessor ou o sucessor está em falta ou não é uma tarefa folha*. O cálculo não usa a relação. Um clique seleciona as tarefas que ainda existem. Consulte [Relações](docs://uitleg-relaties).
- **Hammock sem driver de fim** — *Hammock sem driver de fim (sem predecessor FF/SF): a duração volta a zero*. Um clique salta para a tarefa. Consulte [Tarefas hammock](docs://howto-hammock).
- **Data de fim limitada** — *Data de fim limitada: o calendário não deixa nenhuma janela útil para esta tarefa*. O cálculo atingiu o limite de dias que pesquisa, por exemplo por causa de um período contínuo muito longo de dias não úteis no calendário. Um clique salta para a tarefa. Consulte [Calendários e dias úteis](docs://uitleg-kalenders).
- **Recurso sobrealocado** — *Sobrealocado durante N dia(s) (first – last)*, com *o recurso não trabalha estes dias segundo o seu calendário* acrescentado se todos os dias forem dias não úteis, ou *dos quais N dia(s) o recurso não trabalha segundo o seu calendário* para uma mistura. Um clique seleciona as tarefas com uma atribuição a esse recurso, liga o histograma e escolhe esse recurso nele; a partir de *Tabela*, *IFC* ou *Relatório*, a aplicação salta para *Recursos*. Consulte [Painel de recursos](docs://ref-resourcepaneel).

### Causas de erro de planeamento

- *Dependência circular entre tarefas: {path}* — as relações formam um ciclo. As tarefas estão no caminho; inverta ou elimine uma relação.
- *O calendário não tem dias úteis definidos* — dê ao calendário pelo menos um dia útil; consulte [Janelas do calendário](docs://ref-kalenders).
- *Duração em dias inválida para a tarefa '{task}'* e *Duração em horas inválida para a tarefa '{task}'* — a duração da tarefa não é um número válido.
- *A tarefa horária '{task}' não tem horário de trabalho válido no seu calendário* — uma tarefa em horas num calendário sem horário de trabalho.
- *Data de início inválida para a tarefa '{task}'* — a data de início da tarefa não é válida.

## Notificações

As notificações aparecem na parte inferior do ecrã, também na tabela, no Backstage e no modo de apresentação. Uma notificação é um *erro* ou uma *info*. Um erro fica visível até o fechar com um clique. Uma info desaparece após 5 segundos. Esses temporizadores recomeçam logo que a pilha muda. Um clique numa notificação fecha-a (dica *Fechar notificação*). No máximo, são mostradas três ao mesmo tempo: se chegar uma quarta, sai primeiro a info mais antiga; se não houver info, sai a notificação mais antiga. Assim, um erro nunca é retirado por uma info. A pilha desloca-se para longe dos botões de uma caixa de diálogo aberta e das barras de ação fixas.

- **Contador ×N** — uma notificação com uma chave fixa agrupa uma repetição numa só linha, com um contador, por exemplo um erro ao guardar que volta sempre ou uma relação recusada que volta a tentar. Nem todas as notificações fazem isso.
- **Saiba mais** — algumas notificações têm uma ligação *Saiba mais* ou um tema próprio (por exemplo, *Regras de trabalho explicadas*) que leva ao guia em Backstage › Ajuda.
- **Botão de ação** — a notificação sobre o perfil de cálculo tem um botão *Abrir perfil de cálculo* para Info do projeto.

A lista seguinte é uma seleção, agrupada por tema. Quando não diz outra coisa, é uma info.

### Guardar, abrir e recuperar

- **Falha ao guardar** (erro) — *Falha ao salvar* com o motivo por baixo. Ao guardar, ao guardar como e ao exportar um relatório.
- **Guardado como transferência** (info) — *Guardado como transferência: '{name}' está agora na pasta de transferências. …* Com *Guardar como* e exportações, quando o ambiente não permite que a aplicação escreva diretamente no local que escolheu. Duas transferências seguidas agrupam-se.
- **Guardado como transferência (explicação)** (info) — *Guardado como transferência: '{name}' está na pasta de transferências. Este navegador não deixa a aplicação escrever num local próprio, …* Com *Guardar* num navegador que só guarda por transferência. Uma vez por sessão, com uma ligação para a explicação sobre ficheiros.
- **O navegador não escreve de volta** (info) — *Este navegador não deixa a aplicação escrever de volta em '{name}'. …* Com *Guardar* de um projeto que tem um ficheiro, quando o navegador tem de pedir de novo um local. Uma vez por sessão, com uma ligação para a explicação sobre ficheiros.
- **Falha no salvamento automático** (erro) — *Falha no salvamento automático* com o motivo. Aplica-se ao guardar automaticamente no ficheiro e à recuperação.
- **Não foi possível guardar a biblioteca** (erro) — *Não foi possível guardar a biblioteca*, ao guardar a biblioteca de recursos.
- **Falha ao abrir um ficheiro** (erro) — *Falha ao abrir o ficheiro* com o motivo. Por exemplo, um ficheiro recente ou um ficheiro importado.
- **.mpp antigo ou protegido** (erro) — *Este ficheiro .mpp usa um formato mais antigo (Project 2007 ou anterior)…* ou *Este ficheiro .mpp está protegido com palavra-passe…*, ambos com a recomendação de exportar como XML no MS Project e abrir esse ficheiro.
- **Ficheiro XER inválido** (erro) — um dos textos *XER…*, por exemplo *Este não é um ficheiro XER válido ou compatível.* ou *O ficheiro XER contém uma tabela duplicada.*, com o motivo acrescentado.
- **Não foi possível ler o IFC** (erro) — *Não foi possível ler o IFC* com o motivo, na vista IFC.
- **Recuperação** (erro) — *Não foi possível ler o ficheiro recuperado*, *Falha na restauração* e *{count} ficheiros de recuperação não puderam ser carregados e foram ignorados.* Ao recuperar após um encerramento inesperado.
- **Ramo guardado como modelo** (info) — *Ramo guardado como modelo '{name}'*.
- **Mensagem de uma extensão** (info, ou erro se a extensão reportar um erro) — *Extensão {name}: {message}*. Uma extensão pode mostrar, no máximo, três novas por 10 segundos, para não encher a pilha. Se um passo do guia de uma extensão falhar, aparece *Um passo da extensão {name} falhou. O guia continua.* Se um ficheiro de projeto de uma extensão não puder ser aberto, aparece *Não foi possível abrir o ficheiro de projeto {file} da extensão {name}.* Ambas são erros.
- **Entrou uma alteração entretanto** (info) — *Entrou uma alteração feita pelo assistente de IA ou por uma extensão entretanto. …* Quando cancela a caixa de diálogo da tarefa, enquanto o assistente de IA ou uma extensão alterou algo entretanto: as edições de tarefa feitas antes dessa alteração não são revertidas e continuam como passos normais em *Desfazer*.

### Cálculo

- **Não foi possível calcular o planeamento** (erro) — *Não foi possível calcular o planeamento* com o motivo por baixo (ver *Motivos de um erro de planeamento*). Ao *Calcular*, ao mudar de documento e ao abrir um ficheiro.
- **Data de estado definida para hoje** (info) — *Ainda não havia data de estado: foi definida para hoje ({date}), porque o progresso é medido até à data de estado. Pode alterá-la em Planeamento → Data de estado.* Ao introduzir o progresso num projeto sem data de estado.
- **Duração inferior ao trabalho já feito** (info) — *«{name}» já está {percent}% feita: uma duração inferior ao trabalho já realizado não é possível. A duração não foi alterada.*

### Relações e hierarquia

- **Relação criada** (info) — *Relação criada: {predecessor} → {successor}*.
- **Relação recusada** (info) — *Essa relação já existe*, *Não é permitida uma relação entre uma tarefa e a sua própria tarefa de resumo ancestral.* ou *Esta relação criaria um ciclo no planeamento ({cycle}) e não foi criada.* O ciclo indica as tarefas, para saber qual a relação a remover ou inverter primeiro.
- **Mudança recusada** (info) — *Esta mudança criaria um ciclo no planeamento ({cycle}): as relações de uma tarefa de resumo também se aplicam às suas subtarefas. Nada foi movido.*
- **Relações que deixam de contar após uma mudança** (info) — *Após a mudança, {count} relações ligam uma tarefa à sua própria tarefa de resumo ancestral; deixam de contar no cálculo.*
- **Relações ignoradas ao inserir** (info) — *{count} relações não foram criadas: ligação inválida…*, ao colar ou inserir um ramo.
- **Relações não contadas após importação** (info) — *{count} relação(ões) não puderam ser incluídas. Verifique as colunas Predecessoras e Sucessoras.*
- **Identificadores duplicados após importação** (info) — *Objetos com um identificador duplicado neste ficheiro: {count}. Receberam um identificador próprio…*

### Editar tarefas

- **Início registado como restrição** (info) — *'{name}' tem uma predecessora: o novo início passou a ser a restrição Não começar antes de (SNET) {date}. Após recalcular (F5), a tarefa não começa antes dessa data.* Ao alterar o início de uma tarefa com predecessora. Se a tarefa já tinha essa restrição, a notificação diz que foi movida. Para várias tarefas de uma vez, indica um número.
- **Início não aplicado** (info) — *O novo início de '{name}' não foi aplicado: a tarefa tem uma predecessora e a restrição {type} {date}, e estas determinam o seu início. Altere essa restrição para mudar o início.*
- **Marco recusado** (info) — *«{task}» tem atribuições de recursos e não pode tornar-se um marco. Remova primeiro as atribuições.* ou *«{task}» é uma tarefa de resumo com subtarefas e não pode tornar-se um marco.* Ao converter na caixa de diálogo da tarefa, no painel de propriedades, no menu de contexto e na tabela.
- **Atribuições movidas para uma subtarefa** (info) — *A atribuição de {resources} foi movida de «{phase}» para a nova subtarefa «{child}»: uma tarefa de resumo não tem atribuições próprias.* Quando uma tarefa com atribuições recebe subtarefas.
- **Marcação de marco removida** (info) — *O marco «{phase}» tem agora subtarefas e tornou-se uma tarefa de resumo; a marcação de marco foi removida.*
- **Tarefa de resumo recusada** (info) — *'{phase}' não pode tornar-se uma tarefa de resumo: …* com o motivo, e *Nada foi alterado.*
- **Células ignoradas ao colar** (info) — *{count} células ignoradas: são só leitura (por exemplo, um código WBS numerado automaticamente ou uma coluna calculada).*
- **Referências limpas ao colar** (info) — *{count} referências não existiam neste documento e foram limpas (calendários de tarefa, tipos de tarefa personalizados, códigos de atividade ou campos personalizados do documento de origem).*
- **Regra de trabalho ajustou durações** (info) — *Após a alteração do calendário, a regra de trabalho ajustou a duração de {count} tarefas (o trabalho mantém-se, as horas por dia mudaram).* Com uma ligação *Regras de trabalho explicadas*.

### Primavera (XER)

- **Ficheiro XER aberto** (info) — *Ficheiro XER aberto: {count} documentos de projeto.* Uma notificação por ficheiro, mesmo que o ficheiro abra vários projetos, com uma ligação *Saiba mais* e linhas de detalhe por baixo. Sempre *{count} projetos encontrados.* Só quando o número é superior a 0: *{count} projetos vazios ignorados.*, *{count} projetos de linha de base excluídos.*, *{count} linhas de base materializadas.*, *{count} referências de linha de base pendentes ignoradas.*, *Foi usada uma alternativa protetora para a linha de base.* e *{count} relações externas preservadas.* Só para uma codificação diferente de UTF-8: *Codificação de texto escolhida: {encoding}.* Além disso, quando o número é superior a 0: *{count} ocorrências do analisador.*, *{count} ocorrências de calendário.*, *{count} problemas de formato numérico.*, *{count} alternativas de enumeração.* e *{count} definições de planeamento P6 usaram alternativas seguras.*
- **Datas tal como registadas pelo Primavera** (linha de detalhe na mesma notificação) — *{count} tarefas mostram as datas tal como registadas pelo Primavera (sem recalcular).*, ou, se o modo não tiver sido ativado, *{count} tarefas diferem das datas registadas no ficheiro — pode mostrá-las.*
- **Ficheiro de origem XER inutilizável** (info) — *O ficheiro de origem XER deste ficheiro é inutilizável e foi omitido; o projeto em si foi aberto por completo.* com o motivo (por exemplo, *Motivo: a soma de verificação não corresponde aos bytes de origem — o ficheiro está danificado.*) e a consequência (*O planeamento, o perfil de cálculo e todos os dados do projeto no IFC estão completos. …*). Ao abrir um ficheiro IFC em que um ficheiro de origem XER guardado antes não pode ser usado.
- **A exportação perde informação XER** (info) — *A exportação para {format} perde informações de origem XER.* Após uma exportação bem-sucedida para um formato diferente de IFC, de um projeto com dados que só existem num ficheiro XER. Com uma ligação *Saiba mais*.

### Importar, exportar e perfil de cálculo

- **Datas tal como no ficheiro** (info) — *{count} tarefas mostram as datas tal como registadas no ficheiro (sem recalcular).* ou *{count} tarefas diferem das datas registadas no ficheiro — pode mostrá-las.* Ao abrir um ficheiro com datas registadas.
- **Trabalho e regras de trabalho visíveis** (info) — *Este ficheiro contém trabalho guardado ou regras de trabalho próprias; a regra de trabalho e o trabalho restante são mostrados para este projeto.*
- **Planeamento do MS Project lido** (info) — *Este ficheiro do MS Project contém {count} tarefas com um cronograma dividido, nivelado ou controlado por recursos. Elas são importadas e exibidas como estão.*
- **Interrupções não exportadas** (info) — *{count} tarefas com interrupções foram exportadas sem as suas interrupções: o MS Project/P6 só as conhece como distribuição do trabalho.* Ao exportar para MS Project ou Primavera.
- **Início do projeto alterado** (info) — *Início do projeto alterado: {count} âncoras de tarefa sem predecessora nem restrição foram movidas para a nova data de início.*
- **Janela de datas deixa de orientar** (info) — *A janela de datas do MS Project deixa de controlar {count} tarefas após esta edição; …* Uma vez por documento.
- **Atraso de nivelamento arredondado** (info) — *O nivelamento arredonda o atraso de nivelamento do MS Project, com precisão de minutos, de {count} tarefas para dias úteis inteiros.* Uma vez por documento.
- **Perfil de cálculo aplicado** (info) — *Este projeto calcula como {profile}. Altere em Ficheiro → Info do projeto → Perfil de cálculo e opções.* Com o botão *Abrir perfil de cálculo*. Após aplicar um perfil, aparece, se necessário, *Após aplicar, {count} tarefas foram deslocadas.*
