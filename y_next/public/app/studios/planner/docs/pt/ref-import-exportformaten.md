# Formatos de importação e exportação

Por formato de ficheiro: se pode abrir, guardar e exportar, o que é e o que não é incluído e com que perfil de cálculo abre. O porquê disto tudo, e um exemplo com números, está em [Ficheiros e formatos](docs://uitleg-bestanden).

## Visão geral

**Abrir** funciona com IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` e `.xer`. Um ficheiro com outra extensão é tratado pela aplicação como IFC.

**Guardar** guarda sempre em IFC. Só um ficheiro IFC aberto passa a ser o destino para guardar. Um projeto de outro formato não tem ficheiro depois de aberto, e *Guardar* pergunta então onde deve ficar o ficheiro IFC.

**Exportar** funciona para IFC 4x3, MS Project XML, Primavera P6 XML, CSV e duas folhas de progresso (Excel e CSV). Uma exportação não altera o seu projeto.

**Só leitura** são `.mpp` e `.xer`: a aplicação pode abri-los, mas não os pode gravar.

**PDF** vem só de um relatório (consulte [Tipos de relatório](docs://ref-rapporttypes)). A aplicação não lê PDF.

**Onde.** Abrir: *Início › Ficheiro › Abrir*, *Ficheiro › Abrir* ou Ctrl+O. Exportar: *Início › Ficheiro › Exportar* ou *Ficheiro › Exportar*. Importe uma folha de progresso preenchida através de *Ficheiro › Importar*, ou com o botão *Atualizar o progresso a partir de uma planilha* no grupo do friso *Progresso*, nos separadores *Planeamento*, *Tabela* e *Relatório*.

**Perfil de cálculo ao abrir.** Cada formato abre com um perfil de cálculo. O que é, está em [Opções de cálculo e convenções](docs://ref-rekenopties-en-conventies). `.xer` abre com *Primavera P6*, `.mpp` com *Microsoft Project*, e CSV, MS Project XML e P6 XML com *Open Planner Studio*. O IFC mantém o perfil guardado no ficheiro. Para `.xer` e `.mpp` a aplicação indica que o projeto calcula desta forma. Só o IFC transporta o perfil de cálculo e as opções de cálculo. Das opções de cálculo, o MS Project XML grava no máximo o limiar crítico. Uma exportação reaberta de outro formato calcula como *Open Planner Studio*.

## IFC

**Abrir** — sim, `.ifc`. A aplicação lê IFC 4.3. Perfil de cálculo: o que está no ficheiro.

**Guardar** — sim, e é o único formato que guarda. *Guardar* grava todo o seu projeto como ficheiro IFC. O ficheiro passa a ser o destino para guardar.

**Exportar** — sim, como *IFC 4x3* (descrito como *Norma BuildingSMART. Ligação 4D com modelos BIM.*). Nome por padrão: o nome do projeto com a extensão `.ifc`. Se o seu projeto estiver ligado a uma biblioteca de recursos, a caixa de verificação *Guardar também o ficheiro de biblioteca* fica abaixo dos cartões em *Ficheiro › Exportar*. Com a caixa marcada, a aplicação pede, depois do projeto, um local para *nomedoprojeto-bibliotheek.ifc*. A caixa de verificação não está na lista do separador *Início*.

**O que é incluído** — tudo o que pertence ao projeto: tarefas com estrutura, duração, datas e progresso; relações com desfasamento; restrições e prazos; calendários; recursos e atribuições, incluindo a distribuição por hora; linhas de base; códigos de atividade e campos personalizados; notas; relações externas a outros projetos; interrupções; regras de trabalho e tipos de tarefa; as definições do projeto, como a data de estado, o modo de progresso, o perfil de cálculo e as opções de cálculo; a ligação a uma biblioteca de recursos. Num projeto de um `.xer`, o ficheiro de origem original também é incluído. Um tipo de tarefa personalizado fica guardado como o tipo IFC `USERDEFINED`, com o nome no campo ObjectType, para que outros programas IFC leiam a tarefa normalmente. A aplicação guarda também o identificador fixo do tipo, pelo que mudar o nome não quebra a ligação. Se alguém abrir o ficheiro noutro computador, o tipo aparece aí em *Deste projeto*, e não em *Meus tipos de tarefa*.

**O que não é incluído** — a forma como configurou o ecrã (zoom, posição de deslocamento, tarefa selecionada, fases recolhidas, filtro e agrupamento escolhidos) e as definições da aplicação ([Definições](docs://ref-instellingen)). O separador *IFC* mostra o texto IFC do seu projeto.

## MS Project XML (MSPDI)

**Abrir** — sim. A aplicação reconhece um ficheiro `.xml` como MS Project XML pelo elemento raiz `Project` no espaço de nomes do MS Project (ou sem espaço de nomes). Perfil de cálculo: *Open Planner Studio*.

**Guardar** — não. Um projeto assim não tem ficheiro de destino para guardar.

**Exportar** — sim, como *MS Project XML* (*Abre no Microsoft Project. Estrutura WBS completa.*). Nome por padrão: o nome do projeto com `.xml`.

**O que é incluído** — tarefas com estrutura (nível e WBS), duração, datas e progresso; relações com desfasamento, também em horas ou percentagens; restrições, incluindo o prazo; calendários, incluindo calendários de tarefa e de recurso; recursos e atribuições, incluindo a curva ou a distribuição por hora; a data de estado; o limiar crítico, como número inteiro de dias úteis igual ou superior a 0, com *Folga total ≤ limiar*; a descrição de uma tarefa (como nota); a regra de trabalho de uma tarefa (como tipo de tarefa do MS Project); um tipo de tarefa personalizado, num campo livre (`ExtendedAttribute`) que a aplicação volta a ler e que o MS Project pode ignorar. Das suas linhas de base, só a ativa é incluída, como linha de base 0. Uma tarefa em horas mantém a sua unidade, e um marco o seu tipo (início, fim ou automático).

**O que não é incluído** — notas (a lista de verificação de uma tarefa), relações externas a outros projetos, códigos de atividade e campos personalizados, uma segunda restrição, a marcação *Agendada manualmente*, o atraso de nivelamento, o ponto de retoma e de paragem de uma tarefa fora de sequência, as convenções *O trabalho restante retoma após a duração decorrida* e *Não mover tarefas não iniciadas para a data de estado* de um perfil do MS Project, e as outras opções de cálculo. Tarefas interrompidas sem distribuição por hora são incluídas, mas sem as suas interrupções.

**O que muda pelo caminho** — uma restrição *Deve começar em (MSO)* ou *Deve terminar em (MFO)* sem a opção *Obrigatório (fixação de data)* passa a *Não começar antes de (SNET)* ou *Não terminar antes de (FNET)*. Uma hammock passa a ser uma tarefa normal com datas calculadas.

## Ficheiro MS Project (`.mpp`)

**Abrir** — sim, do MS Project 2010 até 2021. Perfil de cálculo: *Microsoft Project*. A aplicação só lê o ficheiro: nunca altera o seu `.mpp`. Um ficheiro do MS Project 2007 ou anterior, e um ficheiro protegido por palavra-passe, a aplicação recusa com uma mensagem que aponta para a exportação XML do MS Project.

**Guardar** — não. Não há ficheiro de destino: *Guardar* cria um novo ficheiro IFC.

**Exportar** — não.

**O que é incluído** — tarefas com estrutura, duração e restrições; relações com desfasamento; calendários; recursos e atribuições; progresso; um código WBS que introduziu manualmente no MS Project. As datas e a folga que o próprio MS Project calculou também são lidas, para a vista *Datas como guardadas*.

**O que não é incluído** — linhas de base, custos e tarifas, notas e os campos personalizados do MS Project. Consulte [Abrir um ficheiro do MS Project (.mpp)](docs://howto-mpp-openen).

**Origem e licença** — o leitor de `.mpp` foi escrito para o Open Planner Studio e deriva do código-fonte e do conhecimento estrutural do MPXJ (`github.com/joniles/mpxj`, Jon Iles et al.), uma biblioteca Java sob LGPL-2.1. A estrutura e as constantes dos campos foram portadas para TypeScript. O próprio Open Planner Studio é de código aberto sob LGPL-3.0. O leitor de `.xer` não é uma derivação: o MPXJ foi consultado nesse caso apenas como fonte de compreensão.

## Primavera P6 XML

**Abrir** — sim. A aplicação reconhece um ficheiro `.xml` como P6 XML pelo elemento raiz `APIBusinessObjects`. Perfil de cálculo: *Open Planner Studio*.

**Guardar** — não.

**Exportar** — sim, como *Primavera P6 XML* (*Para Oracle Primavera P6.*). Nome por padrão: o nome do projeto com `.xml`, ou seja, o mesmo nome de uma exportação MS Project XML. Escolha nomes diferentes para cada uma.

**O que é incluído** — estrutura WBS e tarefas com duração, datas e progresso; relações com desfasamento; restrições (também uma segunda, como restrição flexível); calendários; recursos e atribuições; a data de estado (como `DataDate`); um tipo de tarefa personalizado, num campo próprio, `OPS Custom Task Type`, que a aplicação volta a ler e que o P6 pode ignorar.

**O que não é incluído** — linhas de base e prazos; códigos de atividade, campos personalizados, notas e relações externas; as opções de cálculo. O P6 não tem desfasamento em percentagem: a aplicação converte-o num número fixo de dias. Um desfasamento em dias de calendário passa a ser um desfasamento em tempo de trabalho: 3 dias de calendário passam a ser 3 dias úteis. Uma hammock passa a ser uma tarefa normal, uma tarefa agendada manualmente passa a ser uma tarefa normal com datas calculadas, e um atraso de nivelamento inferior a um dia é eliminado.

## Ficheiro Primavera (`.xer`)

**Abrir** — sim. Perfil de cálculo: *Primavera P6*. A aplicação só lê o ficheiro: não grava `.xer` e nunca altera o seu ficheiro. Abre um separador por projeto com tarefas. Um ficheiro sem atividades ou com tabelas danificadas é recusado com uma mensagem.

**Guardar** — não. Não há ficheiro de destino: *Guardar* cria um novo ficheiro IFC, com o `.xer` original dentro.

**Exportar** — não. Se exportar um projeto de um `.xer` para CSV, MS Project XML ou P6 XML, a aplicação indica que a informação de origem XER se perde, mesmo que tenha guardado o projeto como IFC entretanto. Para IFC não se perde nada.

**O que é incluído** — a estrutura WBS e as atividades com duração, datas, restrições e progresso; relações com desfasamento; calendários; recursos com atribuições; códigos de atividade; campos personalizados (UDF); notas; as definições de agendamento do P6. Uma atividade do tipo *Level of Effort* passa a ser uma hammock. Um projeto de linha de base passa a ser a linha de base ativa do projeto que o referencia. Uma relação entre dois projetos é guardada pela aplicação como dados de origem.

**O que não é incluído** — um projeto sem atividades, e uma relação entre dois projetos como relação real no seu planeamento. Consulte [Abrir um ficheiro Primavera P6 (.xer)](docs://howto-xer-openen).

## CSV

**Abrir** — sim. A aplicação lê `;` e `,` como separador. Reconhece cabeçalhos de coluna em inglês e em neerlandês (por exemplo `Name` ou `Naam`, `Duration` ou `Duur`, `Predecessors` ou `Voorgangers`). As datas podem ser *aaaa-mm-dd*, *dd-mm-aaaa* ou *dd/mm/aaaa*. Escreva a predecessora como código WBS, tipo de relação e desfasamento, por exemplo `1.2FS+2d`. Perfil de cálculo: *Open Planner Studio*. O projeto chama-se *CSV Import*. Um `Task Type` que não seja nenhum dos códigos fixos (como `CONSTRUCTION` ou `INSTALLATION`, que a própria aplicação escreve) passa a ser um tipo de tarefa personalizado em *Deste projeto*, e não em *Meus tipos de tarefa*. Com `OPS Custom Task Type ID` mantém-se o identificador de um tipo personalizado.

**Guardar** — não.

**Exportar** — sim, como *CSV (;)* (*Exportação de tabela universal. Todas as tarefas com datas e durações.*), no cartão *CSV (separado por ponto e vírgula)*. O ficheiro usa o ponto e vírgula como separador, está em UTF-8 com BOM e tem cabeçalhos de coluna em inglês.

**O que é incluído** — por tarefa, estas colunas: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` e `Description`. A conclusão está em percentagens inteiras.

**O que não é incluído** — recursos, atribuições, calendários, restrições, prazos, linhas de base e a data de estado. Se as datas estiverem na vista *Datas como guardadas*, a exportação deixa vazios `Critical` e `Total Float` nas tarefas cujo ficheiro de origem não registou esses valores.

## Folha de progresso (Excel e CSV)

**Abrir** — sim, por *Ficheiro › Importar* (*Atualizar o progresso a partir de uma planilha*) ou pelo botão com esse nome no grupo do friso *Progresso*, nos separadores *Planeamento*, *Tabela* e *Relatório*. A aplicação lê `.xlsx` e `.csv`, até 16 MB e 50 000 linhas. Isto não abre um projeto: atualiza o progresso do seu projeto aberto. Consulte [Importar progresso a partir de uma planilha](docs://howto-voortgang-importeren).

**Guardar** — não.

**Exportar** — sim, como *Folha de progresso (Excel)* (*Progresso (Excel)* na lista) e *Folha de progresso (CSV)* (*Progresso (CSV)*). Nome por padrão: *nomedoprojeto-voortgang*. O botão *Exportar folha de progresso* no mesmo grupo do friso cria a folha Excel com um clique. A folha Excel tem larguras de coluna fixas, campos bloqueados e verificação de datas; a folha CSV tem o mesmo conteúdo em texto simples.

**O que é incluído** — as colunas `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` e `Actual Finish`. Ao importar, a aplicação usa `Completion (%)`, `Actual Start` e `Actual Finish`. `Start` e `Finish` servem apenas para reconhecer a notação da data e não alteram o seu planeamento. A aplicação liga as linhas às tarefas pelo `OPS Task ID`, ou, em alternativa, por um código WBS único.

**O que não é incluído** — tudo o que estiver fora destas colunas: duração, relações, recursos e o resto do seu planeamento. Uma tarefa de resumo não recebe progresso da folha.

## PDF

**Abrir** — não.

**Guardar** — não.

**Exportar** — sim, a partir de um relatório: no separador *Relatório*, o botão *Exportar PDF*. A aplicação não envia ela mesma um relatório para uma impressora; o caminho para o papel passa pelo PDF. O conteúdo depende do tipo de relatório: consulte [Tipos de relatório](docs://ref-rapporttypes) e [Criar e imprimir um relatório](docs://howto-rapport-maken-en-afdrukken).

## Ver também

- [Ficheiros e formatos](docs://uitleg-bestanden): porque é que o IFC é o formato próprio e o que uma exportação perde, com um exemplo.
- [Abrir e guardar um ficheiro](docs://howto-bestand-openen-en-opslaan): os passos.
- [Exportar](docs://howto-exporteren): escolher um formato e as mensagens depois de uma exportação.
- [Datas como guardadas](docs://uitleg-datums-zoals-opgeslagen): porque é que um ficheiro aberto pode mostrar outras datas.
- [Opções de cálculo e convenções](docs://ref-rekenopties-en-conventies): os perfis de cálculo.
