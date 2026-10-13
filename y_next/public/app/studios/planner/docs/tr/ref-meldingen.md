# Bildirimler ve uyarılar

Uygulama üç yerde ne olduğunu gösterir: alttaki durum çubuğu, sağ sütundaki *Uyarılar* paneli ve ekranın altında kısa süre görünen bildirimler. Bu makale her yer için ne gördüğünüzü, ne zaman göründüğünü ve ne yapabileceğinizi anlatır. Bir planlamanın neden kritik veya aşırı atanmış olduğunu [Kritik yol ve bolluk](docs://uitleg-kritiek-pad) makalesinde bulursunuz. Aşırı atamanın nasıl çözüleceğini [Aşırı atamayı çözme](docs://howto-overbezetting-oplossen) makalesinde bulursunuz. Bir ilişkinin nasıl oluşturulacağını [İlişki oluşturma](docs://howto-relaties-leggen) makalesinde öğrenirsiniz.

## Üç öğe arasındaki fark

- **Durum çubuğu** — sayaçları gösteren sabit bir satır. Bunlar son hesaplamadan gelir ve siz yeniden hesaplayana kadar kalır.
- **Uyarılar paneli** — bu sayaçların arkasındaki liste. Son hesaplamanın bulduğu her şey burada yer alır. Bir tıklama sizi göreve, ilişkiye veya kaynağa götürür. Liste son hesaplamadan türetilir. Hiçbir şey kaydedilmez.
- **Bildirimler** — az önce yaptığınız bir işle ilgili kısa mesajlar (kaydetme başarısız, ilişki reddedildi, içe aktarma okundu). Bunlar kısa süre sonra kaybolur. Panelde yer almazlar.

## Durum çubuğu

Alttaki durum çubuğu soldan sağa şunları gösterir:

- **Görevler:** — yaprak görevlerin sayısı. Özet görevler sayılmaz.
- **Kilometre taşları:** — kilometre taşlarının sayısı.
- **Kritik yol: N görev, N iş günü** — kritik görevlerin sayısı ve proje süresi. Yalnızca bir hesaplamadan sonra görünür.
- **Bitiş:** — hesaplamadan gelen proje bitişi. Yalnızca bir hesaplamadan sonra görünür. Boş bir projede bitiş yoktur.
- **N son tarih kaçırıldı**, **N kısıtlama ihlal edildi**, **N ilişkide sıra dışı ilerleme** ve **N kaynak aşırı atanmış** — her biri uyarı işaretli bir düğme. Bu düğmeler yalnızca sayaç 0'ın üzerindeyse ve bir hesaplama varsa görünür. Bir tıklama *Uyarılar* panelini açar (ipucu: *Uyarılar panelini aç (ayrıntılar ve gezinme)*). *IFC* veya *Rapor* sekmesindeyseniz uygulama aynı anda *Ana sayfa* sekmesine geçer, çünkü sağ sütun orada yoktur. *kaynak aşırı atanmış* sayacı, kaynaklarda ve atamalarda yapılan değişikliklerden sonra da yenilenir. Diğer sayaçlar yalnızca *Hesapla* komutundan sonra değişir. Dört sayaç bir seçimdir. Panelin ek olarak gösterdikleri (kesilmiş öne alma, yok sayılan ilişki, bitiş driver'ı olmayan hamak, sınırlanmış bitiş tarihi, planlama hatası) durum çubuğunda yer almaz.
- **Güncel değil — yeniden hesaplayın (F5)** — bir uyarı işaretiyle (ipucu: *Plan güncel değil — yeniden hesaplayın (F5)*). Bu görünür olur, planlamayı etkileyen bir şeyi değiştirdiğinizde ve yeniden hesaplamadığınızda. *Otomatik hesapla* açıksa bu görünmez. Hesaplama bir hata verdiğinde ise görünür kalır.
- **Seçim: N görev** — seçili görevlerin sayısı. Yalnızca bir seçim varsa görünür.
- **Ölçek:** ve **Yakınlaştırma: Npx/gün** — zaman çizelgesinin zaman ölçeği ve yakınlaştırma düzeyi. Ölçek yakınlaştırmaya göre belirlenir.
- **Kaydedilmedi** — belgede dosyada olmayan değişiklikler olduğu sürece görünür.
- **AI** — AI yazısı taşıyan renkli bir nokta. Bu yalnızca AI modu açıksa görünür. İpucu metni *AI köprüsü:* ifadesini ve ardından *Kapalı*, *N portunda aktif*, *N portu kullanımda* veya *Hata* ifadelerinden birini gösterir. Bir tıklama *Yapay Zeka* sekmesini açar.
- **Hata ayıklama terminali** — bir terminal düğmesi. Yalnızca hata ayıklama terminali açıksa görünür. Terminali gösterir veya gizler (*Hata ayıklama terminalini göster* / *Hata ayıklama terminalini gizle*).

## Uyarılar paneli

- **Açma** — *Planlama › Zamanlama › Uyarılar*, *Görünüm › Paneller › Uyarılar* veya durum çubuğundaki bir sayaç. Panel sağ sütundadır, *Özellikler* ve kaynak paneli altındadır. Daralmış bir sütunu genişletir. Varsayılan olarak kapalıdır ve oturumlar arasında hatırlanmaz. Başka panellerin altındaysa yüksekliğini kenarından sürükleyerek ayarlayın. Bu yükseklik hatırlanır. Sağ üstteki çarpı paneli kapatır (*Uyarıları kapat*).
- **Başlık satırı** — *N hata, N uyarı*. Henüz hesaplama yapılmadıysa *Henüz hesaplanmadı — kontrolleri çalıştırmak için Hesapla (F5) tuşuna basın*.
- **Hesapla** — başlık satırındaki bir düğme. Planlama güncel değilse veya henüz hesaplanmadıysa görünür. Şeritteki *Hesapla* ile aynı işi yapar.
- **Başlık satırında uyarı işareti** — planlama güncel değilse görünür, ipucu *Program güncel değil — bu liste son hesaplamadan geliyor. Yeniden hesaplayın (F5)*. Liste gizlenmez. Yalnızca güncel değil olarak işaretlenir.
- **Boş liste** — *Uyarı yok. Program tüm kontrolleri geçiyor*.
- **Bir satır** — en üstte yer (görev, ilişki, kaynak veya proje), altında açıklama. Bir hata kendi sekizgen işaretine sahiptir. Bir uyarı üçgen işaretine sahiptir. Bir görev `WBS adı` olarak görünür. Bir ilişki `öncül → ardıl (FS+2d)` olarak görünür, tür ve gecikme ile birlikte. Bir tıklama yere götürür (ipucu *Git: …*), aşağıya bakın. Aktif göreviniz (ilişki için: ardılı) veya histogramda seçilen kaynak için olan satır vurgulanır.
- **Sıra** — önce hatalar. Sonra her tür için aşağıdaki listedeki sıraya göre. Bir türün içinde belgedeki sıraya göre (ilişki için ardılın, kaynak için kaynak listesinin sırası). Son hesaplamadan sonra silinen bir görev, ilişki veya kaynak listeden çıkar.

### Uyarı türleri

- **Planlama hatası** — *Planlama hesaplanamadı: …* ifadesi ve ardından nedeni. Aşağıya bakın. Bir tıklama: bir döngüde uygulama döngüdeki tüm görevleri seçer ve ilkine gider. Diğer hatalarda gidilecek bir yer yoktur. Satır bu durumda bir düğme değildir.
- **Son tarih kaçırıldı** — *Son tarih {date} kaçırıldı — erken bitiş {date}*. Görevin bir son tarihi vardır ve hesaplama bunu karşılamaz. Bir tıklama sizi göreve götürür. Düzeltmek için ilişkileri veya süreyi ayarlayın ya da son tarihi taşıyın.
- **İhlal edilen kısıt** — *{type and date} kısıtlaması mantık tarafından aşılıyor (negatif bolluk)*. Bu ihlal edilen kısıt, ilişkileri bozmadan karşılanamaz. Bolluk negatiftir. Bir tıklama sizi göreve götürür. Bkz. [Kısıtlamalar](docs://uitleg-constraints).
- **Sıra dışı** — *Sıra dışı: ardılın ilerlemesi ilişkiyle çelişiyor*. Ardılın ilerlemesi ilişki türüne uymaz. Bu, örneğin, bir bitiş-başlangıç ilişkisinde öncül henüz bitmemişken ardılın zaten devam ettiği durumdur. Bir tıklama iki görevi de seçer; ardıl aktif olur. Gerçek tarihleri veya ilişkiyi kontrol edin.
- **Öne alma kesildi** — *Öncelik proje başlangıcıyla kesildi — ilişki tam olarak uygulanmıyor*. İlişkideki öne alma (negatif gecikme) proje başlangıcından önceye uzanır. Bir tıklama iki görevi de seçer.
- **İlişki yok sayıldı** — *İlişki yok sayıldı: öncül veya ardıl eksik ya da yaprak görev değil*. Hesaplama bu ilişkiyi kullanmaz. Bir tıklama hâlâ var olan görevleri seçer. Bkz. [İlişkiler](docs://uitleg-relaties).
- **Bitiş driver'ı olmayan hamak** — *Bitiş driver'ı olmayan hamak (FF/SF öncülü yok): süresi sıfıra düşüyor*. Bir tıklama sizi göreve götürür. Bkz. [Hamak görevleri](docs://howto-hammock).
- **Bitiş tarihi sınırlandı** — *Bitiş tarihi sınırlandı: takvim bu görev için çalışılabilir bir pencere bırakmıyor*. Hesaplama, aradığı gün sayısının sınırına ulaştı. Bu, takvimde çok uzun kesintisiz tatil günleri olduğunda gerçekleşebilir. Bir tıklama sizi göreve götürür. Bkz. [Takvimler ve iş günleri](docs://uitleg-kalenders).
- **Aşırı atama** — *N gün aşırı atanmış (ilk – son)*. Tüm günler tatilse *kaynak bu günlerde takvimine göre çalışmaz* eklenir. Günler karışıksa *bunların N gününde kaynak takvimine göre çalışmaz* eklenir. Bir tıklama, o kaynağa atanmış görevleri seçer, histogramı açar ve histogramda o kaynağı seçer. *Tablo*, *IFC* veya *Rapor* sekmesinden uygulama *Kaynaklar* sekmesine geçer. Bkz. [Kaynak paneli](docs://ref-resourcepaneel).

### Planlama hatasının nedenleri

- *Görevler arasında döngüsel ilişki: {path}* — ilişkiler bir döngü oluşturur. Görevler yolda yer alır. Bir ilişkiyi tersine çevirin veya kaldırın.
- *Takvimde tanımlı iş günü yok* — takvime en az bir iş günü verin. Bkz. [Takvim pencereleri](docs://ref-kalenders).
- *'{task}' görevi için geçersiz gün cinsinden süre* ve *'{task}' görevi için geçersiz saat cinsinden süre* — görevin süresi geçerli bir sayı değil.
- *'{task}' saat görevinin takviminde geçerli çalışma saatleri yok* — saat cinsinden planlanan bir görev, çalışma saati olmayan bir takvimde.
- *'{task}' görevi için geçersiz başlangıç tarihi* — görevin başlangıç tarihi geçerli değil.

## Bildirimler

Bildirimler ekranın altında görünür; ayrıca tabloda, Backstage'te ve sunum modunda da görünür. Bir bildirim *hata* veya *bilgi* türündedir. Bir hata, siz tıklayıp kapatana kadar kalır. Bir bilgi 5 saniye sonra kaybolur. Bu zamanlayıcılar, bildirim yığını değiştiğinde yeniden başlar. Bir bildirime tıklamak onu kapatır (ipucu: *Bildirimi kapat*). En fazla üç bildirim aynı anda gösterilir. Dördüncü bir bildirim gelirse, önce en eski bilgi gider. Bilgi yoksa, en eski bildirim gider. Bu sayede bir hata, bir bilgi yüzünden hiçbir zaman çıkarılmaz. Bildirim yığını, açık bir iletişim kutusunun düğmelerinden ve sabit işlem çubuklarından uzağa kayar.

- **Sayaç ×N** — Sabit bir anahtarı olan bir bildirim, tekrarı bir sayaçla tek satırda toplar. Örneğin sürekli geri gelen bir kaydetme hatası veya tekrar ettiğiniz reddedilen bir ilişki. Her bildirim bunu yapmaz.
- **Daha fazla bilgi** — Bazı bildirimlerin, rehbere giden bir *Daha fazla bilgi* bağlantısı veya kendi konusu vardır (örneğin *İş kuralları açıklaması*). Bu konu, Backstage › Yardım bölümündeki rehberde yer alır.
- **İşlem düğmesi** — Hesaplama profiline ilişkin bildirimde, Proje bilgisi iletişim kutusuna giden bir *Hesaplama profilini aç* düğmesi vardır.

Aşağıdaki liste bir seçimdir ve konulara göre gruplanmıştır. Aksi belirtilmedikçe bu bir bilgi bildirimidir.

### Kaydetme, açma ve kurtarma

- **Kaydetme başarısız** (hata) — *Kaydetme başarısız* ile birlikte altında neden yazar. Bu, kaydettiğinizde, farklı kaydettiğinizde ve bir raporu dışa aktarırken gösterilir.
- **İndirme olarak kaydedildi** (bilgi) — *İndirme olarak kaydedildi: '{name}' artık indirilenler klasörünüzde. …* *Farklı kaydet* ve dışa aktarmalarda, ortam uygulamanın seçtiğiniz konuma doğrudan yazmasına izin vermediğinde gösterilir. Hemen art arda gelen iki indirme birleşir.
- **İndirme olarak kaydedildi (açıklama)** (bilgi) — *İndirme olarak kaydedildi: '{name}' indirilenler klasörünüzde. Bu tarayıcı, uygulamanın kendi bir konuma yazmasına izin vermiyor, …* *Kaydet* ile, yalnızca indirme yoluyla kaydeden bir tarayıcıda gösterilir. Oturum başına bir kez, dosyalar hakkındaki açıklamaya bir bağlantıyla birlikte.
- **Tarayıcı geri yazmıyor** (bilgi) — *Bu tarayıcı, uygulamanın '{name}' dosyasına geri yazmasına izin vermiyor. …* Dosyası olan bir projeyi *Kaydet* ile kaydettiğinizde gösterilir, tarayıcının yeniden bir konum sorması gerektiğinde. Oturum başına bir kez, dosyalar hakkındaki açıklamaya bir bağlantıyla birlikte.
- **Otomatik kaydetme başarısız** (hata) — *Otomatik kaydetme başarısız* ile birlikte neden yazar. Bu, dosyaya otomatik kaydetme ve çökme kurtarma için geçerlidir.
- **Kitaplık kaydedilemedi** (hata) — *Kitaplık kaydedilemedi*, kaynak kitaplığını kaydettiğinizde.
- **Dosya açma başarısız** (hata) — *Dosya açılamadı* ile birlikte neden yazar. Örneğin son kullanılan bir dosya veya içe aktarılan bir dosya için.
- **Eski veya korumalı .mpp** (hata) — *Bu .mpp dosyası eski bir biçim kullanıyor (Project 2007 veya daha eski)…* ya da *Bu .mpp dosyası parola korumalı…*. İkisi de, MS Project'te XML olarak dışa aktarıp o dosyayı açma önerisiyle birlikte gösterilir.
- **Geçersiz XER dosyası** (hata) — Bir *XER…* metni gösterilir, örneğin *Bu, geçerli veya desteklenen bir XER dosyası değil.* ya da *XER dosyasında yinelenen bir tablo var.* Nedeni de eklenir.
- **IFC okunamadı** (hata) — *IFC okunamadı* ile birlikte neden, IFC görünümünde.
- **Kurtarma** (hata) — *Kurtarılan dosya okunamadı*, *Geri yükleme başarısız* ve *N kurtarma dosyası yüklenemedi ve atlandı.* Beklenmedik bir kapanmadan sonra kurtarırken gösterilir.
- **Dal şablon olarak kaydedildi** (bilgi) — *Dal, '{name}' şablonu olarak kaydedildi*.
- **Uzantıdan gelen mesaj** (bilgi; uzantı bir hata bildirirse hata) — *{name} uzantısı: {message}*. Bir uzantı, 10 saniyede en fazla üç yeni mesaj gösterebilir; böylece bildirim yığını dolmaz. Bir uzantının rehberindeki bir adım başarısız olursa *{name} uzantısının bir adımı başarısız oldu. Rehber devam ediyor.* yazar. Bir uzantının proje dosyası açılamazsa *{name} uzantısının {file} proje dosyası açılamadı.* yazar. Bunların ikisi de hatadır.
- **Araya bir değişiklik girdi** (bilgi) — *Araya, yapay zeka asistanı veya bir uzantı tarafından bir değişiklik girdi. …* Bu arada yapay zeka asistanı veya bir uzantı bir şeyi değiştirmişken görev iletişim kutusunu iptal ettiğinizde gösterilir: o değişiklikten önceki görev düzenlemeleri geri alınmaz. Bunlar *Geri al* altında olağan adımlar olarak kalır.

### Hesaplama

- **Planlama hesaplanamadı** (hata) — *Planlama hesaplanamadı* ile birlikte altında neden yazar (bkz. *Planlama hatasının nedenleri*). *Hesapla* komutunda, belgeler arasında geçiş yaparken ve bir dosya açarken gösterilir.
- **Durum tarihi bugüne ayarlandı** (bilgi) — *Henüz durum tarihi yoktu: ilerleme durum tarihine kadar ölçüldüğü için bugüne ({date}) ayarlandı. Planlama → Durum tarihi altından değiştirebilirsiniz.* Durum tarihi olmayan bir projede ilerleme girdiğinizde gösterilir.
- **Süre, yapılmış işten kısa** (bilgi) — *“{name}” zaten %{N} tamamlandı: yapılmış işten kısa bir süre olamaz. Süre değiştirilmedi.*

### İlişkiler ve hiyerarşi

- **İlişki oluşturuldu** (bilgi) — *İlişki oluşturuldu: {predecessor} → {successor}*.
- **İlişki reddedildi** (bilgi) — *Bu ilişki zaten var*, *Bir görev ile kendi üst özet görevi arasında ilişki kurulmasına izin verilmez.* ya da *Bu ilişki programda bir döngü oluşturur ({cycle}); ilişki oluşturulmadı.* Döngü, görevlerin adlarını verir. Böylece önce hangi ilişkiyi kaldıracağınızı veya tersine çevireceğinizi bilirsiniz.
- **Taşıma reddedildi** (bilgi) — *Bu taşıma programda bir döngü oluşturur ({cycle}): bir özet görevin ilişkileri alt görevleri için de geçerlidir. Hiçbir şey taşınmadı.*
- **Taşımadan sonra ilişkiler hesaba katılmaz** (bilgi) — *Taşımadan sonra N ilişki bir görevi kendi üst özet görevine bağlıyor; artık hesaplamaya dahil edilmiyor.*
- **Ekleme sırasında atlanan ilişkiler** (bilgi) — *N ilişki oluşturulmadı: geçersiz bağlantı…*, bir dal yapıştırdığınızda veya eklediğinizde.
- **İçe aktarmadan sonra hesaplanmayan ilişkiler** (bilgi) — *N ilişki hesaplamaya dahil edilemedi. Öncüller ve Ardıllar sütunlarını kontrol edin.*
- **İçe aktarmadan sonra yinelenen kimlikler** (bilgi) — *Bu dosyada yinelenen kimliğe sahip nesneler: N. Bunlara kendi kimlikleri verildi…*

### Görevleri düzenleme

- **Başlangıç kısıtlama olarak kaydedildi** (bilgi) — *'{name}' görevinin bir öncülü var: yeni başlangıç artık Şu tarihten önce başlamaz (SNET) {date} kısıtlaması. Yeniden hesaplamadan (F5) sonra görev bu tarihten önce başlamaz.* Öncülü olan bir görevin başlangıcını değiştirdiğinizde gösterilir. Görevin zaten böyle bir kısıtlaması varsa, bildirim kısıtlamanın taşındığını söyler. Birden fazla görev için aynı anda bir sayı verir.
- **Başlangıç uygulanmadı** (bilgi) — *'{name}' görevinin yeni başlangıcı uygulanmadı: görevin bir öncülü var ve {type} {date} kısıtlaması var. Bu ikisi başlangıcı belirler. Başlangıcı taşımak için bu kısıtlamayı değiştirin.*
- **Kilometre taşı reddedildi** (bilgi) — *'{task}' kaynak atamalarına sahip ve kilometre taşı olamaz. Önce atamaları kaldırın.* ya da *'{task}' alt görevleri olan bir özet görevdir ve kilometre taşı olamaz.* Görevi görev iletişim kutusunda, özellikler panelinde, bağlam menüsünde veya tabloda kilometre taşına dönüştürürken gösterilir.
- **Atamalar bir alt göreve taşındı** (bilgi) — *{resources} ataması '{phase}' görevinden yeni alt görev '{child}' görevine taşındı: özet görev kendisi atama taşımaz.* Atamaları olan bir göreve alt görev eklendiğinde gösterilir.
- **Kilometre taşı işareti kaldırıldı** (bilgi) — *'{phase}' kilometre taşının artık alt görevleri var ve özet görev oldu; kilometre taşı işareti kaldırıldı.*
- **Özet görev reddedildi** (bilgi) — *'{phase}' özet görev olamaz: …* nedeni ile birlikte, ayrıca *Hiçbir şey değiştirilmedi.*
- **Yapıştırmada atlanan hücreler** (bilgi) — *N hücre atlandı: salt okunur (örneğin otomatik numaralandırılmış bir WBS kodu veya hesaplanan bir sütun).*
- **Yapıştırmada temizlenen başvurular** (bilgi) — *N başvuru bu belgede yoktu ve temizlendi (kaynak belgeden görev takvimleri, özel görev türleri, aktivite kodları veya kullanıcı alanları).*
- **İş kuralı süreleri ayarladı** (bilgi) — *Takvim değişikliğinden sonra iş kuralı N görevin süresini ayarladı (iş aynı kaldı, günlük saatler değişti).* *İş kuralları açıklaması* bağlantısıyla birlikte gösterilir.

### Primavera (XER)

- **XER dosyası açıldı** (bilgi) — *XER dosyası açıldı: N proje belgesi.* Dosya birden fazla proje açsa bile dosya başına bir bildirim gelir. Altında bir *Daha fazla bilgi* bağlantısı ve ayrıntı satırları bulunur. Her zaman *N proje bulundu.* yazar. Yalnızca sayı 0'dan büyükse: *N boş proje atlandı.*, *N temel proje dışarıda bırakıldı.*, *N temel plan oluşturuldu.*, *N boşta kalan temel plan başvurusu yok sayıldı.*, *Koruyucu temel plan geri dönüşü kullanıldı.* ve *N dış ilişki korundu.* Yalnızca UTF-8 dışındaki bir kodlama için: *Metin kodlaması seçildi: {encoding}.* Ayrıca, sayı 0'dan büyükse: *N ayrıştırıcı bulgusu.*, *N takvim bulgusu.*, *N sayı biçimi sorunu.*, *N enum geri dönüşü.* ve *N P6 planlama ayarı güvenli geri dönüş kullandı.*
- **Primavera'nın kaydettiği tarihler** (ayrıntı satırı, aynı bildirimde) — *N görev, Primavera'nın kaydettiği tarihleri gösteriyor (yeniden hesaplanmadı).* ya da mod açılmadıysa, *N görev, dosyada kayıtlı tarihlerden farklı — bunları gösterebilirsiniz.*
- **XER kaynak arşivi kullanılamıyor** (bilgi) — *Bu dosyadaki XER kaynak arşivi kullanılamaz durumda ve dışarıda bırakıldı; projenin kendisi eksiksiz açıldı.* ile birlikte neden (örneğin *Neden: sağlama toplamı kaynak baytlarıyla eşleşmiyor — arşiv hasarlı.*) ve sonuç (*Planlama, hesaplama profili ve IFC'deki tüm proje verileri eksiksizdir. …*) gösterilir. Daha önce kaydedilmiş bir XER kaynak arşivinin kullanılamadığı bir IFC dosyasını açtığınızda.
- **XER bilgisi dışa aktarmada kaybolur** (bilgi) — *{format} biçimine dışa aktarma XER kaynak bilgilerini kaybeder.* IFC dışındaki bir biçime, yalnızca bir XER dosyasında bulunan verileri olan bir projeyi başarıyla dışa aktardıktan sonra. *Daha fazla bilgi* bağlantısıyla birlikte.

### İçe aktarma, dışa aktarma ve hesaplama profili

- **Tarihler dosyadaki gibi** (bilgi) — *N görev, dosyada kayıtlı tarihleri gösteriyor (yeniden hesaplanmadı).* ya da *N görev, dosyada kayıtlı tarihlerden farklı — bunları gösterebilirsiniz.* Kayıtlı tarihleri olan bir dosya açtığınızda gösterilir.
- **İş ve iş kuralları görünür** (bilgi) — *Bu dosya kaydedilmiş iş veya özel iş kuralları içeriyor; iş kuralı ve kalan iş bu proje için gösteriliyor.*
- **MS Project planlaması okundu** (bilgi) — *Bu MS Project dosyası, bölünmüş, dengelenmiş veya kaynak odaklı planlanmış N görev içeriyor. Böyle içe aktarılır ve gösterilir.*
- **Molalar dışa aktarılmadı** (bilgi) — *Kesintili N görev kesintileri olmadan dışa aktarıldı: MS Project/P6 bunları yalnızca iş dağılımı olarak tanır.* MS Project'e veya Primavera'ya dışa aktarırken gösterilir.
- **Proje başlangıcı taşındı** (bilgi) — *Proje başlangıcı taşındı: öncülü veya kısıtlaması olmayan N görev çıpası yeni başlangıç tarihine kaydırıldı.*
- **Tarih penceresi artık yönlendirmez** (bilgi) — *Bu düzenlemeden sonra MS Project'in tarih penceresi artık N görevi yönetmiyor; …* Belge başına bir kez gösterilir.
- **Dengeleme gecikmesi yuvarlandı** (bilgi) — *Kaynak dengeleme, MS Project'ten gelen dakika hassasiyetindeki dengeleme gecikmesini N görev için tam iş gününe yuvarlar.* Belge başına bir kez gösterilir.
- **Hesaplama profili uygulandı** (bilgi) — *Bu proje {profile} olarak hesaplanıyor. Dosya → Proje bilgisi → Hesaplama profili ve seçenekleri üzerinden değiştirin.* *Hesaplama profilini aç* düğmesiyle birlikte. Bir profil uygulandıktan sonra gerekirse *Uygulamadan sonra N görev kaydı.* bildirimi de gelir.
