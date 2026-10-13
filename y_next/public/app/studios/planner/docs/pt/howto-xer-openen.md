# Abrir um ficheiro Primavera P6 (.xer)

Objetivo: abrir um planeamento do Primavera P6 diretamente na aplicação, sem o exportar primeiro para XML.

## Quando precisa disto

Um cliente ou um empreiteiro principal trabalha com o Primavera e entrega o planeamento como ficheiro `.xer`. Pretende ver, calcular ou acrescentar dados ao planeamento. A aplicação só lê ficheiros `.xer`: não escreve `.xer` e nunca altera o seu ficheiro. Do ficheiro obtém a estrutura WBS e as tarefas com duração, datas, restrições e progresso, as relações com desfasamento, os calendários e os recursos com as respetivas atribuições, além de códigos de atividade, campos personalizados (UDFs), notas e as definições de planeamento do P6. Uma tarefa do tipo *Nível de esforço* torna-se um hammock.

## Passos

1. Escolha *Início › Ficheiro › Abrir* ou prima Ctrl+O. Escolha o ficheiro `.xer`.
2. A aplicação abre um separador para cada projeto que tem tarefas. O projeto com mais tarefas é o separador ativo. Um separador tem o nome *Nome do projeto (ID do projeto)* se o ID do projeto P6 for diferente do nome.
3. Leia a mensagem na parte inferior. Para um ficheiro com três projetos, pode ter este aspeto: *Ficheiro XER aberto: 3 documentos de projeto.* Por baixo estão linhas que explicam o que a aplicação fez. Veja o título abaixo.
4. Verifique se existe uma barra de mensagens por baixo do friso: *Está a ver o planeamento tal como o Primavera o registou; recalcular deslocaria 1 tarefa.* O Primavera regista no ficheiro as datas que calculou. Se o cálculo da aplicação for diferente, a aplicação mostra as datas do Primavera enquanto não alterar nada. O que isso significa e como muda para o cálculo próprio da aplicação está em [Datas tal como registadas](docs://uitleg-datums-zoals-opgeslagen). Também pode aparecer a mensagem *Este ficheiro contém planeamento por horas.*, com o botão *Ativar planeamento por horas*. Veja [Ativar o planeamento por horas](docs://howto-urenplanning-aanzetten).
5. Guarde o projeto com Ctrl+S. Como um `.xer` nunca é substituído, a aplicação pergunta onde deve ficar o novo ficheiro IFC. Sugere *Nome do projeto (ID do projeto)* como nome do ficheiro.

### As linhas abaixo da mensagem

A primeira linha da mensagem indica o número de separadores abertos. Por baixo estão apenas as linhas que se aplicam. Estas merecem a sua atenção:

- *Este projeto calcula como Primavera P6. Altere em Ficheiro → Info do projeto → Perfil de cálculo e opções.* A aplicação calcula este projeto com as regras de cálculo do Primavera. Com *Abrir perfil de cálculo* chega à definição.
- *1 projeto de linha de base excluído.* e *1 linha de base materializada.* Se um projeto do P6 designar outro projeto como linha de base, esse outro projeto não se abre como separador próprio. Passa a ser a linha de base ativa do projeto que o referencia.
- *Foi usada uma alternativa protetora para a linha de base.* Se designar linhas de base significasse que nenhum projeto se abre, se um projeto se referisse a si próprio ou se os projetos se referissem uns aos outros em ciclo, a aplicação abre simplesmente todos os projetos e não cria linhas de base.
- *1 relação externa preservada.* Uma relação entre dois projetos. A aplicação guarda-a como dados de origem, mas não a transforma numa relação do seu planeamento.
- *1 tarefa mostra as datas tal como registadas pelo Primavera (sem recalcular).* É o número de tarefas que vê na vista *Datas tal como registadas*.

As outras linhas são diagnósticos da própria leitura: o número de projetos encontrados, um projeto vazio ignorado, uma referência de linha de base sem destino, ignorada, uma codificação de texto diferente de UTF-8 simples e contadores de resultados nas tabelas, nos calendários e nos números, para valores de campos desconhecidos e para definições de planeamento do P6 que a aplicação substituiu por uma escolha segura. Não exigem nada de si. *Saiba mais* abre a Ajuda sobre a abertura de ficheiros do Primavera.

## Armadilhas e o que a aplicação faz nesse caso

**Nem tudo se torna um separador ou uma relação.** Um projeto sem tarefas não se abre, um projeto de linha de base não se abre como separador próprio e uma relação entre dois projetos não se torna uma relação do seu planeamento. A aplicação indica isso nas linhas abaixo da mensagem.

**Cada separador é um projeto próprio.** Se guardar um deles, o ficheiro IFC guarda também o `.xer` original completo. Se reabrir mais tarde esse ficheiro IFC, a aplicação continua a conhecer as datas do Primavera. Se esse ficheiro de origem estiver danificado, ou se outro programa IFC tiver reescrito o ficheiro, a aplicação indica: *O ficheiro de origem XER deste ficheiro é inutilizável e foi omitido; o projeto em si foi aberto por completo.* O planeamento, o perfil de cálculo e todos os dados do projeto estão completos. O que falta são as datas tal como o Primavera as guardou e a proveniência da origem para a IA e para as extensões. Abra de novo o `.xer` original para recuperar o ficheiro de origem.

**Uma exportação para CSV, XML do MS Project ou XML do P6 perde dados.** A aplicação avisa: *A exportação para CSV perde informações de origem XER.* O IFC não perde nada.

**Um ficheiro que a aplicação não consegue ler.** Recebe uma mensagem de erro, com o motivo. Alguns exemplos:

- *Este não é um ficheiro XER válido ou compatível.*
- *Uma tabela XER não contém colunas obrigatórias.*
- *O projeto P6 neste ficheiro XER não contém atividades.*

Nesse caso, nada se abre. Verifique o ficheiro no P6 ou peça ao remetente uma nova exportação.

## Ver também

- [Ficheiros e formatos](docs://uitleg-bestanden): porque é que um `.xer` só é lido e o que perde uma exportação.
- [Datas tal como registadas](docs://uitleg-datums-zoals-opgeslagen): a vista das próprias datas do Primavera.
- [Abrir um ficheiro do MS Project (.mpp)](docs://howto-mpp-openen): o mesmo para o MS Project.
- [Ativar o planeamento por horas](docs://howto-urenplanning-aanzetten): se o ficheiro contiver dados em horas.
- [Formatos de importação e exportação](docs://ref-import-exportformaten): por formato, o que é transferido e o que não é.
- [Perfis de cálculo e convenções](docs://uitleg-rekenprofielen): porque é que um ficheiro P6 se abre com o seu próprio perfil de cálculo.
