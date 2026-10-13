# Uzantı kurma ve yönetme

Hedef: bir uzantı kurmak, izin sorusunu okumak ve daha sonra uzantıyı devre dışı bırakmak veya kaldırmak.

## Bu bilgiye ne zaman ihtiyacınız olur

Bir uzantı, yeni bir sürümü beklemeden uygulamaya bir şey ekler. Bir uzantı örneğin *Dosya › İçe aktar* içinde görünen bir içe aktarma biçimi ekleyebilir, şeride bir düğme koyabilir veya PDF dışa aktarımı için bir yazı tipi sağlayabilir. Resmi katalog uzantıları kategorilere ayırır: *İçe aktarma/Dışa aktarma*, *Planlama*, *Rapor*, *Yardımcı*, *Yazı tipleri* ve *Diğer*.

Kurmadan önce dikkatli düşünün. Bir uzantı, uygulamanın kendisiyle aynı haklarla çalışan program kodudur. Uygulama bunu sınırlayamaz. Bu yüzden uygulama her kurulumda izin ister. Bu soruda gördükleriniz aşağıda açıklanmıştır.

## Adımlar

### Katalogdan bir uzantı kurun

1. *Dosya › Uzantılar* öğesini seçin.
2. *Gözat* sekmesini seçin. Uygulama katalogu alırken *Katalog yükleniyor...* yazar. Katalogda ne olduğuna, onu yöneten OpenAEC Foundation karar verir. Bu değişebilir.
3. *Uzantı ara...* alanında bir uzantı arayın. Uygulama adda, açıklamada, yazarda ve etiketlerde arar.
4. Her kart adı, sürümü, kategoriyi, açıklamayı ve yazarı gösterir. *Kur* öğesini tıklayın.
5. *Uzantı kurulsun mu?* penceresi açılır. Pencereyi okuyun. Sonraki adıma bakın.
6. Devam etmek için *Yükle* öğesini tıklayın. *Kurma* öğesiyle hiçbir şey olmaz. Esc tuşu veya pencerenin yanına tıklamak da reddetmek anlamına gelir. Uygulama o zaman hata mesajı göstermez.

Kurulumdan sonra uzantı hemen etkinleşir. *Gözat* içindeki kartta artık *Yüklü* yazar. Uzantının ne eklediğini uygulamanın içinde görürsünüz: şeritte yeni bir düğme veya *Dosya › İçe aktar* içinde bir içe aktarma biçimi. Bazı uzantılar ayrıca bir mesaj gösterir. Bunu *Uzantı* önekiyle ve ardından uzantının adıyla tanırsınız.

### Bir dosyadan uzantı kurun

Bir uzantıyı dosya olarak aldıysanız, onu şöyle kurun.

1. *Dosya › Uzantılar* öğesini seçin.
2. Sağ üstte bir ZIP dosyası için *ZIP*, ayrı bir JavaScript dosyası için *JS* öğesini tıklayın.
3. Dosyayı seçin. *Uzantı kurulsun mu?* penceresi açılır, yukarıdaki gibi.

Bir ZIP dosyasında bir `manifest.json` ve uzantının ana dosyası bulunmalıdır. Zaten kurulu bir uzantıyı kurarsanız, yeni sürüm eskisinin yerine geçer. Uygulama dosyayı kuramazsa, örneğin bir ZIP dosyası bozuk olduğu için, hiçbir şey olmaz. Uygulama ZIP ve JS için hata mesajı göstermez ve uzantı listede görünmez. Nedeni yine de hata ayıklama terminalinde yazar. Terminali *Ayarlar › Proje › Ayarlar* yolunda etkinleştirin. Orada *Gelişmiş* sekmesini seçin ve *Hata ayıklama terminalini etkinleştir* öğesini işaretleyin. Durum çubuğundaki *Hata ayıklama terminalini göster* düğmesiyle terminali gösterin. Orada örneğin şu satır yazar: *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (Uygulama bu teknik metni Hollandaca yazar).

### İzin sorusunu okuyun

Soru, neyi karar vermeniz gerektiğini gösterir.

- *Yazar* ve *Depo* uzantıyı kimin yaptığını ve kaynak kodun nerede olduğunu gösterir.
- *Kaynak* dosyanın nereden geldiğini gösterir: *Çevrimiçi uzantı kataloğundan*, *Bu bilgisayardaki bir ZIP dosyasından* veya *Bu bilgisayardaki bir JavaScript dosyasından*. Altında dosyanın kontrol edilip edilmediği yazar. Katalog için *İndirme, katalogdaki sağlama toplamıyla doğrulandı.* yazar. Katalog sağlama toplamı vermiyorsa kırmızıyla *Katalog sağlama toplamı vermiyor — bu indirme doğrulanmadı.* yazar. Kendi dosyanız için *Bu dosyayı kendiniz seçtiniz; karşılaştırılacak harici bir kaynak yok.* yazar.
- *Neye evet diyorsunuz* bölümü şunu söyler: *Uzantı, Open Planner Studio'nun kendisiyle aynı haklarla çalışan program kodudur. Onu sınırlayan bir şey yok. Yalnızca yazarına güvendiğiniz uzantıları kurun.* Altında platformunuzda bunun ne anlama geldiği yazar. Masaüstü uygulamasında şunu yazar: *Masaüstü uygulamasında bu şunları içerir: kullanıcı klasörünüzün her yerinde dosya okuma ve yazma, ayrıca projelerinize, ayarlarınıza ve panonuza erişim.* Tarayıcıda şunu yazar: *Tarayıcıda bu şu anlama gelir: kayıtlı projelerinize ve ayarlarınıza, erişim verdiğiniz dosyalara ve ağa erişim.*
- *Bu uzantının kullandığını belirttikleri* bölümü, yazarın bildirdiği izinleri küçük etiketler olarak gösterir. Bu bir beyandır, bir kısıtlama değildir: *Bu, yazarın beyanıdır, bir kısıtlama değil — kod yine de fazlasını yapabilir.* Etiket yoksa *Hiçbir şey belirtilmemiş* yazar. Bu, uzantının hiçbir şey yapamadığı anlamına gelmez. Etiket olmasa bile bir uzantı planlamanızın verilerini okuyabilir ve değiştirebilir, ayrıca mesaj gösterebilir.

Etiketlerin anlamı şudur:

- *ribbon*: uzantı şeride düğmeler koyar.
- *events*: uzantı uygulamadaki olayları dinler.
- *backstage*: uzantı *Dosya › İçe aktar* öğesine içe aktarma biçimleri ekler.
- *pdf-fonts*: uzantı PDF dışa aktarımı için bir yazı tipi sağlar.
- *importSource*: uzantı, içe aktardığınız her dosyanın tüm özgün baytlarını okuyabilir, örneğin ham bir Primavera dosyasını. Buna projenize girmeyen alanlar da dahildir. Pencere bunu kendisi de açıklar.
- *help*: uzantı Yardım makaleleri ekleyebilir, paketlenmiş projeleri yeni bir belge olarak açabilir ve uygulamanın bölümlerine işaret eden bir kılavuz gösterebilir. Pencere bunu kendisi de açıklar.
- *filesystem* ve *network*: bunlar yalnızca yazarın niyetine dair işaretlerdir. Uygulamanın bunlar için bir işlevi yoktur.

### Bir uzantıyı devre dışı bırakın, yeniden etkinleştirin veya kaldırın

1. *Dosya › Uzantılar* öğesini seçin ve *Yüklü* sekmesini seçin. Her uzantının adı, sürümü, kategorisi, açıklaması ve yazarı olan bir kartı vardır.
2. Kartındaki anahtarla uzantıyı devre dışı bırakırsınız (*Devre dışı bırak*) veya yeniden etkinleştirirsiniz (*Etkinleştir*). Devre dışıyken uzantının eklediği düğmeler ve içe aktarma biçimleri kaybolur. Uzantı yine de kurulu kalır. Uygulamayı yeniden başlattıktan sonra da kapalı kalır. Etkin bir uzantı, uygulama açıldığında kendiliğinden başlar.
3. *Kaldır* öğesini tıklayın. Düğme *Onayla* olur ve *Kalıcı olarak kaldırmak için tekrar tıklayın* açıklaması görünür. Uzantıyı kalıcı olarak kaldırmak için bir kez daha tıklayın. Uygulama, uzantının sakladığı ayarları da temizler.

## Sorunlar ve uygulamanın o durumda ne yaptığı

**Katalog yüklenmez.** Uygulama *Katalog yüklenemedi:* yazar ve ardından teknik nedeni gösterir. Ayrıca *Tekrar dene* düğmesi görünür. Bunun nedeni internet bağlantınızın olmaması olabilir.

**Katalogdaki bir kartın altında *Kurulum başarısız.* yazar.** İndirme veya kurulum başarısız oldu, örneğin sağlama toplamı eşleşmediği için. O durumda hiçbir şey kurulmadı. Bu, soruyu reddetmekten farklıdır. Soruyu reddettiğinizde hata mesajı yoktur.

**Listenin üstünde *Atlanan katalog girdileri: 1* yazar.** Katalogda uygulamanın kullanamadığı bir öğe vardı. Diğer uzantıları her zamanki gibi kurabilirsiniz.

**Bir uzantı başlamaz.** Kartta o zaman bir hata mesajı görünür. Bu bir hata mesajı olabilir: uzantı uygulamanın daha yeni bir sürümünü gerektirir ve mevcut sürümünüz gösterilir. Ya da uzantının kendi hatası görünür. Uzantı o zaman etkin değildir. Uygulamayı güncelleyin veya uzantıyı kaldırın.

**Bir kart *Karantina* ile işaretlenmiştir.** Uygulama saklanan uzantıyı kullanamadı. Adın altında *Neden:* yazar ve ardından neden gelir. *Depolamadan kaldır* ile temizlersiniz.

**Kendiniz bir uzantı yazmak.** Uzantı yazarları için kılavuz (manifest, API, izinler) GitHub'da `OpenAEC-Foundation/open-planner-studio` deposunda, `docs/extensions.md` dosyasında bulunur.

**Bir uzantı bir projeye ait değildir.** Uzantılar uygulamanın içinde saklanır. Masaüstü uygulamasında bu bilgisayarda, tarayıcıda ise o tarayıcının depolamasında saklanır. Uzantılar tüm projelerinizde geçerlidir ve proje dosyanızın parçası değildir. Tarayıcıda sitenin verilerini silerseniz uzantılar da gider.

## Ayrıca bakın

- [Uygulamayı güncelleme](docs://howto-app-bijwerken): bir uzantı uygulamanın daha yeni bir sürümünü isteyebilir.
- [Uzantı izinleri](docs://ref-extensiepermissies): kurulum sorusundaki her iznin ne anlama geldiği.
