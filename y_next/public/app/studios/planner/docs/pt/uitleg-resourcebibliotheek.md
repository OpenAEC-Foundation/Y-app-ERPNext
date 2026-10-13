# A biblioteca de recursos

A sua equipa de alvenaria não trabalha só para um projeto. Hoje está nas casas do norte, amanhã nas garagens do sul. Uma biblioteca de recursos é o sítio onde regista uma equipa destas uma vez, para que todos os projetos usem a mesma equipa. A aplicação consegue então também ver quando dois projetos pedem as mesmas pessoas no mesmo dia, o que nenhum projeto isolado consegue ver. Neste artigo, fica a saber como a biblioteca de recursos e o projeto se relacionam e como a aplicação conta a ocupação entre projetos.

## O conceito

Há duas camadas.

A **biblioteca de recursos** é a lista de recursos e calendários que pertencem à sua organização: um pedreiro, um guindaste, um estucador, com o respetivo tipo, tarifa e quantidade disponível. A própria lista, que a aplicação também chama **pool**, não está nos ficheiros do projeto, mas na aplicação: na aplicação de secretária, num ficheiro neste computador; no navegador, no armazenamento desse navegador. Se apagar os dados do site no navegador, a biblioteca de recursos desaparece; por isso, exporte-a como cópia de segurança. Existe sempre pelo menos uma biblioteca de recursos. A primeira chama-se *Mijn resourcebibliotheek* (um nome em neerlandês) e pode mudar-lhe o nome.

O **projeto** decide quanto de um recurso usa e quando. Um projeto está ligado a uma biblioteca de recursos ou existe sozinho. Um projeto isolado funciona bem, mas sem uma lista partilhada.

Um projeto não aponta para a biblioteca de recursos, mas guarda uma **cópia**. Quando atribui *Bricklayer* da biblioteca de recursos a um projeto, a aplicação cria no projeto uma cópia com um **carimbo de origem**: a nota de que esta cópia vem da biblioteca de recursos X e é aí o item Y. Na tabela de recursos reconhece essa cópia por um pequeno ícone da biblioteca. A cópia é um recurso normal: podem-lhe ser atribuídas tarefas, e fica guardada no próprio ficheiro do projeto.

Os calendários da biblioteca de recursos são diferentes da lista de calendários do seu projeto, que gere na caixa de diálogo do calendário. Um calendário da biblioteca de recursos entra no projeto juntamente com o recurso que o utiliza.

## Como a aplicação trabalha com ela

### O que decide a biblioteca de recursos e o que decide o projeto

A biblioteca de recursos decide **o que é um recurso**: o nome, o tipo, a tarifa por hora, a unidade e a descrição. Numa cópia no projeto, estes campos aparecem como texto simples. Altere-os na biblioteca de recursos, para que estejam certos em todos os projetos. Se, afinal, quiser que uma cópia siga o seu próprio caminho, desligue-a da biblioteca de recursos.

O projeto decide **quanto e quando**: *Unidades máx*, a capacidade que muda ao longo do tempo (*Capacidade faseada no tempo*) e o calendário que o recurso tem. Estes campos continuam editáveis no projeto e não contam como desvio da biblioteca de recursos. Afinal, a mesma equipa pode seguir um calendário diferente numa obra urgente do que num projeto normal. O conteúdo de um calendário que veio juntamente com um recurso segue a biblioteca de recursos.

### Quando uma cópia acompanha a biblioteca de recursos

A biblioteca de recursos não atualiza as cópias continuamente, mas em momentos fixos:

- Quando edita algo na biblioteca de recursos, as cópias não editadas em todos os projetos abertos seguem de imediato.
- Quando abre um projeto ou muda para outro separador, a aplicação compara as cópias com a biblioteca de recursos. Se uma cópia não editada estiver desatualizada, a aplicação atualiza-a em silêncio e informa brevemente: *1 item atualizado a partir da biblioteca* ou *N itens atualizados a partir da biblioteca*.

A aplicação guarda os valores do momento em que a cópia foi criada ou atualizada. Se uma cópia agora diferir desses valores, a aplicação não decide quem tem razão. A cópia recebe então a marca *difere — decidir*. Quando abre um ficheiro com essa cópia, a janela *Vincular biblioteca de recursos* abre-se sozinha. Nessa janela, decide-se para cada item se aplica os valores da biblioteca de recursos ou se os valores do ficheiro passam para a biblioteca de recursos. Ao mudar de separador, nunca aparece nenhuma janela.

Um desvio surge, por exemplo, quando liga um recurso próprio do projeto a um item da biblioteca de recursos com o mesmo nome mas com valores diferentes, através de *Para a biblioteca*. A aplicação liga-os e marca logo a cópia como desviada.

### Quando um recurso desaparece da biblioteca de recursos

Se apagar um recurso da biblioteca de recursos, a cópia fica nos seus projetos e continua a funcionar. Recebe a marca *não está mais na biblioteca*. Depois pode editá-la por completo ou retirá-la do projeto.

### Ocupação entre projetos

O histograma e os recursos sobrealocados de um projeto olham apenas para esse projeto. A biblioteca de recursos sabe mais: quantos exemplares de um recurso existem no total. A vista *Ocupação* soma, por dia, a carga de todos os projetos abertos que estão ligados à mesma biblioteca de recursos e usam uma cópia desse recurso. Se a soma num dia for maior do que a capacidade da biblioteca de recursos, esse dia conta como sobrealocado.

Três regras decidem o que conta:

- A capacidade vem da biblioteca de recursos (*Unidades máx* do item da biblioteca, ou a sua *Capacidade faseada no tempo* nesse dia), e não das *Unidades máx* da cópia no projeto. Dois projetos que, cada um, ficam dentro da sua própria alocação podem, ainda assim, pedir demasiado em conjunto.
- Uma soma exatamente igual à capacidade não é um conflito. Tem de ser pedido mais do que a capacidade.
- Só contam as cópias com um carimbo de origem, e só em projetos que estão abertos nesta aplicação naquele momento. Um recurso próprio de um projeto isolado não está na biblioteca de recursos e, por isso, não conta. A vista geral não vê documentos que não estão abertos nesta aplicação; isso também está indicado no fundo da própria vista geral.

## Exemplo prático: a equipa de alvenaria em dois projetos

A biblioteca de recursos contém o recurso *Bricklayer* com *Unidades máx* 3: três pedreiros na folha de pagamento. Dois projetos usam-no, ambos com uma cópia que tem *Unidades máx* 2.

- *Houses North* tem a tarefa *Bricklaying facades* de 5 dias úteis a partir de segunda-feira, 7 de junho de 2027, com 2 unidades por dia. A tarefa decorre de 7 a 11 de junho, inclusive.
- *Garages South* tem a tarefa *Bricklaying garages* de 4 dias úteis a partir de quarta-feira, 9 de junho de 2027, com 2 unidades por dia. O fim de semana não conta, por isso a tarefa abrange 9, 10, 11 e 14 de junho.

Dentro de cada projeto, o *Bricklayer* tem 2 unidades pedidas de um máximo de 2. Nenhum dos projetos indica sobrealocação: em *Recursos › Superalocação*, ambos dizem *Nenhuma*. No entanto, em conjunto, ultrapassam os 3 pedreiros. Por dia, a aplicação conta:

- Segunda-feira 7 e terça-feira 8 de junho: 2 (só *Houses North*)
- Quarta-feira 9, quinta-feira 10 e sexta-feira 11 de junho: 2 + 2 = 4
- Segunda-feira 14 de junho: 2 (só *Garages South*)

O pico é 4, contra uma capacidade de 3. A vista mostra o *Bricklayer* com *2 documentos*, o período *2027-06-07 – 2027-06-14*, *4.0 / 3.0* de pico e capacidade, e *3 dias com reserva dupla*: 9, 10 e 11 de junho.

O que acontece se mudar algo:

- Se a tarefa *Bricklaying facades* demorar 6 dias úteis, a tarefa prolonga-se até segunda-feira, 14 de junho. Nesse dia também se chega a 2 + 2 = 4, por isso a vista indica *4 dias com reserva dupla*: 9, 10, 11 e 14 de junho. O pico mantém-se em 4.
- Se a biblioteca de recursos tiver *Unidades máx* 4, a vista indica *4.0 / 4.0* e não há conflito, porque a soma não é maior do que a capacidade.
- Se *Garages South* trabalhar com 1 unidade por dia em vez de 2, o pico é 3 e a vista indica *3.0 / 3.0*: sem conflito.
- Se *Garages South* só começar na segunda-feira, 14 de junho, os projetos não se sobrepõem. O período passa a ser *2027-06-07 – 2027-06-17* e o pico é *2.0 / 3.0*.

Os passos para ver isto nos seus próprios projetos estão em [Utilizar a visão geral da ocupação](docs://howto-bezettingsoverzicht-gebruiken).

## Consequências e ideias erradas

**«A biblioteca de recursos é partilhada com os meus colegas.»** Não. A biblioteca de recursos vive na aplicação (na aplicação de secretária, num ficheiro neste computador; no navegador, no armazenamento desse navegador) e não é sincronizada. Se dois planeadores trabalharem com a mesma biblioteca de recursos, as bibliotecas podem divergir. Pode partilhar ao exportar e ao importar; veja [Gerir e partilhar bibliotecas de recursos](docs://howto-bibliotheken-beheren). Se a sua organização partilhar equipas entre empresas operacionais, escolha deliberadamente uma biblioteca de recursos comum. A vista geral também só vê os projetos que estão abertos nesta aplicação.

**«Se eu mudar a biblioteca de recursos, tudo nos meus projetos muda.»** Só a identidade do recurso: nome, tipo, tarifa, unidade e descrição. *Unidades máx*, a capacidade ao longo do tempo e a escolha de calendário de um projeto mantêm-se como estão.

**«Posso desfazer uma alteração à biblioteca de recursos.»** Não. A biblioteca de recursos pertence à aplicação e não a um projeto; por isso, as alterações a ela ficam fora de *Desfazer* (Ctrl+Z). A vista *Biblioteca* avisa disso: *Isto edita a biblioteca e aplica-se a todos os projetos — fora do desfazer.* Apagar da biblioteca de recursos também pede confirmação e não pode ser desfeito.

**«A vista geral da ocupação resolve os conflitos.»** Não, a vista geral é apenas uma janela de consulta. Mostra em que dias dois projetos, em conjunto, pedem demasiado. O nivelamento (*Recursos › Nivelamento › Nivelar…*, veja [Nivelamento de recursos](docs://uitleg-nivelleren)) olha para os recursos de um só projeto e não tem em conta os outros projetos. Mova uma tarefa num dos projetos por si próprio, ou altere a capacidade na biblioteca de recursos se alguém se juntar de facto.

**«O meu recurso próprio conta na ocupação.»** Só se estiver na biblioteca de recursos. Um recurso que criou apenas no projeto, como um guindaste alugado para uma única obra, não tem carimbo de origem e, por isso, não está na vista geral. Com *Para a biblioteca*, acrescenta-o.

## Ver também

- [Utilizar a biblioteca de recursos](docs://howto-resourcebibliotheek-gebruiken): vincular, atribuir recursos e resolver desvios.
- [Gerir e partilhar bibliotecas de recursos](docs://howto-bibliotheken-beheren): criar, exportar e importar bibliotecas de recursos.
- [Utilizar a visão geral da ocupação](docs://howto-bezettingsoverzicht-gebruiken): encontrar sobrealocações entre projetos.
- [Gerir recursos](docs://howto-resources-beheren): os recursos de um único projeto.
