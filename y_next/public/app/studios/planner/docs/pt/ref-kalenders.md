# Janelas do calendário

A janela *Calendários* gere a biblioteca de calendários do projeto: quais dias úteis, tempo de trabalho e dias não úteis existem, e qual calendário é o calendário do projeto. O formulário ao lado da lista é igual ao da janela *Calendário do recurso*. Este artigo explica, para cada campo, o que faz, qual é o padrão e o que nota dele. Como criar um calendário e o atribuir a tarefas está em [Criar e atribuir um calendário](docs://howto-kalender-maken-en-toewijzen); como a aplicação conta os dias úteis está em [Calendários e dias úteis](docs://uitleg-kalenders).

## Onde encontrar

- **Calendários** — *Planeamento › Calendário › Calendário* ou *Definições › Calendário › Calendário*.
- **Calendário de uma tarefa** — o campo *Calendário* na janela *Editar tarefa* ou no painel *Propriedades*. Veja [Janela de tarefa e painel de propriedades](docs://ref-taak-eigenschappen).
- **Calendário do recurso** — o painel *Recursos*, coluna *Calendário*: escolha um calendário, escolha *+ Calendário do recurso* para um novo, ou clique no lápis (*Editar…*) do calendário escolhido. Veja [Painel de recursos](docs://ref-resourcepaneel).

## A biblioteca na janela Calendários

À esquerda está a lista de calendários, à direita o formulário do calendário escolhido. O calendário do projeto tem uma estrela. Um calendário com dados inválidos tem um triângulo vermelho (*Este calendário contém dados inválidos*).

- **Novo calendário** (o sinal de mais) — adiciona um calendário com o nome *Novo calendário* e o conteúdo padrão da aplicação: de segunda a sexta, das 07:00 às 16:00, 8 horas líquidas. Se *Ativar o modo construção* estiver ativo (o padrão), entram também os feriados neerlandeses, sem as férias da construção; se estiver desativado, a lista fica vazia. Se não quiser esses feriados, escolha *Gerar feriados…* e, nessa janela, *Sem feriados*. (Os nomes *Bouwkalender NL* e *Standaardkalender* continuam em neerlandês em todas as línguas.)
- **Duplicar** — copia o calendário escolhido com o nome *{name} (duplicado)*.
- **Eliminar** (o ícone do caixote) — elimina o calendário escolhido. Fica desativado quando só resta um calendário. Se era o calendário do projeto, o primeiro calendário restante passa a ser o calendário do projeto. As tarefas e os recursos que usavam o calendário passam a usar o calendário do projeto.
- **Definir como padrão do projeto** — torna o calendário escolhido o calendário do projeto. No calendário que já o é, aparece *Calendário do projeto* com uma estrela. Efeito: toda a tarefa sem calendário próprio usa este calendário, e o mesmo vale para um recurso sem calendário próprio. Uma tarefa à qual atribuiu um calendário mantém-no.
- **Aplicar** — grava todas as alterações de toda a lista no projeto de uma só vez, recalcula o planeamento e fecha a janela. Não recalcula se, no total, nada mudou. Fica desativado enquanto um dos calendários tiver dados inválidos. Enter num campo de texto normal faz o mesmo, mas mantém a janela aberta.
- **Cancelar** — fecha a janela e descarta tudo o que alterou desde a abertura (ou desde o último Enter). Esc e a cruz atuam como *Cancelar*. Um clique ao lado da janela não faz nada, para não perder o que introduziu.

Por padrão, um projeto tem o calendário *Bouwkalender NL* (modo construção ativo) ou *Standaardkalender* (modo construção desativado), que tem dias úteis de segunda a sexta, das 07:00 às 16:00.

## O formulário

### Dados básicos

- **Nome** — o nome na lista e nas listas de escolha das tarefas e dos recursos.
- **Dias úteis** — um botão por dia da semana, de *Seg* a *Dom*; um botão premido é um dia útil. A ordem segue *A semana começa em* (*Definições*, separador *Planeamento*). Padrão: de *Seg* a *Sex*. Dois botões rápidos: *Seg–sex* define de segunda a sexta, das 07:00 às 16:00, 8 horas; uma pausa configurada passa a ser a pausa implícita das 12:00, de novo 60 minutos; *Contínuo (24/7)* define os sete dias, das 00:00 às 24:00, 24 horas. Efeito: uma tarefa só trabalha em dias úteis. A aplicação não consegue calcular um calendário sem dias úteis (*O calendário não tem dias úteis definidos*).
- **Início (hora)** e **Fim (hora)** — o início e o fim do dia útil, no formato HH:MM de 24 horas. Padrão: 07:00 e 16:00. As setas (ou as teclas de seta) ajustam em passos de 15 minutos; o fim pode ser 24:00, e o início tem de ser anterior ao fim. Efeito: juntamente com a pausa, determinam as horas líquidas por dia. Não contam para as datas de uma tarefa em dias; contam para as tarefas em horas. Estes campos desaparecem quando *Ativar planeamento por horas* está ativo e o calendário tem tempos de trabalho por dia da semana: estes têm então prioridade.
- **Início da pausa** e **Duração da pausa (minutos)** — o início e a duração da pausa, com os mesmos passos de 15 minutos. Padrão: 12:00 e 60 minutos. Se definir a duração como 0, o dia útil é contínuo. A pausa tem de ficar totalmente dentro do dia útil e não pode ocupar tudo. Efeito: as horas líquidas são o fim menos o início menos a pausa; numa tarefa em horas, não se trabalha durante a pausa. Os mesmos campos desaparecem nas mesmas condições que *Início (hora)*.
- **Horas líquidas por dia** — só leitura: a duração derivada de um dia útil, com duas casas decimais, por exemplo *8,00 h*. Padrão: 8. Efeito: é o comprimento de um dia ao converter entre dias e horas e para as tarefas em horas. Veja [Dias e horas](docs://uitleg-dagen-en-uren).

### Horários de trabalho

Este bloco só aparece quando *Ativar planeamento por horas* está ativo (*Definições*, separador *Planeamento*). Aqui define os tempos de trabalho e os turnos por dia da semana. Veja [Definir horários de trabalho](docs://howto-werktijden-instellen).

- **Predefinições** — botões que definem os tempos de trabalho de uma só vez: *Turno diurno* (Seg–sex, 08:00 às 16:00, um calendário de dia normal), *2 turnos* (Seg–sex, 06:00 às 22:00, 16 horas), *3 turnos* (Seg–sex, 06:00 às 06:00 do dia seguinte, 24 horas), *Turno noturno* (Seg–sex, 22:00 às 06:00, 8 horas) e *24/7* (todos os dias, 00:00 às 24:00). Por trás dos botões incorporados estão as suas próprias predefinições, com uma cruz para as eliminar.
- **Guardar como predefinição…** — guarda os tempos de trabalho atuais como predefinição própria, neste dispositivo, para os poder reutilizar em qualquer projeto. Dê um nome (*Nome da predefinição*) e clique em *Guardar* ou em *Cancelar*.
- **Definir por dia da semana…** — transforma um calendário de dias num calendário de horas: os horários atuais passam a ser as faixas de trabalho de cada dia útil, com a pausa como intervalo. Num calendário de horas, o botão chama-se *Ocultar horários de trabalho* ou *Mostrar horários de trabalho* e recolhe ou expande o editor. Num calendário de horas, o editor está aberto por padrão.
- **O editor** — por dia da semana, uma lista de faixas (*faixa*) com hora de início e de fim. A marca *dia seguinte* permite que uma faixa passe da meia-noite (um turno noturno). *Adicionar faixa* (o sinal de mais) acrescenta 08:00 às 16:00. *Copiar para todos os dias úteis* (só em Seg–sex) copia as faixas desse dia para segunda a sexta. Um dia sem faixas chama-se *Não útil*. No fim está *Horas/dia derivadas:*, e assim que um dia tem mais de uma faixa aparece a indicação *Um intervalo entre duas faixas é uma pausa — ajuste os horários conforme necessário.* Efeito: as faixas têm prioridade. Um dia da semana com faixas é um dia útil, e os campos *Início (hora)*, *Fim (hora)* e a pausa desaparecem.

### Feriados

- **Gerar feriados…** — abre o gerador. *País* escolhe *Países Baixos*, *Alemanha*, *Bélgica*, *França*, *Reino Unido*, *Áustria*, *Suíça* ou *Sem feriados*. *Região* só aparece se o país tiver regiões; padrão *Nacional*. *Férias da construção* só aparece para os Países Baixos e quando *Ativar o modo construção* está ativo, com as opções *Nenhuma* (padrão), *Norte*, *Centro* e *Sul*, e a indicação *Datas indicativas — verifique junto à Bouwend Nederland*. Uma linha de pré-visualização indica quantos feriados vão entrar (*… feriados, …–…*), e pode expandi-la para ver a lista. *Gerar* põe o resultado no calendário que está a editar (só conta depois de *Aplicar*); *Cancelar* fecha o gerador. Efeito: toda a lista *Feriados* é substituída, incluindo o que acrescentou. Os anos que o gerador cobre vão desde o ano anterior ao início do projeto até ao ano seguinte ao fim do projeto, inclusive (sem fim do projeto: até três anos depois do início). Veja [Gerar feriados e as férias da construção](docs://howto-feestdagen-genereren).
- **Gerar novamente** — aparece ao lado do botão quando os feriados gerados já não cobrem o período do projeto, com o texto *Os feriados cobrem …–…; o projeto vai até …. Gerar novamente?* Um clique volta a gerar a mesma escolha (país, região, férias da construção) para o novo período. Sem ele, os dias fora dos anos gerados são dias úteis normais.
- **Feriados** — a lista de dias não úteis: *Descrição*, *A partir de* e *Até*, e um caixote por linha. *Adicionar feriado* acrescenta uma linha com a data de hoje em *A partir de* e *Até* vazio. Um *Até* vazio significa um único dia. Sem linhas, aparece *Ainda sem feriados*. Efeito: todos os dias do período são dias não úteis neste calendário, para as tarefas deste calendário e para os recursos que o usam. Uma linha inválida fica com uma moldura vermelha e um texto (*Introduza uma data de início válida.*, *Introduza uma data de fim válida ou deixe-a vazia para um único dia.* ou *A data de fim é anterior à data de início.*) e bloqueia *Aplicar*.

### Mensagens de erro e exceções

Os erros nos tempos de trabalho aparecem abaixo dos campos e bloqueiam *Aplicar*: *Introduza uma hora de início válida no formato HH:MM.*, *Introduza uma hora de fim válida no formato HH:MM.*, *A hora de início tem de ser anterior à hora de fim.*, *Introduza uma hora de pausa válida como HH:MM.*, *A duração deve ser um número inteiro de minutos igual ou superior a 0.*, *A pausa deve ficar totalmente dentro do dia útil.* e *A pausa não pode ocupar todo o dia útil.*

O calendário só conhece os dias não úteis como exceção. Um calendário de um ficheiro MS Project ou Primavera pode também ter exceções de dias úteis, um dia útil extra; a janela não mostra nem edita essas exceções.

## A janela Calendário do recurso

- **Calendário do recurso** — o formulário acima, numa janela só com *Aplicar* e *Cancelar*. Esc e a cruz atuam como *Cancelar*; um clique ao lado da janela não faz nada, e Enter também não faz nada aqui. Edita um só calendário: um existente ou um novo, com o nome padrão *Calendário do recurso*, que fica ligado ao recurso depois de *Aplicar* (*Cancelar* não deixa nada para trás). Se o abrir na vista *Biblioteca* do painel de recursos, edita um calendário da biblioteca de recursos; na vista *Projeto*, edita o calendário do projeto, mesmo que tenha vindo da biblioteca. Efeito: um calendário de recurso define quando o recurso está disponível no histograma, na sobrealocação e no nivelamento; não altera as datas de uma tarefa. *Aplicar* não recalcula. Se o calendário também estiver em tarefas ou for o calendário do projeto, o planeamento muda: fica marcado como desatualizado, e *Calcular* recalcula-o. Veja [Definir um calendário de recurso](docs://howto-resourcekalender-instellen).
