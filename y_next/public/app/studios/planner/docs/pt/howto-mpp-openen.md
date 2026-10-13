# Abrir um ficheiro do MS Project (.mpp)

Objetivo: abrir um planeamento do Microsoft Project diretamente na aplicação, sem o exportar primeiro.

## Quando precisa disto

Um empreiteiro, um consultor ou um cliente envia-lhe o planeamento como ficheiro `.mpp`. Quer vê-lo, calculá-lo ou desenvolvê-lo mais. A aplicação lê ficheiros `.mpp` desde o MS Project 2010 até 2021, inclusive. Só lê: não escreve `.mpp` e nunca altera o seu ficheiro. Do ficheiro retira o próprio planeamento: tarefas com estrutura, duração e restrições, relações com desfasamento, calendários, recursos, atribuições e progresso. Também lê as datas e a folga que o MS Project calculou sozinho, mas usa-as apenas para a vista *Datas tal como registadas*, nunca como entrada.

## Passos

1. Escolha *Início › Ficheiro › Abrir* ou prima Ctrl+O. Escolha o ficheiro `.mpp`.
2. A aplicação abre o projeto num novo separador, ou no separador atual se este ainda estava vazio e sem alterações. O projeto não tem ficheiro. *Guardar* mais tarde escreve um novo ficheiro IFC.
3. Leia a mensagem na parte inferior: *Este projeto calcula como Microsoft Project. Altere em Ficheiro → Info do projeto → Perfil de cálculo e opções.* A aplicação calcula este projeto com as regras de cálculo do MS Project: o perfil de cálculo *Microsoft Project*. Com *Abrir perfil de cálculo* vai para a definição. *Saiba mais* abre a Ajuda sobre perfis de cálculo.
4. Verifique se aparece uma mensagem abaixo do friso: *Está a ver as datas tal como estão registadas no ficheiro; recalcular deslocaria 4 tarefas.* Nessas tarefas, o resultado da aplicação difere então das datas que o MS Project guardou. Por baixo da mensagem do passo 3 aparece também uma linha: *4 tarefas mostram as datas tal como registadas no ficheiro (sem recalcular).* O que isso significa e como passar para o cálculo próprio da aplicação está em [Datas tal como registadas](docs://uitleg-datums-zoals-opgeslagen).
5. Se aparecer *Este ficheiro contém planeamento por horas.* com o botão *Ativar planeamento por horas*, o ficheiro contém dados em horas. Veja [Ativar o planeamento por horas](docs://howto-urenplanning-aanzetten).

Se o ficheiro contiver tarefas com divisões, nivelamento ou um planeamento controlado por recursos, aparece outra mensagem, por exemplo *Este ficheiro do MS Project contém 3 tarefas com um cronograma dividido, nivelado ou controlado por recursos. Elas são importadas e exibidas como estão.* Para uma tarefa, a mensagem aparece no singular.

## Pontos de atenção e o que a aplicação faz nesse caso

**Nem tudo é transferido.** A aplicação não importa linhas de base, custos e tarifas, notas nem os campos personalizados do MS Project. Um código WBS que preencheu por si no MS Project é importado. Caso contrário, a aplicação numera as tarefas de acordo com a estrutura.

**Um ficheiro do MS Project 2007 ou anterior.** A aplicação recusa-o e apresenta: *Este ficheiro .mpp usa um formato antigo (Project 2007 ou anterior). Exporte-o no MS Project como XML (Ficheiro → Guardar como → XML) e abra esse ficheiro.* Por baixo da mensagem, a aplicação acrescenta um motivo técnico em inglês.

**Um ficheiro com senha.** A aplicação apresenta: *Este ficheiro .mpp está protegido por senha. Exporte-o no MS Project como XML (Ficheiro → Guardar como → XML) e abra esse ficheiro.* Também aqui a mensagem traz um motivo técnico em inglês.

**Um ficheiro que não é um `.mpp`.** Recebe *Falha ao abrir o ficheiro*, com um motivo técnico.

**O caminho pelo XML calcula de outra forma.** Se abrir a exportação XML do MS Project em vez do `.mpp`, a aplicação calcula com o perfil de cálculo *Open Planner Studio* e não vê a mensagem sobre *Microsoft Project*. As datas podem então ser diferentes das do ficheiro `.mpp`.

**Uma edição faz o MS Project perder o controlo.** Se editar uma tarefa cujo planeamento era controlado pela janela de datas do MS Project, a aplicação apresenta a mensagem uma vez por projeto: *A distribuição de horas do MS Project não controla mais 2 tarefas após esta edição; a distribuição original permanece guardada no ficheiro.* Para uma tarefa, a mensagem aparece no singular.

**Guardar nunca substitui o seu `.mpp`.** O projeto não tem ficheiro. *Guardar* pergunta onde deve ficar o novo ficheiro IFC.

## Veja também

- [Ficheiros e formatos](docs://uitleg-bestanden): porque é que um `.mpp` só é lido e o que *Guardar* escreve.
- [Datas tal como registadas](docs://uitleg-datums-zoals-opgeslagen): a vista das próprias datas do MS Project.
- [Ativar o planeamento por horas](docs://howto-urenplanning-aanzetten): se o ficheiro contiver dados em horas.
- [Abrir um ficheiro do Primavera P6 (.xer)](docs://howto-xer-openen): o mesmo para o Primavera.
- [Formatos de importação e exportação](docs://ref-import-exportformaten): por formato, o que é transferido e o que não é.
- [Perfis de cálculo e convenções](docs://uitleg-rekenprofielen): porque é que um ficheiro do MS Project abre com o seu próprio perfil de cálculo.
