# Ativar Guardar automaticamente

Objetivo: que a aplicação atualize o ficheiro do seu projeto enquanto trabalha, para não ter de premir Ctrl+S sempre.

## Quando precisa disto

Trabalha durante uma sessão longa no mesmo planeamento, ou esquece-se de guardar, e quer que o ficheiro no disco ou numa pasta partilhada acompanhe o trabalho. *Guardar automaticamente* não substitui a recuperação: esta está sempre ativa e funciona à parte. A diferença explica-a em [Ficheiros e formatos](docs://uitleg-bestanden).

## Passos

1. Se o projeto ainda não tiver ficheiro, guarde-o primeiro uma vez com *Início › Ficheiro › Guardar como*. Enquanto não existir ficheiro, o interruptor fica cinzento e a dica diz: *Guarde primeiro este projeto para usar a gravação automática.*
2. No canto superior esquerdo, na barra de cima, clique no interruptor *Guardar automaticamente*. Quando estiver ativo, a dica diz: *A gravação automática está ativa: as alterações são gravadas neste ficheiro.*
3. Continue a trabalhar. Assim que o projeto tiver alterações, a aplicação grava-o no seu ficheiro, sem janela e no máximo uma vez a cada dez segundos. A marca *Não guardado* desaparece então sozinha.
4. Se quiser parar, clique outra vez no interruptor. A dica diz então: *A gravação automática está desativada. A recuperação continua ativa.*

Primeiro, o Chrome e o Edge só permitem ler um ficheiro que abriu. O interruptor não faz nada aí até ter guardado uma vez com *Guardar* (Ctrl+S) e o navegador ter dado permissão para escrever. Depois disso pode ativá-lo. No Firefox o interruptor fica sempre cinzento: a aplicação não consegue escrever no seu ficheiro aí.

## Armadilhas e o que a aplicação faz nesse caso

**O interruptor pertence a um só projeto.** Cada separador tem o seu próprio estado. Depois de abrir um projeto, o interruptor está sempre desligado, e a aplicação não o guarda para a próxima vez.

**Guardar automaticamente escreve só no ficheiro que o projeto já tem.** Se escolher *Guardar como*, a partir daí escreve no novo ficheiro. A aplicação só escreve quando há alterações.

**A escrita pode falhar.** Se, por exemplo, o ficheiro tiver desaparecido ou estiver bloqueado, aparece a mensagem *Falha no salvamento automático* com o motivo. Se o navegador não tiver (ou já não tiver) permissão para escrever, a aplicação salta essa ronda em silêncio: não pede a permissão.

**O ficheiro também recebe alterações que não queria manter.** Guardar automaticamente grava o estado do seu projeto tal como está nesse momento. Se desfizer algo com Ctrl+Z, o ficheiro também recebe esse estado desfeito dentro de dez segundos. Se quiser manter uma versão anterior, faça primeiro uma cópia com *Guardar como*.

**Uma falha ainda custa os últimos segundos.** A aplicação escreve no máximo uma vez a cada dez segundos, por isso o que fez entretanto ainda não está no seu ficheiro. A recuperação tem o mesmo limite.

**Depois de uma recuperação no navegador, o interruptor volta a ficar cinzento.** Um projeto recuperado no navegador depois de uma falha deixa de estar ligado ao seu ficheiro. Guarde-o uma vez, e o interruptor volta a funcionar. Veja [Recuperação após uma falha](docs://howto-herstellen-na-een-crash).

**Um projeto de outro formato não tem ficheiro.** Um ficheiro CSV, XML, `.mpp` ou `.xer` só obtém um ficheiro IFC quando o guarda. Depois disso pode ativar Guardar automaticamente.

## Ver também

- [Ficheiros e formatos](docs://uitleg-bestanden): a diferença entre guardar, Guardar automaticamente e recuperação.
- [Abrir e guardar um ficheiro](docs://howto-bestand-openen-en-opslaan): guardar, guardar como e a marca *Não guardado*.
- [Recuperação após uma falha](docs://howto-herstellen-na-een-crash): o que a aplicação oferece se não tiver fechado corretamente.
