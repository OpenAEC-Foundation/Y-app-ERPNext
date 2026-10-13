# Abrir e guardar um ficheiro

Objetivo: abrir um projeto a partir de um ficheiro e guardar as suas alterações.

## Quando precisa disto

Começa o dia com o projeto de ontem, recebe um ficheiro de um colega ou de outro programa, ou quer guardar um estado intermédio antes de alterar algo grande. O que a aplicação guarda num ficheiro, e porque só o IFC guarda o projeto inteiro, está explicado em [Ficheiros e formatos](docs://uitleg-bestanden).

## Passos

### Abrir um ficheiro

1. Escolha *Início › Ficheiro › Abrir*, ou *Ficheiro › Abrir*, ou prima Ctrl+O (⌘+O num Mac). *Abrir* está também na barra no topo. O grupo *Ficheiro* está também no separador *Tabela*.
2. Escolha o ficheiro. Abre um ficheiro de cada vez. No ambiente de trabalho e em navegadores com acesso a ficheiros, como o Chrome e o Edge, a janela mostra uma lista de tipos de ficheiro: *Todos os suportados*, *Ficheiros IFC*, *Ficheiros CSV*, *Ficheiros XML*, *Ficheiros MS Project* e *Ficheiros Primavera XER*.
3. O projeto abre-se num novo separador. Se o separador atual ainda estava vazio e sem alterações, o projeto abre-se nele.

Um ficheiro IFC dá o seu nome ao separador. Um projeto de outro formato recebe o nome do projeto.

A aplicação abre `.ifc`, `.csv`, `.xml` (XML do MS Project ou XML do Primavera P6), `.mpp` e `.xer`. Para os dois últimos há passos separados em [Abrir um ficheiro do MS Project (.mpp)](docs://howto-mpp-openen) e [Abrir um ficheiro do Primavera P6 (.xer)](docs://howto-xer-openen).

### Abrir um projeto recente

Escolha *Início › Ficheiro › Recentes* e clique num ficheiro da lista, ou escolha *Ficheiro › Recentes*. A lista guarda os últimos dez ficheiros que abriu, guardou ou exportou. A aplicação de ambiente de trabalho mostra o caminho de cada ficheiro, e um navegador mostra apenas o nome.

Se a aplicação já não conseguir ler um ficheiro da lista, por exemplo porque o moveu, o ficheiro desaparece da lista sem mensagem. Em navegadores sem acesso a ficheiros, como o Firefox, *Recentes* fica vazio.

### Abrir um exemplo

Escolha *Ficheiro › Exemplos* e clique num projeto de exemplo. Abre-se num separador, sem ficheiro: *Guardar* pergunta, portanto, onde quer guardá-lo.

### Guardar

Escolha *Início › Ficheiro › Guardar* ou *Ficheiro › Guardar*, ou prima Ctrl+S. O que acontece depois depende do seu projeto:

1. Se o projeto já tiver um ficheiro, porque abriu um ficheiro IFC ou o guardou antes, a aplicação escreve nesse ficheiro. Não aparece nenhuma janela.
2. Se o projeto ainda não tiver ficheiro, a aplicação pergunta onde o deve guardar. Sugere o nome do projeto com `.ifc`. Depois disso, esse ficheiro passa a ser o ficheiro do projeto.
3. Se o navegador só guarda através de uma transferência (como o Firefox), o ficheiro vai parar à pasta de transferências, e cada vez que guarda cria uma nova transferência. A primeira vez numa sessão vê a mensagem *Guardado como transferência: «name.ifc» está na pasta de transferências. Este navegador não permite que a aplicação escreva num local próprio, por isso cada vez que guarda cria uma nova transferência. No Chrome, no Edge ou na aplicação de ambiente de trabalho, Guardar atualiza simplesmente o mesmo ficheiro.*
4. Se o navegador não conseguir escrever de volta no ficheiro do projeto, a aplicação volta a perguntar onde deve colocar o ficheiro em cada vez que guarda. Parece *Guardar como*, mas é uma limitação do navegador. Na primeira vez numa sessão, a mensagem *Este navegador não permite que a aplicação escreva de volta em «name.ifc».* explica isto, com uma ligação para [Ficheiros](docs://uitleg-bestanden).

Depois de guardar, desaparece a marca *Não guardado*: o ponto no separador, o asterisco antes do nome do projeto no topo e o texto *Não guardado* no canto inferior direito da barra de estado.

### Guardar com outro nome

Escolha *Início › Ficheiro › Guardar como* ou *Ficheiro › Guardar como*, ou prima Ctrl+Shift+S. Escolha um nome e um local (no Firefox, a aplicação transfere um novo ficheiro). Depois disso, o projeto trabalha com este novo ficheiro: o próximo *Guardar* escreve aí. O ficheiro antigo mantém-se como estava na última vez que guardou.

### Fechar um projeto

Clique na cruz do separador, ou escolha *Ficheiro › Fechar projeto*. Se o projeto tiver alterações que não guardou, a aplicação pergunta: *Alterações não guardadas: «name» tem alterações que ainda não foram guardadas.* Escolha *Cancelar* (o projeto continua aberto), *Não guardar* (o projeto fecha-se e as suas alterações perdem-se) ou *Guardar* (guarde primeiro e feche depois). Se fechar a aplicação inteira no ambiente de trabalho (com o botão de fechar, Alt+F4 ou o menu do sistema operativo), pergunta isto para cada projeto com alterações; *Cancelar*, ou uma tentativa de guardar que falhe, interrompe o fecho. Depois de um fecho normal deste tipo, a aplicação apaga as cópias de recuperação dessa sessão, por isso a janela de recuperação só aparece depois de uma falha real. Se um projeto tiver alterações e fechar o separador ou a janela do navegador, o navegador pede confirmação.

## Armadilhas e o que a aplicação faz nesse caso

**Um ficheiro IFC aberto passa logo a ser o ficheiro do seu projeto.** *Guardar* substitui esse ficheiro, mesmo que venha de outro programa. Se quiser manter o original, escolha primeiro *Guardar como*.

**Outros formatos nunca são substituídos.** Um `.csv`, `.xml`, `.mpp` ou `.xer` não tem ficheiro associado depois de aberto. *Guardar* escreve um novo ficheiro IFC e deixa o original intacto.

**No Firefox, cada vez que guarda cria um novo ficheiro.** A aplicação não consegue escrever no seu ficheiro aí. Transfere um novo ficheiro de cada vez, com o nome do projeto como nome do ficheiro e não o nome do ficheiro que abriu.

**O Chrome e o Edge pedem autorização.** Na primeira vez que usa *Guardar* num ficheiro que abriu, o navegador pergunta se a aplicação pode escrever nele. Se recusar, a aplicação abre uma janela em que escolhe um novo ficheiro. No Chrome e no Edge também obtém essa janela se escrever no ficheiro existente falhar, por exemplo porque o ficheiro desapareceu ou está bloqueado.

**Guardar pode falhar.** Se o próprio ato de guardar der erro, a aplicação mostra *Falha ao salvar*, com o motivo. O projeto continua aberto e ainda está marcado como *Não guardado*.

## Ver também

- [Ficheiros e formatos](docs://uitleg-bestanden): o que está num ficheiro IFC e como a aplicação trata os formatos.
- [Ativar o guardar automático](docs://howto-automatisch-opslaan): deixar a aplicação atualizar sozinha o seu ficheiro.
- [Exportar](docs://howto-exporteren): fazer uma cópia noutro formato.
- [Recuperar após uma falha](docs://howto-herstellen-na-een-crash): o que fazer se a aplicação não fechou corretamente.
- [Formatos de importação e exportação](docs://ref-import-exportformaten): por formato, o que passa para o outro formato e o que não passa.
