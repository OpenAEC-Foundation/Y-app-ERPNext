# Yeni proje ve Proje bilgisi

*Yeni proje* penceresinin ve *Proje bilgisi* penceresinin alanları: her alanın ne yaptığı, varsayılan değerinin ne olduğu ve nerede etkili olduğu. Bunlar aynı formun iki yüzüdür. *Yeni proje* yeni bir proje oluşturur ve birkaç ek alanı vardır. *Proje bilgisi* açık olan projeyi değiştirir.

## Açma

**Yeni proje** — *Dosya › Yeni*, Ctrl+N, veya belge sekmelerinin sağındaki artı işareti (*Proje başlat*, sonra *Yeni proje*). Pencere, imleç *Proje adı* alanındayken açılır.

**Proje bilgisi** — *Ayarlar › Proje › Proje bilgisi* formu, *Proje Bilgileri* başlıklı bir pencere olarak açar. *Dosya › Proje bilgisi* aynı formu *Dosya* ekranında gösterir. *Hesaplama profili ve seçenekleri* bloğu iki yerde de en altta yer alır; bu blokta ne olduğu [Hesaplama seçenekleri ve kurallar](docs://ref-rekenopties-en-conventies) sayfasında açıklanır.

## Oluştur, Uygula ve iptal

**Oluştur** (*Yeni proje* penceresinde) projeyi oluşturur ve kendi sekmesinde açar. **Uygula** (*Proje bilgisi* penceresinde) yaptığınız değişiklikleri projeye yazar.

- **Yalnızca Uygula ile.** Taslağa yazarsınız. Proje yalnızca *Uygula* tıkladığınızda değişir. *Uygula* yalnızca gerçekten değiştirdiğiniz şeyi yazar, tek bir adımda, *Geri al* ile geri alınabilir. Hiçbir şey değiştirmeden *Uygula* tıklarsanız hiçbir şey olmaz ve adım eklenmez.
- **İptal, çarpı ve Esc** pencereyi hiçbir şey kaydetmeden kapatır. Pencerenin yanına tıklamak onu kapatmaz: yazdığınız metin kalır.
- **Enter**, *Oluştur* veya *Uygula* ile aynı işi yapar. Ancak *Açıklama* alanında ve açık bir açılır listede yapmaz.
- **Dosya ekranında** *Proje bilgisi* altta *Değişiklikler uygulanmadı — korumak için Uygula'ya tıklayın.* mesajını gösterir; taslağınız farklı olduğu sürece. Ekrandan çıkarsanız uygulama, uygulamak, vazgeçmek veya iptal etmek isteyip istemediğinizi sorar. Bkz. [Şerit, sekme sekme](docs://ref-lint).
- **Adsız bir özel hesaplama profili** *Uygula* ve *Oluştur* işlemini engeller. Ona bir ad verin veya değişikliği atın.

## Her iki penceredeki alanlar

**Proje adı** — projenin adı başlık çubuğunda, sekmede ve kaydettiğinizde dosya adında görünür. Varsayılan: boş. Boş alan kabul edilir: proje o zaman *Yeni planlama* olarak adlandırılır ve alanda gri metin olarak gösterilir. Nerede: tüm ekran.

**Açıklama** — serbest metin. Varsayılan: boş. Etki: projeyle birlikte saklanır, IFC dosyasında ve Primavera P6 XML dışa aktarımında yer alır; planlamayı hiç etkilemez.

**Yazar** — serbest metin. Varsayılan: boş. Etki: IFC dosyasına gider ve bir raporun üstbilgisinde *Yazar:* olarak görünür; orada bunu değiştiremezsiniz.

**Kaynak kitaplığı** — projenin bağlı olduğu kaynak kitaplığı. Seçin: *yok (bağımsız proje)*, mevcut kitaplıklarınız veya *+ Yeni kaynak kitaplığı…*. Varsayılan: *Yeni proje* penceresinde varsayılan kitaplık, *Proje bilgisi* penceresinde geçerli bağlantı. Etki: bkz. [Kaynak kitaplığını kullanma](docs://howto-resourcebibliotheek-gebruiken). *+ Yeni kaynak kitaplığı…* seçtiğinizde aşağıdaki bir alana ad yazarsınız; kitaplık yalnızca *Oluştur* veya *Uygula* ile oluşturulur. Bu yüzden iptal ederseniz geriye hiçbir şey kalmaz. *Proje bilgisi* içindeki bağlantı yalnızca bu alana kendiniz dokunursanız değişir.

**Müşteri/kuruluş** — serbest metin. Varsayılan: boş. Etki: IFC dosyasına gider ve bir raporun üstbilgisinde *Şirket:* olarak görünür.

**Başlangıç tarihi** — projenin başlangıcı. Varsayılan: *Yeni proje* penceresinde bugün. Alanın ne yaptığı aşağıdaki *Başlangıç tarihinin etkisi* bölümünde açıklanır.

**Bitiş tarihi** — projenin planlanmış bitişi. Varsayılan: boş. Etki: bir bilgi, bir zorunluluk değil: uygulama bu tarihe göre planlama yapmaz. Bir raporun üstbilgisinde ve dışa aktarımlarda görünür; tatillerin hangi yıla kadar üretileceğini belirler. Yalnızca *Bolluğu proje bitiş tarihine kadar hesapla* ayarı açık olan bir Primavera dosyasında bolluk hesabı bu tarihe kadar çalışır (bkz. [Hesaplama seçenekleri ve kurallar](docs://ref-rekenopties-en-conventies)).

**Yeni görevler için varsayılan birim** — yalnızca *Saat planlamasını etkinleştir* açıkken görünür. Seçin: *Gün* ve *Saat*. Varsayılan: *Gün*. Etki ve koşullar: bkz. [Saat planlamasını açma](docs://howto-urenplanning-aanzetten).

**Hesaplama profili ve seçenekleri** — *Proje bilgisi* penceresinde tüm blok; *Yeni proje* penceresinde yalnızca *Hesaplama profili* açılır listesi, seçenekleri *Primavera P6*, *Microsoft Project* ve *Open Planner Studio*. Varsayılan: *Open Planner Studio*. Bir profil seçmek, o profilin varsayılan seçeneklerini de ayarlar. Bkz. [Hesaplama seçenekleri ve kurallar](docs://ref-rekenopties-en-conventies).

## Yalnızca Yeni proje penceresinde

**Faz şablonu** — projenin hangi fazlarla başlayacağı. Seçin: *Boş*, *Konut inşaatı* ve *Ticari yapı / yenileme*. Varsayılan: *Boş*. Etki: *Boş* görevsiz bir proje verir. Diğer ikisi, her birinde proje varsayılan biriminde süre 5 olan sekiz faz görevini hazır koyar (5 iş günü, ya da *Yeni görevler için varsayılan birim* altında *Saat* seçerseniz 5 saat) ve ilişkisiz; bunları kendiniz yeniden adlandırır, taşır ve uzatırsınız. *Konut inşaatı* için bunlar şunlardır: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking ve Oplevering. *Ticari yapı / yenileme* için: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen ve Oplevering. Bu adlar projenizin verisidir ve başka bir arayüz dilinde bile Hollandaca kalır. *İnşaat modunu etkinleştir* kapalıysa yalnızca *Boş* vardır. Bkz. [Ayarlar](docs://ref-instellingen).

**Vardiya** — yalnızca *Saat planlamasını etkinleştir* açıkken görünür. Seçin: *Gündüz vardiyası*, *2 vardiya*, *3 vardiya* ve *24/7*. Varsayılan: *Gündüz vardiyası*. Etki: *Gündüz vardiyası* standart takvimi olduğu gibi bırakır; pazartesiden cumaya kadar sıradan bir gün takvimidir. Diğer üçü, proje takvimine, *Takvimler* penceresindeki aynı adlı düğmeler gibi çalışma bantları koyar. Hangi saatler olduğu [Çalışma saatlerini ayarlama](docs://howto-werktijden-instellen) sayfasında açıklanır. *Gündüz vardiyası* seçiliyken *Yeni görevler için varsayılan birim* altında *Saat* seçilemez, çünkü bir gün takvimi bant içermez.

**Tatil seti** — proje takvimi hangi tatil günlerini alır. *Ülke* alanında *Hollanda* (varsayılan), *Almanya*, *Belçika*, *Fransa*, *Birleşik Krallık*, *Avusturya*, *İsviçre*, *Tatil yok* veya *Özel…* seçersiniz. Ülkenin bölgeleri varsa, açılır bir *Bölge* listesi eklenir. Hollanda için, *İnşaat modunu etkinleştir* açıksa, ayrıca *İnşaat tatili* seçersiniz: *Yok* (varsayılan), *Kuzey*, *Orta* veya *Güney*. Bunun altında *36 tatil, 2025–2029* gibi bir satır vardır; listesini görmek için bu satırı açarsınız. Yıllar, başlangıç tarihinin bir yıl öncesinden bitiş tarihinin bir yıl sonrasına kadar uzanır; bitiş tarihi yoksa başlangıç yılının üç yıl sonrasına kadar. *Özel…* tatilsiz bir takvim verir ve oluşturmanın hemen ardından *Takvimler* penceresini açar; böylece tatilleri kendiniz doldurursunuz. Proje takvimi *Bouwkalender NL* adını taşır, ya da *İnşaat modunu etkinleştir* kapalıysa *Standaardkalender*; seçenek o zaman ayrıca *Tatil yok* olur. Tatillerin nasıl üretildiği için bkz. [Tatilleri ve inşaat tatilini üretme](docs://howto-feestdagen-genereren).

## Başlangıç tarihinin etkisi

Başlangıç tarihi projenin dayanak noktasıdır. Üç kural vardır:

- **Yeni görevler başlangıç tarihinde başlar.** Eklediğiniz bir görev, proje başlangıcını planlanmış başlangıç olarak alır.
- **Öncülü olan bir görev hiçbir zaman başlangıç tarihinden önce başlamaz.** Öncülün bitişi daha erken ise görev başlangıç tarihine kadar bekler. *Öncülü olmayan* bir görev, başlangıç tarihinden önce olsa bile kendi tarihini korur. Bu gereklidir; MS Project veya Primavera'dan gelen bir planlamayı, kaynak programın gösterdiği biçimde göstermek için. *Şu tarihte başlamalı (MSO)* veya *Şu tarihte bitmeli (MFO)* kısıtlaması iki kuralı da bozar: böyle bir görev kendi tarihinde durur, başlangıç tarihinden önce düşse bile.
- **Daha sonraki bir başlangıç tarihi serbest görevleri kaydırır.** *Proje bilgisi* penceresinde başlangıç tarihini daha sonraya ayarlar ve *Uygula* tıklarsanız, öncülü olmayan ve alt sınır koyan bir kısıtlaması olmayan (*Şu tarihten önce başlamaz (SNET)*, *Şu tarihte başlamalı*, *Şu tarihten önce bitmez* veya *Şu tarihte bitmeli*) ve yeni tarihten önce kalacak görevler o tarihe kayar. Bu, aynı adımda olur ve *Geri al* ile geri alınabilir. Uygulama kaç görevin kaydığını söyler. Bu yalnızca başlangıç tarihini kendiniz değiştirdiğinizde olur, bir dosya açtığınızda hiçbir zaman olmaz. Başlangıç tarihini daha sonraya ayarlamak planlamanın geri kalanını taşımaz: bunu *Projeyi taşı* yapar, bkz. [Projeyi taşıma](docs://howto-project-verplaatsen).

## Ayrıca bakınız

- [Hesaplama seçenekleri ve kurallar](docs://ref-rekenopties-en-conventies): *Hesaplama profili ve seçenekleri* bloğu.
- [Hesaplama profilleri ve kurallar](docs://uitleg-rekenprofielen): neden bir profilin sonucu değiştirdiği.
- [Projeyi taşıma](docs://howto-project-verplaatsen): tüm planlamayı başka bir başlangıca taşır.
- [Görevler ve kilometre taşları ekleme](docs://howto-taken-en-mijlpalen-toevoegen): ilk görevlerle başlamak.
- [Tatilleri ve inşaat tatilini üretme](docs://howto-feestdagen-genereren): tatil setini ayrıntılı olarak.
