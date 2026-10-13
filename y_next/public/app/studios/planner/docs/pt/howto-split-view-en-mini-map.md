# Utilizar a vista dividida e o minimapa

Objetivo: ver duas partes da linha temporal lado a lado e deslocar-se depressa por um planeamento longo.

## Quando precisa disto

Está a discutir o início da fundação e, ao mesmo tempo, a entrega nove meses depois. Sem ajuda, continua a fazer zoom para dentro e para fora e perde a noção de onde estava. Com a **vista dividida**, vê o mesmo planeamento duas vezes, lado a lado, cada uma com a sua própria janela temporal. Com o **minimapa**, vê todo o intervalo de datas do projeto numa faixa estreita, e salta com um clique para a parte que procura.

## Passos

### Ativar a vista dividida

1. Escolha o separador *Visualização*. No grupo *Apresentação* estão *Apresentação*, *Vista dividida* e *Minimapa*.
2. Clique em *Vista dividida*. O Gantt divide-se em dois. Ambas as janelas começam com o zoom e a posição da sua vista atual.

As duas janelas partilham a tabela de tarefas, as linhas e a deslocação vertical. Cada janela tem o seu próprio eixo temporal: o zoom e a posição horizontal.

### Dar a cada janela o seu próprio intervalo de tempo

- Faça zoom e deslocação na janela onde está o rato. Com a definição padrão de *Deslocação e zoom* (*Zoom + arrastar*), a roda do rato faz zoom nessa janela, centrado no rato. Se a sua definição seguir outro modo, a roda faz, nas duas janelas, o que esse modo indicar.
- Com a definição padrão, desloca as linhas com Shift e a roda do rato. Isto aplica-se às duas janelas ao mesmo tempo.
- Os botões *Zoom +* e *Zoom -* e a lista de escala temporal (por exemplo *Trimestre*) só funcionam na janela da esquerda. Por isso, faça zoom na janela da direita com a roda do rato.
- Arraste a divisória entre as duas janelas para a esquerda ou para a direita, para as tornar mais largas ou mais estreitas. No início, cada uma ocupa metade.

### Desativar a vista dividida

Clique de novo em *Vista dividida*. Fica uma janela, com a vista da janela da esquerda. Uma nova vista dividida começa outra vez com a vista do momento.

### Ativar o minimapa

1. No grupo *Apresentação*, clique em *Minimapa*.
2. Por baixo da linha temporal aparece uma faixa com todo o intervalo de datas do projeto. As tarefas da sua vista atual aparecem como pequenos traços (por isso, depois de um filtro, só aparecem as tarefas que o filtro mostra). Uma moldura rodeia a parte que vê agora.
3. Clique em qualquer ponto da faixa para colocar a moldura aí. A janela fica centrada nesse ponto. Ou agarre a moldura e arraste-a.

O minimapa só desloca a janela temporal. As linhas mantêm-se como estão.

Se a vista dividida estiver ativa, cada janela tem a sua própria faixa, por baixo da sua parte da linha temporal. Cada faixa controla apenas a janela acima dela.

## Pontos de atenção e o que a aplicação faz

**O minimapa não faz nada se o projeto inteiro já estiver visível.** Se fizer zoom para fora até ao planeamento inteiro caber, não há nada para onde ir, e clicar não tem efeito. Faça zoom para dentro primeiro.

**O minimapa só existe no Gantt.** Nos separadores *Tabela*, *IFC* e *Relatório* e no painel de recursos completo (*Recursos*, não *Dock de recursos*) não há linha temporal, por isso também não há minimapa nem vista dividida. Voltam logo que regressar a uma vista com o Gantt.

**A vista dividida pertence ao projeto; o minimapa não.** A vista dividida aplica-se ao projeto aberto: se mudar para outro projeto e voltar, ela continua lá. O minimapa é uma escolha para todos os projetos e mantém-se ativo ou inativo depois de reiniciar. Ambos são escolhas de ecrã: não entram no ficheiro do projeto, não tornam o projeto «modificado» e não estão incluídas no *Desfazer*.

**Vista dividida e apresentação.** Ambos continuam visíveis quando ativa o modo de apresentação (ver [Apresentar num ecrã grande](docs://howto-presentatie)). Como o friso desaparece nesse momento, já não os pode ativar nem desativar nesse modo. Por isso, configure-os bem antes de começar.

## Ver também

- [Apresentar num ecrã grande](docs://howto-presentatie): o Gantt em ecrã inteiro, sem o friso.
- [Criar e usar um layout](docs://howto-layouts-gebruiken): a escala temporal também pode ser guardada como parte de um layout.
