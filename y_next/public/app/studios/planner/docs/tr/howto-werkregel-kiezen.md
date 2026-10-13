# İş kuralı seçme

Amaç: Her görev için, süreyi, birimleri veya işi değiştirdiğinizde uygulamanın neyi ayarlayacağını belirleyin: süreyi, birimleri veya işin kendisini.

## Bunu ne zaman kullanırsınız

Bir göreve kaynak eklediniz ve uygulamanın sizin yaptığınız gibi hesaplamasını istiyorsunuz. Bir örnek: vinç bir gün için kiralanmıştır ve o gün sabittir. Başka bir örnek: içinde 160 saat duvar örme işi olduğunu biliyorsunuz ve bunun iki kişi yerine üç kişiyle ne kadar sürdüğünü görmek istiyorsunuz. Bu iki durum farklı bir iş kuralı gerektirir.

Kural, bir diğerini değiştirdiğinizde üç büyüklükten hangisinin birlikte hareket edeceğini belirler: süre, birimler veya iş. Arka plan ve uygulamalı örnekler [İş kuralları: süre, birimler ve iş](docs://uitleg-werkregels) sayfasında yer alır.

## Adımlar

### İş kuralını göstermek

İş kuralı varsayılan olarak gösterilmez. Bunu bir kez açın:

1. *Ayarlar › Proje › Ayarlar* yolunu seçin ve *Planlama* sekmesini açın.
2. *Hesaplama* başlığının altında *İş kurallarını ve işi göster* kutusunu işaretleyin.
3. Pencereyi *Kapat* ile kapatın.

Bu, uygulamanın bir ayarıdır, proje dosyasının değil. Bir dosyada zaten iş kuralları veya kayıtlı iş varsa, örneğin MS Project veya Primavera P6 dosyasından gelen bir dosya, uygulama o dosyanın iş kuralını bu ayar olmadan da gösterir. Aynısı, bir dosyada kendiniz bir iş kuralı seçtiğinizde de geçerlidir: o zaman gösterim o dosya için açık kalır, ayarı daha sonra kapatsanız bile. Dosya açık olduğu sürece gösterim açık kalır. Dosyayı yeniden açtıktan sonra ise dosyada bir iş kuralı veya kayıtlı iş olduğu sürece açık kalır.

### Bir kural seçmek

1. Görevi seçin. *Özellikler* paneli sağda yer alır. Bu paneli görmüyorsanız, *Görünüm › Paneller › Özellikler* ile açın.
2. *İş kuralı* alanında beş seçenekten birini seçin: *Proje varsayılanı (Sabit süre ve birimler)*, *Sabit süre ve birimler*, *Sabit süre ve iş*, *Sabit iş* veya *Sabit birimler*. *Proje varsayılanı* ile görev, projenin varsayılanını izler.
3. Açılır listenin altında uygulama, kuralın neyi koruduğunu gösterir, örneğin *Korunan: iş (süre birimleri izler)*.

*Proje varsayılanı* ilk seçenektir. Bir görev varsayılan olarak bu seçeneğe sahiptir. Parantez içindeki kural, projenin şu anda varsayılan olarak sahip olduğu kuraldır. Uygulamada bu proje varsayılanını değiştirmek için bir düğme yoktur. Proje varsayılanı bir içe aktarmadan (örneğin MS Project veya Primavera P6) ya da MCP bağlantısından gelir. Tek bir görev için başka bir kural istiyorsanız, onu burada seçin.

Kuralı tabloda da seçebilirsiniz. Görev tablosu başlığının sağındaki **+** öğesine tıklayın (*Sütun ekle*) ve *Planlama* altında *İş kuralı* sütununu seçin.

Hiç atama içermeyen bir görevde birbirine bağlanacak bir şey yoktur, bu yüzden kural orada bir şey yapmaz. Önce bir kaynak atayın (bkz. [Eğriyle kaynak atamak](docs://howto-resource-toewijzen)).

### İşi görmek ve değiştirmek

Atamaları olan bir görevde, *Özellikler* panelinin *Atamalar* bölümünde, *Birim/gün* sütununun yanında bir *İş (kalan)* sütunu görünür. Bu, o kaynağın saat cinsinden kalan işidir. Bir sütunun üstündeki küçük kilit simgesi, kuralın neyi koruduğunu gösterir: *Birim/gün* için *Sabit süre ve birimler* ile *Sabit birimler* kurallarında, *İş (kalan)* için *Sabit süre ve iş* ile *Sabit iş* kurallarında.

İşi kendiniz değiştirmek istiyorsanız, saat sayısını alana yazın ve Enter tuşuna basın. Uygulama 0 veya daha küçük bir değeri kabul etmez: alan önceki değere geri döner.

### Ne olduğunu görmek

Bir kural seçerseniz henüz hiçbir sayı değişmez. İşi koruyan bir kuralda uygulama yalnızca mevcut işi sabitler, bu yüzden *İş (kalan)* kayıtlı bir değere sahip olur. Kural, neyin birlikte hareket edeceğine ancak bir sonraki değişiklikte karar verir. Örneğin *Birim/gün* değerini değiştirin ve süre ile iş üzerindeki etkisini görün.

Bu, görevin süresini değiştirirse durum çubuğunda *Güncel değil — yeniden hesaplayın (F5)* yazar. Yeni tarihleri görmek için **Hesapla** (F5) tuşuna basın, örneğin *Ana sayfa › Zamanlama › Hesapla* üzerinden. *Otomatik hesapla* açıksa (aynı *Planlama* sekmesi, *Hesaplama* başlığı altında), uygulama bunu kendisi yapar.

## Hangi kural uygun

- **Sabit süre ve birimler** uygundur, süre bir anlaşmaysa ve birimler sizin girdinizse. İş bu ikisinden çıkar. Bu varsayılandır. Bir gün için kiralanan vinç buraya aittir: gün sabittir ve o gün kaç vinç olacağına siz karar verirsiniz.
- **Sabit süre ve iş** uygundur, görevin sabit bir zaman aralığı içinde tamamlanması gerekiyorsa ve içinde ne kadar iş olduğunu biliyorsanız. Süre değişirse uygulama birimleri ayarlar.
- **Sabit iş** uygundur, içinde kaç saat iş olduğunu biliyorsanız ve kişi sayısıyla sürenin nasıl değiştiğini görmek istiyorsanız. İki kişi yerine üç kişiyle yapılan 160 saatlik duvar örme işi buraya aittir. Alıştırma projesindeki sıva işi bu kuralı alır.
- **Sabit birimler** uygundur: birimler sabittir (örneğin bir vinç) ve süreyi iş belirler.

## Sorunlar ve uygulamanın o durumda yaptığı

***İş kuralı* alanı görünmüyor.** Bu durumda *İş kurallarını ve işi göster* ayarı kapalıdır ve dosyada henüz iş kuralı yoktur. Ya da bir kilometre taşı, bir faz, bir hamak veya süre türü *Geçen süre* olan bir görev seçmişsinizdir. Orada iş kuralı yoktur. Normal bir görev seçin.

**Siz değiştirmediğiniz hâlde süre değişir.** *Sabit iş* ve *Sabit birimler* altında süre birimlere ve işe göre belirlenir. Bunlardan birini ya da kaynak sayısını değiştirirseniz, uygulama süreyi tam iş gününe yukarı yuvarlayarak ayarlar. Saat cinsinden süresi olan bir görevde uygulama tam dakikaya yukarı yuvarlar.

**İş, birim × süreyle tam olarak eşleşmez.** Bunun nedeni yuvarlama olabilir. *İş (kalan)* yanında bir uyarı işareti belirir: *Birim × süreden farklı*. Histogram, kayıtlı işi izler.

**Malzeme hesaba katılmaz.** Bir malzeme kaynağında *İş (kalan)* bir çizgi gösterir. Malzeme hiçbir zaman süreyi yönlendirmez.

**İlerlemesi olan bir görev.** Kural kalan kısım üzerinde çalışır. Bu yüzden *İş (kalan)* yalnızca hâlâ yapılması gereken kısmı gösterir.

**Geri alma.** Bir kural seçmek ve kuralın hesapladığı her değişiklik tek bir adımdır: *Geri al* (Ctrl+Z) ile geri alırsınız. Geri alındığında kural yeniden kalkar, ama *İş kuralı* alanı görünmeye devam eder.

## Ayrıca bakın

- [İş kuralları: süre, birimler ve iş](docs://uitleg-werkregels): uygulamanın süre, birimler ve işi birbirine nasıl bağladığı, uygulamalı örneklerle.
- [Eğriyle kaynak atamak](docs://howto-resource-toewijzen): bir kaynağı bir göreve koymak.
