# Janela de tarefa e painel de propriedades

Pode editar uma tarefa em dois sítios: na janela *Editar tarefa* e no painel *Propriedades*. Quase todos os campos são comuns. Este artigo diz, para cada campo, o que faz, qual é o padrão e o que nota dele. Como criar e configurar uma tarefa está em [Adicionar tarefas e marcos](docs://howto-taken-en-mijlpalen-toevoegen); porque é que o cálculo dá esse resultado está em [Caminho crítico e folga](docs://uitleg-kritiek-pad).

## Os dois sítios

- **Editar tarefa** — a janela da primeira tarefa selecionada. Abra-a com F2, ao clicar duas vezes numa barra do Gantt, ou ao clicar com o botão direito numa tarefa no Gantt ou na tabela e escolher *Editar...*. As suas alterações ficam num rascunho até clicar em *Guardar* (Enter); *Cancelar* (Esc) descarta-as. *Guardar* fica desativado enquanto o nome estiver vazio. Ao guardar, é um só passo em *Desfazer*, incluindo o que fez nas secções *Regra de trabalho*, *Dependências*, *Atribuições* e *Códigos e campos*: estas já atuam sobre o projeto enquanto edita, e *Cancelar* anula-as.
- **Propriedades** — o painel na coluna da direita, para a tarefa ativa. Cada alteração é aplicada de imediato; alterações seguidas ao mesmo campo contam como um passo em *Desfazer*. Sem tarefa, mostra *Selecione uma tarefa para ver as propriedades.* Ative-o ou desative-o com *Visualização › Painéis › Propriedades*. Padrão: ativado. O painel fica ao lado do Gantt e no separador *Tabela*, não em *IFC* nem em *Relatório*, e não sob o painel de recursos completo.

Só na janela: *Tarefa pai* e os botões *Guardar* e *Cancelar*. Só no painel: o caixote *Eliminar tarefa*, o botão *Calcular* em baixo, a secção *Interrupções*, os três marcadores em *Regra de trabalho* (período não útil longo, MS Project, datas registadas) e adicionar relações e ir para uma tarefa vinculada em *Dependências*. Todos os outros campos estão nos dois sítios. A janela mostra *Dependências*, *Atribuições* e *Códigos e campos* só para uma tarefa existente.

Se alterou algo que toque nas datas, clique em *Calcular*. O cálculo não acontece sozinho, a não ser que *Calcular automaticamente* esteja ativado.

## Geral

- **Nome** (na janela *Nome \**) — o nome da tarefa no Gantt, na tabela e nos relatórios. Obrigatório: um nome vazio não é mantido. Padrão para uma nova tarefa: *Nova tarefa*.
- **Código WBS** — o código de estrutura da tarefa, por exemplo `RB-301`. Obrigatório. Com *Planeamento › Estrutura › WBS auto* o campo fica desativado (dica: *Os códigos WBS são numerados automaticamente (Planeamento → Estrutura)*), porque a aplicação passa a gerir os códigos.
- **Descrição** — texto livre. Não tem efeito no cálculo; pode mostrá-la como coluna *Descrição* na tabela.
- **Tipo** — o tipo da tarefa. A lista tem os grupos *Tipos integrados* (*Construção*, *Instalação*, *Demolição*, *Logística*, *Inspecção*, *Transferência*, *Renovação*, *Manutenção*), *Meus tipos de tarefa* e *Deste projeto*. *Outro* só aparece se a tarefa já tiver esse tipo. No fim estão *+ Novo tipo de tarefa…* e *Gerir tipos de tarefa…*. Padrão: o tipo da tarefa pai; caso contrário, *Construção* (modo Construção ativado, o padrão) ou *Outro*. Efeito: não tem efeito no cálculo; pode agrupar e filtrar por ele e colorir as barras por ele. A aplicação guarda um tipo personalizado no seu dispositivo; quando o escolhe, uma cópia vai para o projeto (*Deste projeto*). Se escrever em *+ Novo tipo de tarefa…* um nome que já existe em *Meus tipos de tarefa*, mesmo com maiúsculas diferentes, a aplicação não cria um segundo tipo e escolhe o existente. Em *Gerir tipos de tarefa…* só edita ou remove os seus próprios tipos; um nome vazio ou um nome que já existe não é mantido. Se remover um tipo que o projeto aberto usa, a aplicação pergunta primeiro, e a cópia no projeto mantém-se. Um tipo em *Deste projeto*, por exemplo de um ficheiro de outra pessoa, só entra na sua lista quando clicar em *Adicionar aos meus tipos de tarefa* em *Gerir tipos de tarefa…*.
- **Calendário** — o calendário em que a tarefa conta a sua duração, a data de fim e a folga. Padrão: *Calendário do projeto: {name}*. Efeito: uma tarefa com calendário próprio trabalha em dias diferentes do calendário do projeto. Após uma alteração, *Calcular* recalcula as datas. Consulte [Calendários e dias úteis](docs://uitleg-kalenders).
- **Tarefa pai** (só na janela) — move a tarefa para debaixo de outra tarefa. Padrão: a tarefa pai atual; *- Nenhuma (raiz) -* coloca-a no nível superior. Uma escolha que criasse um ciclo nas relações é recusada ao *Guardar*, com uma mensagem, e a janela fica aberta.

## Notas

- **Notas** — uma lista de verificação na tarefa. *Adicionar nota* acrescenta uma linha; o visto (*Feito*) risca-a; o caixote (*Remover*) elimina-a. Sem linhas, mostra *Ainda sem notas.* Não tem efeito no cálculo; a coluna *Notas* na tabela mostra-as com ✓ ou ○ à frente.

## Marco

- **Marco** — torna a tarefa num marco. Padrão: desligado. Efeito: a duração passa a 0. A aplicação recusa-o para uma tarefa de resumo (uma tarefa com subtarefas) e para uma tarefa com atribuições de recursos, com uma mensagem; remova primeiro as atribuições. Se o desmarcar de novo, *Tipo de marco* e *Obrigatório (contratual)* desaparecem.
- **Tipo de marco** (só para um marco) — *Automático*, *Marco de início* ou *Marco de fim*. Padrão: *Automático*. Efeito: um marco de início fica no início do dia, um marco de fim no fim do dia. Com *Automático*, o marco conta como marco de início quando atua como predecessora, no início do dia.
- **Obrigatório (contratual)** (só para um marco) — marca um marco contratual, por exemplo uma inspecção ou uma entrega. Padrão: desligado. Efeito: um marcador para o Gantt e para os relatórios; não protege uma data. Para isso, use uma restrição ou um prazo.

## Tempo

- **Início** (na janela *Data de início*) — mostra o início calculado, a mesma data da barra do Gantt e da coluna *Início*, não a âncora de planeamento bruta. Obrigatório: um campo vazio volta ao valor anterior. Efeito ao escrever: a nova data passa a ser a âncora planeada (coluna *Início planeado*). Se a tarefa tiver uma predecessora e ainda não tiver começado, a aplicação regista o novo início como restrição *Não começar antes de (SNET)* nessa data (ou move uma SNET existente), com uma mensagem; após *Calcular*, a tarefa, por isso, não começa mais cedo. Se existir uma restrição diferente de *ASAP* ou *SNET*, a aplicação não aplica o início e indica qual restrição determina o início.
- **Duração** — o tempo que a tarefa trabalha. Escreva `5d` para dias, ou `12h` ou `1h 30m` para horas. Um número sem unidade conta na unidade da tarefa. Os dias são sempre inteiros; as horas podem ter decimais. Uma entrada inválida mostra *Introduza um número inteiro de dias ou horas, por exemplo 2d ou 12h.* e o campo volta atrás. Padrão para uma nova tarefa: 5 dias (um marco, 0). O campo fica desativado numa tarefa de resumo, num hammock e num marco com duração 0: a duração deles resulta de outras tarefas ou é zero. Uma tarefa em horas fica desativada enquanto *Ativar planeamento por horas* estiver desligado; há um botão com esse nome. Efeito: após *Calcular*, a duração determina o fim no calendário da tarefa. Se a tarefa tiver recursos e uma regra de trabalho, a regra decide se o trabalho ou as unidades se deslocam. Se a tarefa já estiver parcialmente concluída, a aplicação recusa uma duração mais curta do que o trabalho feito. Consulte [Dias e horas](docs://uitleg-dagen-en-uren).
- **Unidade da duração** — uma escolha entre *Dias* ou *Horas*, com um botão de informação ao lado. Só fica visível quando *Ativar planeamento por horas* e *Permitir planeamento misto de dias/horas* estão ativados (este último fica ativado por padrão quando o planeamento por horas está ativo). Efeito: ao escolher outra unidade, a aplicação converte a duração de imediato se o resultado for exato. *Desfazer* reverte isso num só passo. Se não encaixar exatamente, a unidade mantém-se e a aplicação indica-o. Um calendário sem tempos de trabalho válidos recusa a mudança.
- **Regra de trabalho** — qual dos três valores (duração × unidades = trabalho) fica fixo quando um dos outros muda. Escolhas: *Predefinição do projeto (Duração e unidades fixas)*, *Duração e unidades fixas*, *Duração e trabalho fixos*, *Trabalho fixo* e *Unidades fixas*. Padrão: a predefinição do projeto. Por baixo aparece o que a regra protege (*Protegido: …*) e, para uma tarefa do MS Project, *Do MS Project: condicionado pelo esforço* ou *Do MS Project: não condicionado pelo esforço*. Só fica visível quando *Mostrar regras de trabalho e trabalho* está ativado (*Definições*, separador *Planeamento*, título *Cálculo*), ou quando o próprio ficheiro contém regras de trabalho ou trabalho guardado, e só para uma tarefa normal: não uma tarefa de resumo, um marco, um hammock nem uma tarefa em tempo decorrido. Consulte [Regras de trabalho: duração, unidades e trabalho](docs://uitleg-werkregels).

## Hammock

- **Hammock (duração derivada)** — deixa a duração resultar de duas outras tarefas, em vez de ter uma duração própria. Padrão: desligado. Só para uma tarefa normal, portanto não para um marco ou uma tarefa de resumo. Ativado: *Driver de início* mostra as predecessoras com uma relação fim-início ou início-início, *Driver de fim* mostra as que têm uma relação fim-fim ou início-fim, cada uma com o tipo de relação a seguir. Se não tiver driver de fim, mostra *Sem driver de fim (FF/SF) — o intervalo volta a comprimento zero.* e a duração é zero. Consulte [Criar um hammock](docs://howto-hammock).

## Restrição e prazo

Numa tarefa de resumo, uma restrição ou um prazo não tem efeito: o cálculo só calcula as tarefas folha e deriva as datas de uma tarefa de resumo das suas subtarefas.

- **Restrição** — um limite de data para a tarefa. Escolhas: *O mais cedo possível (ASAP)*, *O mais tarde possível (ALAP)*, *Não começar antes de (SNET)*, *Não começar depois de (SNLT)*, *Não terminar antes de (FNET)*, *Não terminar depois de (FNLT)*, *Deve começar em (MSO)* e *Deve terminar em (MFO)*. Padrão: *ASAP*, que significa sem restrição. Escolha *ASAP* e todas as restrições da tarefa desaparecem; escolha *ALAP* e a restrição secundária desaparece. Efeito após *Calcular*: um limite move a tarefa ou torna a folga negativa. Consulte [Restrições e prazos](docs://uitleg-constraints).
- **Data da restrição** — a data que pertence à restrição. Visível para todas as restrições, exceto *ALAP*. Obrigatório; uma nova restrição recebe o início planeado como data.
- **Obrigatório (lógica de fixação)** — só para *MSO* e *MFO*. Padrão: desligado. Ativado: a data é rígida, substitui as relações e fixa a barra mesmo antes das suas predecessoras. Uma violação torna a folga negativa a montante. Na primeira vez que o ativa, aparece uma explicação, uma única vez.
- **Restrição secundária** e **Data secundária** — um segundo limite, só um de *SNET*, *FNET*, *SNLT* ou *FNLT* (ou *(nenhum)*). Fica visível assim que exista uma restrição principal que não seja ASAP, ALAP nem uma fixação rígida. É sempre flexível. Uma combinação proibida recebe um contorno vermelho e um motivo: uma restrição secundária não pode ser rígida, nem com MSO/MFO ou uma fixação rígida, nem com ASAP/ALAP, tem de ser um limite, e a principal e a secundária não podem limitar o mesmo lado. Um par válido é, por exemplo, SNET com FNLT.
- **Prazo** — uma data-alvo para o fim. Vazio = sem prazo. Efeito: a tarefa não se move por causa dele. Se o fim antecipado for mais tarde, a folga fica negativa e a aplicação indica *Prazo … não cumprido — fim antecipado …*.

## Progresso

- **Progresso (%)** — um cursor de 0 a 100. Padrão: 0. Efeito: acima de 0, a aplicação preenche um *Início real* em falta, e 100 preenche o *Fim real*. O estado acompanha: *Não iniciada* sem início real, *Em andamento* com início real e *Concluída* com fim real. A duração restante (*Restante*) é a duração × (1 − progresso), arredondada a dias inteiros para uma tarefa em dias e a minutos inteiros para uma tarefa em horas. O trabalho feito é medido até à data de estado; se ainda não houver data de estado, a aplicação define-a para hoje e indica-o. Numa tarefa de resumo o campo fica desativado: o progresso acompanha as subtarefas após *Calcular* (*Derivado das subtarefas: altere o progresso nelas. A tarefa de resumo acompanha após calcular (F5).*).
- **Início real** — a data em que a tarefa realmente começou. Uma data posterior ao fim real ou à data de estado é recusada. Se a tarefa estiver planeada para começar só depois da data de estado e agora tiver progresso, a janela pede *Indicar o início real*. Para um marco há um só campo, *Data real*, em vez de *Início real* e *Fim real*.
- **Fim real** — a data em que a tarefa foi realmente concluída. Preencher este campo define o progresso a 100 e o estado a *Concluída*; apagá-lo define o progresso de novo a 0 e o estado a *Em andamento*. As mesmas recusas do *Início real*.
- **Restante** — só leitura (não para um marco): quanto da duração resta, na unidade da tarefa.

A janela aplica estas regras ao rascunho; só contam após *Guardar*. Consulte [Progresso, data de estado e linha de base](docs://uitleg-voortgang).

## Resultado CPM

- **Resultado CPM** — vista em só leitura do último cálculo: *Início antecipado*, *Fim antecipado*, *Início tardio*, *Fim tardio*, *Folga total*, *Folga livre*, *Folga interferente* e *Caminho crítico* (*Sim* ou *Não*). A folga está em dias úteis, com duas casas decimais. Está desatualizado ou ainda não calculado? Clique em *Calcular*.

## Dependências

- **Dependências** — as relações desta tarefa, uma linha por relação: a tarefa vinculada (no painel, o código WBS, ou o nome se este faltar; na janela, o nome), um ícone de relâmpago se a relação for determinante (*Relação determinante (driving)*, após um cálculo), o tipo de relação (*FS*, *SS*, *FF* ou *SF*), o desfasamento e um caixote. No painel, o código WBS é um botão: ao apontar para ele mostra a tarefa, ao clicar salta para ela. Uma pequena marca antes do código mostra o papel: uma marca redonda dourada para uma predecessora e um quadrado roxo para uma sucessora, com as mesmas cores de [Seguir um caminho](docs://howto-pad-traceren). O papel também consta do nome do botão, para um leitor de ecrã. Na janela é texto simples, e a secção só aparece se a tarefa tiver relações.
- **Desfasamento** — escreva um número com unidade: `2d` dias úteis, `3ed` dias de calendário, `2u` ou `2h` horas úteis, `3eu` ou `3eh` horas de calendário, `50%` uma percentagem da duração da predecessora, `-25e%` uma percentagem em tempo de calendário. Um sinal de menos torna-o num avanço. Sem unidade, conta em dias úteis. Uma entrada inválida torna o campo vermelho e volta atrás. Consulte [Relações e desfasamento](docs://uitleg-relaties).
- **Adicionar relação** (só no painel) — abre uma linha de rascunho. Em *Direção*, escolha *Predecessora* ou *Sucessora*, procure a tarefa com *Procurar tarefa…* pelo WBS ou pelo nome, escolha o tipo e o desfasamento, e confirme com *Criar relação* (ou *Cancelar*). Uma relação duplicada, ou uma relação com a própria tarefa pai, é recusada com uma mensagem, e a linha mantém-se.

## Interrupções

Só no painel, e não para um marco, uma tarefa de resumo, um hammock, uma tarefa em tempo decorrido, uma tarefa agendada manualmente ou uma tarefa demasiado curta para uma interrupção.

- **Interrupções** — pausas no trabalho da tarefa. Uma linha por pausa: *após* (quanto trabalho existe antes da pausa), *pausa* (a duração) e a unidade (*dias úteis*; para uma tarefa em horas, *horas*), com o início e o fim do segmento seguinte por baixo. Uma pausa criada pelo nivelamento tem o distintivo *nivelamento*. Uma pausa com duração 0 remove-a; o cesto de cada linha (*Remover a interrupção*) também a remove. Efeito: a barra é desenhada interrompida e, depois de *Calcular*, o fim move-se pela duração da pausa.
- **Adicionar interrupção** — adiciona uma pausa de uma unidade de tempo a meio do segmento mais longo. Desativado quando não há espaço para uma pausa.
- **Remover todas as interrupções** — aparece quando as interrupções vêm de um ficheiro de origem numa forma que não pode ser editada aqui (*Estas interrupções vêm do ficheiro de origem numa forma que não pode ser editada aqui.*). Nesse caso vê só as datas.

Veja [Dividir uma tarefa](docs://howto-taak-splitsen).

## Atribuições

- **Atribuições** — os recursos desta tarefa. Por recurso: o nome com um cesto (*Remover*), *Unid./dia*, *Trabalho (rest.)*, *Curva*, um botão *Distribuição de horas…* e *Mover para…*. No fim está uma lista *Atribuir recurso*; atribui o recurso com 1 unidade por dia. Sem recursos, indica *Crie primeiro recursos (separador Recursos).*; quando todos estão atribuídos, indica *Todos os recursos já estão atribuídos.* Para um marco ou uma tarefa de resumo, indica que não é possível atribuir.
- **Unid./dia** — quanto do recurso a tarefa usa por dia, um número acima de 0. Efeito: a carga no histograma e a sobrealocação e, com uma regra de trabalho, o trabalho.
- **Trabalho (rest.)** — trabalho restante, em horas, para este recurso. Só visível quando as regras de trabalho estão visíveis e a tarefa tem uma; para material aparece um travessão. O cadeado mostra qual canto a regra de trabalho protege (*Protegido pela regra de trabalho …*). O triângulo de aviso (*Difere de unidades × duração*) significa que o trabalho guardado não é igual a unidades × duração restante; o histograma segue então o trabalho guardado.
- **Curva** — a forma como o trabalho se distribui pela duração: *Uniforme*, *Carregado no início*, *Carregado no fim*, *Em sino*, *Pico inicial*, *Pico tardio*, *Pico duplo* ou *Tartaruga*. Padrão: *Uniforme*. Se a atribuição tiver uma distribuição de horas própria, indica *Contorno* e a lista fica desativada; uma curva importada chama-se *Curva importada*.
- **Distribuição de horas…** — abre a distribuição de horas por dia útil desta atribuição. Veja [Ajustar a distribuição de horas](docs://howto-urenverdeling-aanpassen).
- **Mover para…** — move a atribuição para outra tarefa sem subtarefas que ainda não tenha o recurso. Só visível quando existe uma tarefa dessas.

## Códigos e campos

- **Códigos e campos** — só visível quando o projeto tem códigos de atividade ou campos personalizados. Cada código de atividade é uma lista com *(nenhum)* e os valores como `código — descrição`; por tipo escolhe no máximo um valor. Cada campo personalizado tem uma entrada que corresponde ao seu tipo: *Texto*, *Número*, *Número inteiro*, *Custo*, *Data* ou *Sim/não*. Efeito: nenhum efeito no cálculo; pode agrupar e filtrar por eles e mostrá-los como colunas. Veja [Códigos e campos personalizados](docs://howto-codes-en-velden).

## Marcadores da regra de trabalho

Só no painel, e só quando se aplicam.

- **Período longo não útil** — *Esta tarefa atravessa um período não útil de … dias (… a …).*, ou com o nome do feriado ou do feriado de obra acrescentado. Aparece quando a tarefa atravessa um período contínuo de 8 dias ou mais que contém pelo menos um feriado. É um aviso, não uma recusa; verifique se o planeamento é mesmo assim que pretende.
- **Marcador do MS Project** — um distintivo *Segue a distribuição de horas do MS Project*, *Janela de datas do MS Project já não aplicada após edição — …* ou *Distribuição de horas própria*, com *Saiba mais*. Indica se a distribuição de horas de um ficheiro do MS Project ainda define as datas.
- **Datas registadas** — um distintivo para um ficheiro importado com datas registadas: *Mostra as datas tal como registadas no ficheiro para esta tarefa* (para um ficheiro do Primavera, *Mostra as datas próprias registadas pelo Primavera para esta tarefa*), *Diverge das datas registadas* ou *Registo parcialmente incompleto — ver as colunas de fim tardio/folga*, com *Saiba mais*. Veja [Datas tal como registadas](docs://uitleg-datums-zoals-opgeslagen).

## Cabeçalho e rodapé do painel

- **Eliminar tarefa** — o cesto ao lado do título *Tarefa*; elimina esta tarefa juntamente com as respetivas subtarefas, como um único passo em *Desfazer*. Depois disso, o planeamento fica desatualizado até carregar em *Calcular*.
- **Calcular** — o botão na parte inferior; faz o mesmo cálculo que *Início › Agendamento › Calcular*.

## O que não encontra aqui

- **Prioridade de nivelamento** — não está na janela nem no painel. Defina-a clicando com o botão direito e escolha *Prioridade* (*Baixa* = 100, *Normal* = 500, *Alta* = 900), ou escreva um número de 0 a 1000 na coluna *Prioridade de nivelamento*. Padrão: 500. Efeito: o nivelamento não move primeiro as tarefas com prioridade mais alta; 1000 fixa a tarefa, para que o nivelamento nunca a mova. Veja [Nivelamento](docs://uitleg-nivelleren).
- **Outros dados da tarefa** — o restante do que uma tarefa contém, como as colunas *Agendada manualmente*, *Cor* e as colunas técnicas, só está na tabela; veja [Colunas da tabela](docs://ref-tabelkolommen).
