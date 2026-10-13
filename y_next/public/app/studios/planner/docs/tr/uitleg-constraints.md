# Kısıtlamalar ve son tarihler

Tuğlalar yalnızca 21 Haziran'da teslim edilir. Ruhsat henüz çıkmadı. Çatı, inşaat tatilinden önce kapatılmalıdır. İlişkiler, bir görevin başka bir görevi beklediğini kaydeder. Ama bir tarih hakkındaki anlaşmalar, görevlerin sırasından çıkmaz. Kısıtlamalar ve son tarihler bunun içindir. Bu makalede her türün ne yaptığını okursunuz: bir görev ne zaman taşınır, ne zaman yalnızca bolluk değişir, sert sabitleme nedir ve uygulama bir çakışmayı nasıl bildirir.

Kurallar ve örnekler yeni bir projeye uygulanır. Hesaplama profili *Open Planner Studio* ve iş haftası Pazartesiden Cumaya kadardır.

## Kavram

Bir **kısıtlama**, tek bir göreve ait bir tarih sınırıdır. Görevin ilişkilerinden bağımsızdır. Bu sınır iki şekilde çalışabilir:

- **Erteler**: görev, tarihten önce başlayamaz veya bitemez. Görev ilişkileri yüzünden daha erken başlayacaksa, tarihe taşınır.
- **Korur**: görev en geç bu tarihte başlamalı veya bitmelidir. Uygulama hiçbir şeyi taşımaz. Planlama tarihi karşılamazsa, görevin ve ondan önceki zincirin **bolluğu** negatif olur. Bolluk, projenin bitiş tarihi kaymadan önce bir görevin sahip olduğu alandır. Negatif olması, kâğıt üzerinde zaten geciktiğiniz anlamına gelir (bkz. [Kritik yol ve bolluk](docs://uitleg-kritiek-pad)).

Bir **son tarih**, korumanın daha basit bir biçimidir. Bir görevin bitişi için hedef tarihtir. Görev hiçbir şeyle taşınmaz.

Tüm kısıtlamalar **esnektir**: bir tarih karşılanmasa bile hesaplama devam eder. Bir istisna vardır: **sert sabitleme**. Bu, ilişkilerin üzerine yazar. Bu konuda aşağıda daha fazla bilgi vardır.

## Uygulama nasıl hesaplar

### Sekiz tür

Türü *Özellikler* panelinde, *Kısıtlama* alanında seçersiniz. Her türün hesaplaması:

- *Mümkün olduğunca erken (ASAP)*: sınır yok. Bu varsayılandır: görev, ilişkilerin izin verdiği anda başlar.
- *Mümkün olduğunca geç (ALAP)*: görev, bir ardılının daha geç başlamak zorunda kalmadan olabildiğince geç taşınır. Bu nedenle serbest bolluğunu kullanır. Ardılları kendi alanlarına sahipse ve görevin hâlâ toplam bolluğu kalıyorsa, kritik olmaz. O da kullanılırsa kritik sayılır.
- *Şu tarihten önce başlamaz (SNET)*: başlangıç için alt sınır. Görev daha erken başlayacaksa, tarihe taşınır. Tarih ilişkilerin izin verdiğinden daha erkense, kısıtlama hiçbir şey yapmaz.
- *Şu tarihten önce bitmez (FNET)*: aynısı, ama görevin bitişi için.
- *Şu tarihten sonra başlamaz (SNLT)* ve *Şu tarihten sonra bitmez (FNLT)*: başlangıç veya bitiş için üst sınır. Bunlar hiçbir şeyi taşımaz. Sınır karşılanmazsa, uygulama ihlal edilen kısıtlama bildirir ve bolluk negatif olur.
- *Şu tarihte başlamalı (MSO)* ve *Şu tarihte bitmeli (MFO)*: aynı anda bir alt ve bir üst sınır. Tarih, ilişkilerin istediğinden daha geç olursa, görev tarihe taşınır. Tarih ilişkilerin izin verdiğinden daha erkense, görev ilişkilerin yerleştirdiği yerde kalır ve bolluk negatif olur.

Bir tarih cumartesi, pazar veya izin gününe denk gelirse, uygulama onu iş günü olarak okur. Alt sınır (SNET, FNET) bir sonraki iş günü olur. Üst sınır (SNLT, FNLT) bir önceki iş günü olur.

### Negatif bolluk ne anlama gelir

Bir üst sınır geriye doğru çalışır. Kısıtlama, bir görevin geç tarihini erken tarihinden önceye koyarsa, toplam bolluk negatif olur. Bu, ondan önceki görevler için de geçerlidir. Duvar örme en geç Cuma 11 Haziran'da başlamak zorundaysa ama Pazartesi 14 Haziran'dan önce başlayamıyorsa, duvar örmeden önceki görevler de bir iş günü geride kalır. Negatif bolluğu olan tüm görevler kritiktir. Bunun nasıl işlediği, [Kritik yol ve bolluk](docs://uitleg-kritiek-pad) bölümünde açıklanır.

Bir üst sınır yüzünden çubuklar taşınmaz. Çakışmayı negatif *Toplam bolluk* değerinde görürsünüz. Ayrıca çubuğun üstündeki kırmızı elmasta, durum çubuğundaki bildirimde (örneğin *1 kısıtlama ihlal edildi*) ve *Uyarılar* panelinde görürsünüz.

### Sert sabitleme

MSO ve MFO seçildiğinde *Zorunlu (sabitleme mantığı)* onay kutusu görünür. Bu kutuyu işaretlerseniz, öncülleri o zamana kadar bitmemiş olsa bile görevi tarihe sabitlersiniz. İlişkilerin üzerine yazılır:

- Görev tarihtedir (MSO ile orada başlar, MFO ile orada biter) ve öncülleriyle çakışır.
- Öncüller negatif bolluk alır. İlişkiler görevin sabitlemeden daha geç başlamasına izin verecekse, uygulama ihlal edilen kısıtlama bildirir. Sabitlenmiş görevin kendisi 0 bolluğunu korur.
- Ardıllar sabitlenmiş görevden hesaplanır. Bu yüzden, ondan önceki mantık bitmemiş olsa bile, sabitleme olmadığındakinden daha erken başlayabilirler. Aşağıdaki örnekte projenin sonu bu yüzden üç iş günü öne gelir.

Sabitlemeyi ilk kez açtığınızda uygulama kısa bir açıklama gösterir: sert sabitleme ilişkilerin üzerine yazar, çubuk öncüllerinden önce bile tarihe sabitlenir.

### İkincil kısıtlama

Bir görevin bir birincil kısıtlaması vardır. Ayrıca ikinci bir sınır isterseniz, örneğin bir görevin 14 Haziran'dan önce başlamaması ve 17 Haziran'a kadar bitmesi gerekiyorsa, bir **ikincil kısıtlama** eklersiniz. Bu gerçek bir sınır olmalıdır (SNET, FNET, SNLT veya FNLT). Ve birincil kısıtlamanın tersi yönde sınır koymalıdır: bir alt sınır (SNET veya FNET) ile bir üst sınır (SNLT veya FNLT). SNET ile SNLT dolayısıyla izinlidir. SNET ile FNET izinli değildir. Uygulama diğer kombinasyonları kırmızıyla işaretler ve nedenini yazar, örneğin *Birincil ve ikincil kısıtlama aynı tarafı sınırlayamaz.* ASAP, ALAP, MSO, MFO ve sert sabitleme ile ikincil kısıtlamaya izin verilmez.

### Son tarih

Bir son tarih, kısıtlamanın yanında bir görevdeki ayrı bir tarihtir. Bitiş için bir üst sınırdır. Hiçbir şeyi taşımaz. Ama görev zamanında bitmezse bolluğu negatif yapar. Uygulama bunun üzerine *Uyarılar* panelinde *Son tarih … kaçırıldı — erken bitiş …* bildirir. Durum çubuğu kaçırılan son tarihleri sayar. Gantt diyagramında son tarihin gününde aşağı bir ok vardır: görev zamanında bitiyorsa yeşil, geciktiğinde kırmızı. Cumartesiye denk gelen bir son tarih, ondan önceki Cumaya kadar sayılır. Cuma da dahildir.

Bolluk için bir son tarih, FNLT ile aynı şeyi yapar. Fark, nasıl kullandığınızdadır. Bir son tarih, korumak istediğiniz bir hedef tarihtir. Kısıtlamadan ayrıdır. Bu yüzden bir görevin hem kısıtlaması hem de son tarihi olabilir. FNLT bir kısıtlamadır. Bir ihlal, kaçırılan bir son tarih yerine ihlal edilen bir kısıtlama olarak görünür.

### Kısıtlamanın yapmadıkları

- Bir **faz** (özet görev) üzerinde bir kısıtlama veya son tarih dikkate alınmaz. Uygulama fazdaki görevlerle hesaplar. Bunu görevin kendisine koyun.
- Gerçek başlangıcı veya ilerlemesi olan bir görev, bu başlangıcı korur. Daha sonraki bir tarihli SNET onu taşımaz.
- **Bir başlangıç tarihi yazmak**, öncülü olan bir görevde sabit bir başlangıç olarak çalışmaz. Öncül kararı belirlemeye devam eder. Bu yüzden uygulama, yazdığınız tarihte bunu bir SNET'e çevirir: *Özellikler* panelinde, *Görevi düzenle* penceresinde, tabloda ve Gantt diyagramında çubuğu taşıdığınızda. Uygulama bunu size bildirir. Görevin zaten başka bir kısıtlaması varsa (örneğin ALAP veya MSO), uygulama yeni başlangıcı uygulamaz ve bunu da size bildirir. O zaman o kısıtlamayı değiştirin.

Tüm değişiklikler yalnızca **Hesapla** (F5) komutundan sonra görünür.

## Çalışılmış örnek

Örnek, bir ev genişletmesi için küçük bir ağdır. Pazartesi 7 Haziran 2027'de başlar:

- *Groundwork* (3 iş günü): Pazartesi 7 ile Çarşamba 9 Haziran.
- *Pour foundation* (2): Perşembe 10 ve Cuma 11 Haziran.
- *Brickwork* (5): Pazartesi 14 ile Cuma 18 Haziran.
- *Roofing* (3): Pazartesi 21 ile Çarşamba 23 Haziran.
- *Scaffolding* (2): *Pour foundation*'ı izler ve *Roofing*'den önce gelir. Pazartesi 14 ve Salı 15 Haziran'da çalışır ve 3 iş günü bolluğu vardır.

Kritik yol *Groundwork*, *Pour foundation*, *Brickwork* ve *Roofing*'dir. Proje Çarşamba 23 Haziran'da biter. *Brickwork* üzerinde tek bir kısıtlama ile ne değişir?

- **SNET Pazartesi 21 Haziran** (tuğlalar ancak o zaman gelir): *Brickwork* Pazartesi 21 ile Cuma 25 Haziran arasında çalışır. *Roofing* Pazartesi 28 ile Çarşamba 30 Haziran arasında çalışır. Proje Çarşamba 30 Haziran'da biter. *Groundwork* ve *Pour foundation* artık 5 iş günü bolluğa sahiptir ve kritik değildir. *Scaffolding*'de 8 iş günü bolluk vardır.
- **SNET Çarşamba 9 Haziran**: etkisi yok. İlişkiler *Brickwork*'ün zaten yalnızca Pazartesi 14 Haziran'da başlamasına izin verir.
- **SNLT Çarşamba 16 Haziran**: etkisi yok. *Brickwork* Pazartesi 14 Haziran'da başlar ve sınırı rahatça karşılar.
- **SNLT Cuma 11 Haziran**: çok sıkı. *Brickwork* yine Pazartesi 14 Haziran'da başlar, bir iş günü geç. *Groundwork*, *Pour foundation* ve *Brickwork* −1 iş günü bolluk alır. Uygulama *Şu tarihten sonra başlamaz (SNLT) 11-06-2027 kısıtlaması mantık tarafından aşılıyor (negatif bolluk)* bildirir. Hiçbir şey taşınmaz.
- **MSO Çarşamba 16 Haziran** (sert sabitleme olmadan): *Brickwork* Çarşamba 16 Haziran'a taşınır ve Salı 22 Haziran'da biter. *Roofing* Çarşamba 23 ile Cuma 25 Haziran arasında çalışır. Proje Cuma 25 Haziran'da biter.
- **MSO Cuma 11 Haziran** (sert sabitleme olmadan): tarih, ilişkilerin izin verdiğinden daha erkendir. *Brickwork* yine Pazartesi 14 Haziran'da başlar ve bolluk −1 olur, tıpkı SNLT'de olduğu gibi.
- **MSO Çarşamba 9 Haziran, sert sabitlemeyle**: *Brickwork* Çarşamba 9 Haziran'da başlar ve Salı 15 Haziran'da biter. *Pour foundation* ise hâlâ Cuma 11 Haziran'a kadar sürer. *Roofing* Çarşamba 16 ile Cuma 18 Haziran arasında çalışır. Proje, sabitleme olmadığındakinden üç iş günü önce biter. *Groundwork* ve *Pour foundation* −3 iş günü bolluk alır.

Ve başka bir görevde bir kısıtlama veya son tarihle:

- **ALAP**, *Scaffolding* üzerinde: görev Perşembe 17 ve Cuma 18 Haziran'a taşınır. Bu, *Roofing*'den önceki en geç andır. *Roofing* onun tek ardılıdır. Bolluğu kadar, tam 3 iş günü yer bırakmıştı. Bu yer artık kullanılmıştır ve *Scaffolding* kritiktir.
- **SNET Cumartesi 19 Haziran**, *Scaffolding* üzerinde: sınır Pazartesi 21 Haziran sayılır. *Scaffolding* Pazartesi 21 ve Salı 22 Haziran'da çalışır. *Roofing* de Çarşamba 23 ile Cuma 25 Haziran'a kayar.
- **Son tarih Cuma 18 Haziran**, *Roofing* üzerinde: hiçbir şey taşınmaz. *Roofing* Pazartesi 21 ile Çarşamba 23 Haziran arasında kalır. *Groundwork*, *Pour foundation*, *Brickwork* ve *Roofing* −3 iş günü bolluk alır. Uygulama *Son tarih 18-06-2027 kaçırıldı — erken bitiş 23-06-2027* bildirir. *Scaffolding* 0 iş günü bolluğunu korur ve o da kritik olur.
- **SNET Pazartesi 21 Haziran**, *Brickwork* üzerinde, **son tarih Cuma 25 Haziran**, *Roofing* üzerinde: kısıtlama *Brickwork* görevini bir hafta geri iter. Son tarih ise *Roofing*'in Çarşamba 30 Haziran'da geç kaldığını bildirir. *Brickwork* ve *Roofing* −3 iş günü bolluk alır. *Groundwork* ve *Pour foundation* 2 iş günü korur.

Eğitim 3'te, eğitim projesinde kendiniz bir kısıtlama ve bir son tarih ayarlarsınız. Planlamanın nasıl taşındığını görürsünüz.

## Sonuçlar ve yanlış anlamalar

**“Bir kısıtlama görevi taşır.”** Yalnızca SNET, FNET, MSO ve MFO, bir görevi ilişkilerinin gösterdiğinden daha geç koyabilir. ALAP ise onu serbest bolluğu içinde daha geç bir tarihe taşıyabilir. SNLT ve FNLT hiçbir şeyi taşımaz: yalnızca uyarır. Tarihi karşılamak, bunun için öncesindeki zinciri kısaltmak anlamına gelir.

**“Negatif bolluk, uygulamadaki bir hatadır.”** Bu, planlamanın tarih anlaşmanızla çeliştiğinin işaretidir. Bunu zinciri kısaltarak, anlaşmayı gevşeterek veya çakışmayı bilerek kabul ederek çözersiniz.

**“Sert sabitleme çakışmayı çözer.”** Sert sabitleme çakışmayı gizler. Görev tarihtedir, ama öncülleri ona hazır değildir. Ardıllar ise sanki hazırmış gibi hesaplanır. Bunu yalnızca gerçekten sabit bir tarih için kullanın, örneğin yasal teslim tarihi için. Bir görevi bir tarihe koymanın yolu olarak kullanmayın.

**“Ben yalnızca bir başlangıç tarihi yazarım.”** Öncülü olan bir görevde bu bir SNET olur. Bu tarih öncülün izin verdiğinden önceyse, hiçbir şey yapmaz.

**“Son tarih mi, FNLT mi?”** Korumak istediğiniz bir hedef tarih için son tarih seçin. Planlama için gerçekten bir sınır koşulu olan bir tarih için kısıtlama seçin.

**“Faz üzerinde bir kısıtlama.”** Bu dikkate alınmaz. Kısıtlamayı görevin kendisine koyun.

## Ayrıca bakın

- [Bir kısıtlama veya son tarih ayarlamak](docs://howto-constraint-deadline-zetten): bir kısıtlama veya son tarih ayarlamanın adımları.
- [İlişkiler ve gecikme](docs://uitleg-relaties): kısıtlamaların yanında yer alan ilişkiler.
- [Kritik yol ve bolluk](docs://uitleg-kritiek-pad): negatif bolluğun nasıl oluştuğu ve kritik yolu nasıl etkilediği.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): *Municipal road closure (permitted closure period)* üzerinde bir sert sabitleme (*Şu tarihte başlamalı (MSO)*) ve *Lift supply & installation — Tower A* üzerinde bir ikincil kısıtlama (*Şu tarihten sonra başlamaz (SNLT)*).
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): karşılanmayan bir son tarih ve negatif bolluk.
