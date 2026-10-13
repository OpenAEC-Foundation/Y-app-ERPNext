# Bir görevi bölme

Amaç: bir görevi kesmek. İş durur ve sonra devam eder, ama görev iki göreve dönüşmez.

## Ne zaman gerekir

Donatı yerleştirmek sekiz iş günü sürer. Ancak dört gün sonra vinç başka bir işe gitmek zorunda kalır ve iş iki gün sonra devam eder. İki ayrı görev yapmak, ilişkilerinizi ve atamalarınızı iki kez tutmanız demektir. Bir **kesinti** ile bu yine tek bir görev olur; aralığı olan tek bir çubukla. Uygulama kesintiye ayrıca *ara* adını verir.

İşin süresi aynı kalır, ama görev takvimde artık daha uzun sürer. Örnek: 8 iş günü süren ve Salı, 29 Eylül 2026 günü başlayan bir görev, Perşembe, 8 Ekim günü biter. 4 iş gününden sonra 2 iş günü kesinti koyarsanız, görev Pazartesi, 12 Ekim günü biter. Süre 8 iş günü olarak kalır; yalnızca bitiş iki iş günü kayar.

## Adımlar

### Gantt'ta bölme

1. *Ana sayfa › Görevler › Görevi böl* (veya *Planlama › İlişkiler › Görevi böl*). Planlamanın üstünde şu bildirim görünür: *Kesintinin başladığı günde çubuğa tıklayın ve uzunluğu için sağa sürükleyin. Durdurmak için Esc.* Düğme ayrıca *Tablo* sekmesinde de var (*Tablo › Görevler › Görevi böl*), ama orada devre dışıdır.
2. Fareyi çubuğun üzerine getirin. Kesintinin nerede başlayacağını kesikli bir çizgi ve tarihli bir etiket gösterir. Kesintinin başladığı günde çubuğa basın.
3. Sağa sürükleyin. Etiket uzunluğu gösterir, örneğin *2 iş günü kesinti*. Bu, farenizin altındaki güne kadar olan iş günü sayısıdır. Bırakın.

Sürüklemeden yalnızca tıklarsanız, ara bir iş günü olur. Sola geri sürüklerseniz ara yeniden kısalır; en az bir iş gününe kadar. Süresi saatle ölçülen bir görevde ara da saatle ölçülür.

Mod açık kalır, böylece daha fazla görev bölebilirsiniz. Durdurmak için Esc tuşuna basın veya bildirimdeki *Durdur* düğmesini kullanın. Sürüklerken Esc tuşuna basarsanız, uygulama aradaki değişikliği geri çevirir ve mod durur. Her hareket, *Geri al* için bir adımdır.

Bölmeden sonra planlama güncel değildir. Kesin tarihler için **Hesapla** (F5) tuşuna basın.

### Gantt'ta mevcut bir kesintiyi sürükleme

Bu, bölme modu olmadan, doğrudan kesintisi olan bir çubukta çalışır.

- Aranın sonrasındaki parçayı sağa veya sola sürükleyin. Ara uzar veya kısalır; etiket *3 iş günü kesinti* gösterir. Ara 0 olana kadar geri sürüklerseniz, etiket *Birleştir* gösterir ve iki parça yeniden birleşir.
- Aranın önündeki parçanın sağ kenarını sürükleyin. Bu parça uzar veya kısalır; etiket *Parça: 5 iş günü* gösterir. Görevin süresi de bununla değişir.
- İlk parçayı sürüklerseniz, her çubukta olduğu gibi tüm görevi taşırsınız.

### Özellikler panelinde bölme ve ayarlama

Görevi seçin. *Özellikler* panelinde *Kesintiler* bloğu *İlişkiler* altında ve *Atamalar* üstündedir. Gerekirse ona kaydırın.

- *Kesinti ekle* en uzun parçanın tam ortasına bir iş günü ara koyar.
- Her aranın iki kutusu vardır: *sonra* (aranın önünde kaç iş günü iş yapılır) ve *ara* (aranın uzunluğu). Bunların yanında, aranın sonrasındaki parçanın tarihleri görünür. Saat görevinde saatle gösterirler.
- *ara* değerini 0 yaparsanız, kesinti kaybolur. Küçük çöp kutusu (*Kesintiyi kaldır*) aynısını yapar.

Dikkatli olun: *sonra* kutusu aranın önündeki iş parçasını uzatır veya kısaltır. Bununla görevin toplam süresi de değişir. *ara* kutusu ile yalnızca bitiş değişir.

### Kesinti kaldırma

Gantt'ta kesintiye veya ondan sonraki parçaya sağ tıklayın ve *Kesintiyi kaldır* öğesini seçin. *Tüm kesintileri kaldır* öğesi, kesintisi olan her çubuğun sağ tık menüsündedir. Ya da yukarıda olduğu gibi *Özellikler* panelindeki *Kesintiler* bloğunu kullanın.

### Yapay zeka asistanıyla

Bağlı bir yapay zeka asistanı kesintileri `planner_set_task_splits` aracıyla ayarlar. Bu, panelle aynı biçimdedir: kaç iş günü (veya çalışma saati) iş yapıldıktan sonra ve kaç iş günü (veya çalışma saati) ara verileceği. Asistan her zaman tüm listeyi verir; boş bir liste tüm kesintileri kaldırır. Kesintileri `planner_get_task` ile geri okur. Aşağıda anlatılan kurallar geçerlidir: bölemediğiniz bir görevi asistan da bölemez. Kendiniz yaptığınız bölmenin aksine, uygulama planlamayı sonradan kendiliğinden yeniden hesaplar. Asistanı nasıl bağlayacağınız, [Bir yapay zeka asistanını bağlama (MCP)](docs://howto-ai-assistent-koppelen) sayfasında açıklanır.

## Dikkat edilmesi gerekenler ve uygulamanın yaptıkları

**Bazı görevler bölünemez.** Bir kilometre taşını, bir özet görevi, *Hamak (türetilmiş süre)* açık olan bir görevi (bkz. [Hamak oluşturma](docs://howto-hammock)), süre türü *Geçen süre* olan bir görevi, *Elle planlandı* olan bir görevi veya iki iş gününden kısa bir görevi bölemezsiniz. Bölme modunda fare izin yok imlecini gösterir ve hiçbir şey olmaz. Böyle bir görevde *Özellikler* panelinde *Kesintiler* bloğu da yoktur.

**Tablo sekmesinde düğme çalışmaz.** *Görevi böl* orada devre dışıdır, ipucu şöyledir: *Yalnızca Gantt şeması görünürken kullanılabilir*. Bu hareket bir çubuk gerektirir. Bölme modu ve ilişki oluşturma modu birbirini kapatır.

**Etkisiz bir tıklama.** Bir kesinti, görevin ilk gününde ve mevcut bir aranın içinde başlayamaz. Her iş parçası da en az bir iş günü uzunluğunda kalmalıdır. Böyle bir yere tıklarsanız hiçbir şey olmaz ve mesaj görünmez.

**İlerlemesi olan bir görev.** Görevin ilerlemesi varsa, bir kesinti yalnızca halihazırda biten işten sonra başlayabilir. 8 iş gününün %50'sinde bu, en erken beşinci iş günüdür. Tamamlanmış kısma tıklamak bir şey yapmaz. Tamamlanması %100 olan bir görev artık bölünemez. Panelde *Kesinti ekle* o zaman devre dışıdır. Bu, en uzun parçanın ortası tamamlanmış işe düşerse de geçerlidir, örneğin 8 iş gününün %75'inde.

**Dengeleme de kesinti oluşturur.** Bunlar *Kesintiler* bloğunda, *dengeleme* etiketiyle görünür. *Kaynaklar › Kaynak Dengeleme › Dengelemeyi temizle* bunları yeniden kaldırır. Bu tür bir görevin kesintilerini kendiniz düzenlerseniz, tüm dengeleme araları sizin olur ve *Dengelemeyi temizle* bunları artık kaldırmaz.

**Kesintiler MS Project'e veya Primavera'ya taşınmaz.** *MS Project XML* veya *Primavera P6 XML* olarak dışa aktarırsanız, o program bir kesintiyi yalnızca bir atamanın iş dağılımı olarak tanır. Böyle bir dağılım yoksa görev kesintisiz ulaşır. Uygulama kaç görevin bu duruma düştüğünü bildirir: *Kesintili 1 görev kesintileri olmadan dışa aktarıldı: MS Project/P6 bunları yalnızca iş dağılımı olarak tanır.* Uygulamanın IFC dosyasında kesintiler korunur.

**Uygulamanın düzenleyemediği kesintileri olan bir dosya.** Uygulamanın biçimine uymayan kaynak dosyadaki kesintiler, panelde şu mesajı gösterir: *Bu kesintiler kaynak dosyadan burada düzenlenemeyen bir biçimde geliyor*. Panelde yalnızca *Tüm kesintileri kaldır* kalır.

## Ayrıca bakın

- [Kritik yol ve bolluk](docs://uitleg-kritiek-pad): planlamanın iş günlerini nasıl saydığı ve bitişin neden kaydığı.
- [İlişki ekleme](docs://howto-relaties-leggen): Gantt'ta başka bir mod; bunu bir çubuğu sürükleyerek kullanırsınız.
- [Görev penceresi ve özellikler paneli](docs://ref-taak-eigenschappen): özellikler panelindeki Kesintiler bölümü.
