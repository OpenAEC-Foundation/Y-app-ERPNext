# Kaynak takvimi ayarlama

Amaç: histogram, aşırı atanmışlık ve dengelemenin bu takvimle hesaplanması için bir kaynağın hangi günlerde müsait olduğunu kaydetmek.

## Ne zaman gerekir

Duvarcı ekibi yalnızca pazartesiden perşembeye çalışır. Vinç, ağustosun ilk iki haftasında başka bir projededir. Bir taşeronun dört sabit iş günü vardır. Kendi takvimi yoksa uygulama, kaynağın proje takvimindeki günlerde çalıştığını varsayar.

Bir kaynak takvimi hiçbir görev tarihini değiştirmez. Yalnızca kaynağın ne zaman müsait olduğunu belirler. Bir görev, kaynağın çalışmadığı bir günde çalışıyorsa, o gündeki kapasite 0 olur ve o gün aşırı atanmış sayılır. Görevin kendisinin başka günlerde çalışmasını istiyorsanız, göreve kendi takvimini verin ([Takvim oluşturma ve atama](docs://howto-kalender-maken-en-toewijzen)). Bu fark, [Takvimler ve iş günleri](docs://uitleg-kalenders) sayfasında anlatılır.

## Adımlar

### Yeni bir kaynak takvimi oluşturma

1. *Kaynaklar › Yönet › Kaynaklar* öğesini seçin. Kaynak paneli açılır. Kaynak henüz yoksa, onu *Projede yeni kaynak* ile oluşturun.
2. Kaynağın satırını bulun. *Takvim* sütununda varsayılan olarak *Proje takvimi* görünür: kaynak o zaman proje takvimini izler.
3. Bu listeden *+ Kaynak takvimi* öğesini seçin. *Kaynak takvimi* penceresi açılır. Bu pencerede takvim formu ile aynı alanlar bulunur: *Ad*, *Çalışma günleri*, çalışma saatleri ve *Tatiller*. Yeni takvim, standart takvimin bir kopyası olarak başlar ve adı *Kaynak takvimi* olur.
4. Takvime kaynağa uygun bir ad verin, örneğin *Crew Mon–Thu*, ve çalışma günlerini ayarlayın: *Çalışma günleri* altında cuma gününün işaretini kaldırın. Tatilleri veya kullanılamayan dönemleri *Tatiller* listesine *Tatil ekle* ile eklersiniz.
5. *Uygula* düğmesine tıklayın. Takvim artık projenin kaynak kitaplığındadır ve kaynağa bağlıdır; bu, *Geri al* ile geri alabileceğiniz tek bir adımdır. *İptal* düğmesiyle hiçbir şey oluşturulmaz.

### Mevcut bir takvimi seçme veya değiştirme

*Takvim* sütununda listeden bir takvim seçin. *Proje takvimi* seçildiğinde kaynak kendi takvimini yeniden kaldırır. Seçilen takvimi değiştirmek istiyorsanız, listenin yanındaki kalem simgesine tıklayın (*Düzenle…*). Mevcut takvimle birlikte *Kaynak takvimi* penceresi açılır.

### Sonucu kontrol etme

1. Durum çubuğunda *Güncel değil — yeniden hesaplayın (F5)* yazıyorsa, **Hesapla** (F5) tuşuna basın.
2. *Kaynaklar › Histogram › Histogram* öğesini seçin ve histogramın solundaki listede kaynağa tıklayın. Kaynağın çalışmadığı ama planlanmış olduğu günler kırmızı görünür. Bunlardan birinin üzerine fareyi getirirseniz, çubuk örneğin şunu bildirir: *Bu gün “Crew Mon–Thu” takvimine göre çalışmıyor*.
3. *Kaynaklar › Aşırı atama* altında, aşırı atanmış kaynakların sayısı görünür ve durum çubuğu örneğin *1 kaynak aşırı atanmış* bildirir.

## Dikkat edilecek noktalar ve uygulamanın o durumda ne yaptığı

**Yalnızca günler sayılır, saatler değil.** Kaynak takvimi, kaynağın hangi günlerde çalıştığını belirler. O gün kaç birimin kullanılabileceği, kaynağın *Maks. birim* değerine bağlıdır; takvimdeki çalışma saatlerine bağlı değildir.

**Dengeleme bunu her zaman çözmez.** Görevin her gününün kaynağın bir iş gününe denk geldiği bir zaman aralığı yoksa, kaydırma yardımcı olmaz. *Kaynaklar › Kaynak Dengeleme › Dengele…* öğesini seçin ve *Hesapla* düğmesine tıklayın. Görev, *Kalan çakışmalar* altında şu gerekçeyle görünür: *Kaynak bu görevin ihtiyaç duyduğu tüm günlerde çalışmıyor — kaydırma bunu çözmez.* Ardından görevi başka bir kaynağa atayın veya göreve kendi takvimini verin.

**Paylaşılan takvim.** Liste, projenin tüm takvimlerini gösterir; buna *Proje takvimi* ve görevlerin takvimleri de dahildir. Böyle bir takvimi kalem simgesiyle değiştirirseniz, onu kullanan görevlerin planlaması da değişir ve durum çubuğu *Güncel değil — yeniden hesaplayın (F5)* bildirir. Bunun yerine kaynak için ayrı bir takvim oluşturun.

**Aşırı atanmışlık her zaman takvimden kaynaklanmaz.** Her gün çalışan bir kaynak da aşırı atanmış olabilir. İpucu, takvimi ancak gün kaynağın bir iş günü değilse anar.

## Ayrıca bakın

- [Takvimler ve iş günleri](docs://uitleg-kalenders): bir kaynak takviminin neden hiçbir tarihi kaydırmadığı.
- [Takvim oluşturma ve atama](docs://howto-kalender-maken-en-toewijzen): takvim formunun alanları.
- [Tatilleri ve inşaat tatilini oluşturma](docs://howto-feestdagen-genereren): takvime tatil ve kullanılamayan dönemleri eklemek.
- [Takvim pencereleri](docs://ref-kalenders): takvim pencerelerinin tüm alanları.
