# Kaynak kitaplığı

Duvar örme ekibiniz yalnızca bir projede çalışmaz. Bugün kuzeydeki evlerde, yarın güneydeki garajlarda çalışır. Bir kaynak kitaplığı, böyle bir ekibi bir kez kaydettiğiniz yerdir. Böylece her proje aynı ekibi kullanır. Uygulama ayrıca iki projenin aynı gün aynı kişileri istediğini görebilir. Bunu tek bir proje göremez. Bu makalede kaynak kitaplığı ile projenin birbiriyle nasıl ilişkili olduğunu ve uygulamanın projeler arasındaki dolulukları nasıl saydığını öğreneceksiniz.

## Kavram

İki katman vardır.

**Kaynak kitaplığı**, kuruluşunuza ait kaynakların ve takvimlerin listesidir: bir duvarcı, bir vinç, bir sıvacı; türleri, ücretleri ve kaç tane bulunduğuyla birlikte. Listenin kendisi, uygulamanın ayrıca **havuz** dediği şeydir. Bu liste proje dosyalarınızda değil, uygulamanın içindedir: masaüstü uygulamasında bu bilgisayardaki bir dosyada, tarayıcıda ise o tarayıcının depolamasında. Tarayıcıdaki site verilerini silerseniz kaynak kitaplığı da kaybolur; bu yüzden yedek olarak dışa aktarın. Her zaman en az bir kaynak kitaplığı vardır. İlk kitaplığın adı *Mijn resourcebibliotheek* (Hollandaca bir addır) ve bunu yeniden adlandırabilirsiniz.

**Proje** bir kaynaktan ne kadar kullanılacağına ve ne zaman kullanılacağına karar verir. Bir proje tek bir kaynak kitaplığına bağlı olabilir ya da tek başına durabilir. Tek başına bir proje sorunsuz çalışır; yalnızca ortak bir liste olmaz.

Bir proje kaynak kitaplığına işaret etmez, bir **kopya** tutar. Kaynak kitaplığından bir projeye *Bricklayer* atadığınızda uygulama projede bir **köken damgası** ile bir kopya oluşturur. Bu damga, kopyanın kaynak kitaplığı X'ten geldiğini ve oradaki öğe Y olduğunu bildiren bir nottur. Kaynak tablosunda böyle bir kopyayı küçük bir kitaplık simgesinden tanırsınız. Kopya sıradan bir kaynaktır: ona görevler atanabilir ve kopya proje dosyasının kendisinde saklanır.

Kaynak kitaplığındaki takvimler, projenizin takvim listesinden başkadır. O listeyi takvim penceresinde yönetirsiniz. Bir kaynak kitaplığı takvimi, onu kullanan bir kaynakla birlikte projenize gelir.

## Uygulama bununla nasıl çalışır

### Kitaplığın ve projenin belirlediği şeyler

Kaynak kitaplığı **bir kaynağın ne olduğunu** belirler: ad, tür, saatlik ücret, birim ve açıklama. Bir proje kopyasında bu alanlar düz metin olarak görünür. Bunları kaynak kitaplığında değiştirirsiniz, böylece her projede doğru kalırlar. Bir kopyanın yine de kendi yolunu gitmesini isterseniz, onun bağlantısını kaynak kitaplığından kaldırırsınız.

Proje **ne kadar ve ne zaman** belirler: *Maks. birim*, zamanla değişen kapasite (*Zamana bağlı kapasite*) ve kaynağın hangi takvimi kullandığı. Bu alanlar projede düzenlenebilir kalır ve kaynak kitaplığından bir sapma sayılmaz. Zira aynı ekip, acil bir işte normal bir projedekinden başka bir takvim kullanabilir. Bir kaynakla birlikte gelen takvimin içeriği ise kaynak kitaplığını izler.

### Bir kopya ne zaman takip eder

Kaynak kitaplığı kopyaları sürekli yenilemez, sabit anlarda yenilenir:

- Kaynak kitaplığında bir şeyi değiştirdiğinizde, açık olan tüm projelerdeki düzenlenmemiş kopyalar hemen takip eder.
- Bir projeyi açtığınızda veya başka bir sekmeye geçtiğinizde uygulama kopyaları kaynak kitaplığıyla karşılaştırır. Düzenlenmemiş bir kopya geride kalmışsa, uygulama onu sessizce günceller ve bunu kısaca bildirir: *1 öğe kitaplıktan güncellendi* veya *N öğe kitaplıktan güncellendi*.

Uygulama, kopyanın oluşturulduğu veya güncellendiği andaki değerleri hatırlar. Bu değerler şimdi farklıysa, uygulama kimin haklı olduğuna karar vermez. Kopyaya o zaman *farklı — karar ver* işareti verilir. Böyle bir kopya içeren bir dosyayı açtığınızda *Kaynak kitaplığını bağla* penceresi kendiliğinden açılır. Orada her öğe için kaynak kitaplığındaki değerlerin mi geçerli olacağını, yoksa dosyanızdaki değerlerin mi kaynak kitaplığına geleceğini seçersiniz. Sekme değiştirdiğinizde hiçbir pencere açılmaz.

Bir sapma ortaya çıkar, örneğin projede kendi kaynağınızı, aynı adlı ama farklı değerleri olan bir kaynak kitaplığı öğesine *Kitaplığa* seçeneğiyle bağladığınızda. Uygulama bunları yine de bağlar ve kopyayı hemen sapmalı olarak işaretler.

### Bir kaynak kitaplığında artık yer almadığında

Bir kaynağı kaynak kitaplığından silerseniz, kopya projelerinizde kalır ve çalışmaya devam eder. Kopyaya *artık kitaplıkta değil* işareti verilir. Ardından onu tamamen düzenleyebilir ya da projeden kaldırabilirsiniz.

### Projeler arasında doluluk

Bir projedeki histogram ve aşırı atanmışlık yalnızca o tek projeye bakar. Kaynak kitaplığı daha fazlasını bilir: bir kaynaktan toplamda kaç tane olduğunu. *Doluluk* görünümü her gün için, aynı kaynak kitaplığına bağlı ve o kaynağın bir kopyasını kullanan tüm açık projelerin yükünü toplar. Bir gündeki toplam, kaynak kitaplığının kapasitesinden büyükse, o gün aşırı atanmış sayılır.

Üç kural neyin sayıldığını belirler:

- Kapasite kaynak kitaplığından gelir (kaynak kitaplığı öğesinin *Maks. birim* değeri veya o gündeki *Zamana bağlı kapasite*), projedeki kopyanın *Maks. birim* değerinden değil. Her biri kendi atamasının içinde kalan iki proje birlikte yine de fazlasını isteyebilir.
- Toplam tam olarak kapasiteye eşitse bu bir çakışma değildir. Yalnızca kapasiteden fazla istenirse çakışma olur.
- Yalnızca köken damgası olan kopyalar sayılır ve yalnızca o anda bu uygulamada açık olan projelerde. Tek bir projenin kendi kaynağı kaynak kitaplığında değildir, bu yüzden sayılmaz. Genel bakış, bu uygulamada açılmamış belgeleri görmez; bu bilgi genel bakışın altında da yazılıdır.

## Uygulamalı örnek: iki projedeki duvarcı ekibi

Kaynak kitaplığında *Bricklayer* kaynağı bulunur, *Maks. birim* 3 ile: kadroda üç duvarcı var. İki proje bunu kullanır; ikisinde de *Maks. birim* 2 olan bir kopya vardır.

- *Houses North* projesinde *Bricklaying facades* görevi var: 7 Haziran 2027 Pazartesi'den başlayan, günde 2 birimlik 5 iş günü. Görev 7 Haziran'dan 11 Haziran'a kadar, bu günler dahil sürer.
- *Garages South* projesinde *Bricklaying garages* görevi var: 9 Haziran 2027 Çarşamba'dan başlayan, günde 2 birimlik 4 iş günü. Hafta sonu sayılmaz; bu yüzden görev 9, 10, 11 ve 14 Haziran'ı kapsar.

Her projede duvarcıdan 2 birimin 2'si istenir. İki proje de aşırı atanmışlık bildirmez: *Kaynaklar › Aşırı atama* altında ikisi de *Yok* yazar. Birlikte ise 3 duvarcının sınırını aşarlar. Uygulama gün gün şunu sayar:

- 7 ve 8 Haziran (Pazartesi ve Salı): 2 (yalnızca Houses North)
- 9, 10 ve 11 Haziran (Çarşamba, Perşembe ve Cuma): 2 + 2 = 4
- 14 Haziran (Pazartesi): 2 (yalnızca Garages South)

Tepe değer 4'tür; kapasite ise 3. Genel bakışta *Bricklayer* şöyle görünür: *2 belge*, dönem *2027-06-07 – 2027-06-14*, tepe ve kapasite için *4.0 / 3.0* ve *3 gün aşırı atanmış*: 9, 10 ve 11 Haziran.

Bir şeyi değiştirirseniz ne olur:

- Eğer *Bricklaying facades* 6 iş günü sürerse, 14 Haziran Pazartesi'ye kadar devam eder. O gün de 2 + 2 = 4'e ulaşır; bu yüzden genel bakış *4 gün aşırı atanmış* bildirir: 9, 10, 11 ve 14 Haziran. Tepe değer 4 kalır.
- Kaynak kitaplığında *Maks. birim* 4 olursa, genel bakış *4.0 / 4.0* yazar ve çakışma olmaz, çünkü toplam kapasiteden büyük değildir.
- *Garages South* günde 2 yerine 1 birimle çalışırsa, tepe değer 3 olur ve genel bakış *3.0 / 3.0* yazar: çakışma yoktur.
- *Garages South* yalnızca 14 Haziran Pazartesi günü başlarsa, projeler çakışmaz. Dönem *2027-06-07 – 2027-06-17* olur ve tepe değer *2.0 / 3.0* olur.

Bu durumu kendi projelerinizde nasıl inceleyeceğinizi [Doluluk görünümünü kullanma](docs://howto-bezettingsoverzicht-gebruiken) adımlarında bulursunuz.

## Sonuçlar ve yanlış anlamalar

**“Kaynak kitaplığı meslektaşlarımla paylaşılır.”** Hayır. Kaynak kitaplığı uygulamanın içinde saklanır (masaüstü uygulamasında bu bilgisayardaki bir dosyada, tarayıcıda o tarayıcının depolamasında) ve eşitlenmez. İki planlamacı aynı kaynak kitaplığıyla çalışırsa, kitaplıkları birbirinden ayrılabilir. Dışa aktarıp içe aktararak paylaşabilirsiniz; ayrıntılar için [Kaynak kitaplıklarını yönetme ve paylaşma](docs://howto-bibliotheken-beheren) bölümüne bakın. Kuruluşunuz kaynak ekiplerini bağlı işletmeler arasında paylaşıyorsa, bilerek tek bir ortak kaynak kitaplığı seçin. Genel bakış ayrıca yalnızca bu uygulamada açık olan projeleri görür.

**“Kaynak kitaplığını değiştirirsem projelerimdeki her şey değişir.”** Yalnızca kaynağın kimliği değişir: ad, tür, ücret, birim ve açıklama. *Maks. birim*, zamanla değişen kapasite ve projenin takvim seçimi olduğu gibi kalır.

**“Kaynak kitaplığı değişikliğini geri alabilirim.”** Hayır. Kaynak kitaplığı bir projeye değil, uygulamaya aittir; bu yüzden kaynak kitaplığındaki değişiklikler *Geri al* (Ctrl+Z) dışında kalır. *Kitaplık* görünümü bunu kendisi uyarır: *Bu, kitaplığı düzenler ve tüm projeler için geçerlidir — geri almanın dışında.* Kaynak kitaplığından silmek de onay ister ve geri alınamaz.

**“Doluluk genel bakışı aşırı atanmışlığı çözer.”** Hayır, genel bakış yalnızca salt okunur bir penceredir. Hangi günlerde iki projenin birlikte fazlasını istediğini gösterir. Dengeleme (*Kaynaklar › Kaynak Dengeleme › Dengele…*, bkz. [Kaynak dengeleme](docs://uitleg-nivelleren)) yalnızca bir projenin kaynaklarına bakar ve diğer projeleri hesaba katmaz. Bir görevi projelerden birinde kendiniz taşıyın, ya da gerçekten biri katılırsa kaynak kitaplığındaki kapasiteyi değiştirin.

**“Kendi kaynağım doluluğa sayılır.”** Yalnızca kaynak kitaplığındaysa. Yalnızca projede oluşturduğunuz bir kaynak, örneğin tek bir iş için kiralanmış bir vinç, köken damgası taşımaz ve bu yüzden genel bakışta yer almaz. Onu *Kitaplığa* seçeneğiyle eklersiniz.

## Ayrıca bakın

- [Kaynak kitaplığını kullanma](docs://howto-resourcebibliotheek-gebruiken): bağlama, kaynak atama ve sapmaları çözme.
- [Kaynak kitaplıklarını yönetme ve paylaşma](docs://howto-bibliotheken-beheren): kaynak kitaplığı oluşturma, dışa aktarma ve içe aktarma.
- [Doluluk görünümünü kullanma](docs://howto-bezettingsoverzicht-gebruiken): projeler arasındaki aşırı atanmışlıkları bulma.
- [Kaynakları yönetme](docs://howto-resources-beheren): tek bir projenin kaynakları.
