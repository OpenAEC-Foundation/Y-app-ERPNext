# Bir yolu izleme

Amaç: bir görevin önündeki veya ardındaki görev zincirini görünür yapmak. Böylece bir görevin tarihini neyin belirlediğini ve bir görev gecikirse neyin birlikte kayacağını görürsünüz.

## Ne zaman ihtiyaç duyarsınız

Çatı işi yalnızca üç hafta sonra başlar ve hangi görevin bunu belirlediğini bilmek istersiniz. Veya duvarcı bir hafta gecikir ve ondan sonraki hangi görevlerin birlikte kaydığını görmek istersiniz. Onlarca ilişkisi olan bir planlamada bunu çizgilerden göremezsiniz. **Yol izleme** ile uygulama, seçilen göreve önce gelen tüm **öncülleri** (doğrudan veya diğer görevler üzerinden) ve ona sonra gelen **ardılları** renklendirir. Kalanı soluklaştırır.

## Adımlar

1. Yolunu görmek istediğiniz görevi, görev tablosunda veya Gantt'taki çubuğunda seçin. Birden fazla görev seçerseniz uygulama, ilk seçtiğiniz görevden izler.
2. Görevden önce gelen her şeyi görmek için *Planlama › Yol izleme › Öncüller* öğesini seçin. Görevden sonra gelen her şeyi görmek için *Planlama › Yol izleme › Ardıllar* öğesini seçin. Bu iki düğme aynı anda açık olabilir. Aynı iki düğme *Tablo* sekmesinde, *Yol izleme* grubunda da bulunur.
3. Her iki yönü birlikte görmek istiyorsanız Gantt'ta veya görev tablosunda göreve sağ tıklayın ve *Yolu izle* öğesini seçin.
4. Sonucu Gantt'ta ve görev tablosunda inceleyin. Nasıl okuyacağınız aşağıda açıklanır.
5. Etkin düğmeye yeniden tıklayarak, bir göreve sağ tıklayıp *Yol izlemeyi durdur* öğesini seçerek veya Esc tuşuyla durdurursunuz. Esc seçimi de temizler.

Yol izlerken başka bir görev seçerseniz yol, yeni seçime göre değişir.

## Sonucu okumak

- Öncüller altın rengindedir, ardıllar mor. Gantt'ta çubuklar renk değiştirir. Görev tablosunda satırın soluna bir şerit çıkar: öncüller için düz, ardıllar için kesikli. Seçilen görevin çevresinde bir dış çizgi vardır.
- Daha koyu bir renk, görev tablosunda ise daha kalın bir şerit ve kalın yazı, **belirleyici** ilişkilerin zincirini gösterir: tarihleri gerçekten belirleyen ilişkileri. Bunun ne anlama geldiği [İlişkiler ve gecikme](docs://uitleg-relaties) başlığında açıklanır.
- Yolun dışındaki tüm görevler soluklaşır. Yola ait olmayan ilişki çizgileri daha soluk ve noktalıdır.

## Sorunlar ve uygulamanın ne yaptığı

**Seçili görev yok.** Seçili görev olmadan izlenecek bir şey yoktur: düğme açıktır, ama ekranda bir şey değişmez. Önce bir görev seçin.

**Belirleyici ilişkiler zincirinde vurgu yok.** Vurgu, son hesaplamadan gelir. Planlama henüz hesaplanmadıysa veya hesaplama bir hata verdiyse uygulama tüm öncülleri ve ardılları aynı güçte renklendirir. **Hesapla** (F5) komutunu çalıştırın, örneğin *Ana sayfa › Zamanlama › Hesapla* üzerinden, ve yolu yeniden inceleyin. Bir değişiklikten sonra durum çubuğunda *Güncel değil — yeniden hesaplayın (F5)* yazdığı sürece vurgu önceki hesaplamada kalır.

**Bir faza bağlı ilişki.** Yol izleme, ilişkileri sizin kurduğunuz şekilde izler. Bir fazdan (özet görev) veya bir faza giden ilişki, fazın kendisine bağlanır. Hesaplamada bu ilişki o fazdaki her göreve geçerlidir, ama yol fazın içindeki görevlere devam etmez. Bu yüzden, fazın kendisinde bir ilişkiyle başka bir göreve bağlı olan bir faz içindeki bir görevi izlerseniz, o ilişkiyi görmezsiniz. Bu durumda fazın kendisini seçin.

**Yalnız seçilen yön.** Yalnız *Öncüller* açıksa görevden sonra gelenleri görmezsiniz. Tersi de geçerlidir.

## Ayrıca bakın

- [İlişkiler ve gecikme](docs://uitleg-relaties): neden bir ilişkinin belirleyici ilişki olduğu ve uygulamanın bir görevin başlangıç tarihini nasıl hesapladığı.
- [Kritik yol ve bolluk](docs://uitleg-kritiek-pad): hangi zincirin projenin bitişini belirlediği.
- [İlişki ekleme](docs://howto-relaties-leggen): yolda bir bağlantı eksikse ilişki eklemek.
