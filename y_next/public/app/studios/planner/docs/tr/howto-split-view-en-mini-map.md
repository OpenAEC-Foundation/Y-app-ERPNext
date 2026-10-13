# Bölünmüş görünüm ve mini harita kullanma

Amaç: zaman çizelgesinin iki bölümünü yan yana görmek ve uzun bir planlamada hızlı ilerlemek.

## Bunu ne zaman kullanırsınız

Temelin başlangıcını ve aynı anda dokuz ay sonraki teslimi tartışıyorsunuz. Yardım olmadan sürekli yakınlaştırıp uzaklaştırırsınız ve nerede olduğunuzu kaybedersiniz. **Bölünmüş görünüm** ile aynı planlamayı iki kez, yan yana görürsünüz; her birinin kendi zaman penceresi vardır. **Mini harita** ile tüm proje süresini tek ince bir bantta görürsünüz ve aradığınız bölüme tıklayarak geçersiniz.

## Adımlar

### Bölünmüş görünümü açmak

1. *Görünüm* sekmesini seçin. *Sunum* grubunda *Sunum*, *Bölünmüş görünüm* ve *Mini harita* bulunur.
2. *Bölünmüş görünüm* öğesine tıklayın. Gantt ikiye bölünür. Her iki pencere de geçerli görünümünüzün yakınlaştırma düzeyi ve konumuyla başlar.

İki pencere görev tablosunu, satırları ve dikey kaydırmayı paylaşır. Her pencerenin kendine ait olan şey zaman eksenidir: yakınlaştırma düzeyi ve yatay konum.

### Her pencereye kendi zaman aralığını vermek

- Fare hangi pencerenin üzerindeyse o pencerede yakınlaştırın ve kaydırın. Varsayılan ayarda (*Kaydırma ve yakınlaştırma*: *Yakınlaştır + sürükle*) fare tekerleği o pencerede yakınlaştırır ve fare imlecinizi merkez alır. Ayarınız başka bir moddaysa tekerlek her iki pencerede de o moda göre çalışır.
- Varsayılan ayarla satırları Shift tuşu ve fare tekerleğiyle kaydırırsınız. Bu, iki pencerede birden geçerlidir.
- *Yakınlaştır +* ve *Uzaklaştır -* düğmeleri ile zaman ölçeği listesi (örneğin *Çeyrek*) yalnızca sol pencerede çalışır. Sağ pencereyi bu yüzden fare tekerleğiyle yakınlaştırırsınız.
- İki pencere arasındaki ayırıcıyı sola veya sağa sürükleyin. Pencereler daha geniş veya dar olur. Pencereler başlangıçta yarı yarıya başlar.

### Bölünmüş görünümü kapatmak

*Bölünmüş görünüm* öğesine yeniden tıklayın. Tek bir pencere kalır; bu, sol pencerenin görünümüdür. Yeni bir bölünmüş görünüm, o andaki görünümle yeniden başlar.

### Mini haritayı açmak

1. *Sunum* grubunda *Mini harita* öğesine tıklayın.
2. Zaman çizelgesinin altında tüm proje süresini gösteren bir bant belirir. Geçerli görünümünüzün görevleri ince çizgiler olarak görünür. Bir filtre uygulandıysa yalnızca o filtrenin gösterdiği görevler görünür. Bantta, şu anda gördüğünüz bölümün etrafında bir çerçeve bulunur.
3. Bandın istediğiniz yerine tıklayın; çerçeve oraya gelir ve pencere o noktayı ortalar. Ya da çerçeveyi tutup sürükleyin.

Mini harita yalnızca zaman penceresini taşır. Satırlar olduğu gibi kalır.

Bölünmüş görünüm açıksa her pencerenin kendi bandı olur; bu bant, pencerenin kendi zaman çizelgesi bölümünün altındadır. Her bant yalnızca üstündeki pencereyi kontrol eder.

## Tuzaklar ve uygulamanın davranışı

**Tüm proje zaten görünüyorsa mini harita işe yaramaz.** Tüm planlama sığacak kadar uzaklaştırırsanız gidilecek bir yer kalmaz ve tıklamanın bir etkisi olmaz. Önce yakınlaştırın.

**Mini harita yalnızca Gantt'ta bulunur.** *Tablo*, *IFC* ve *Rapor* sekmelerinde ve tam kaynak paneli (*Kaynaklar*, *Kaynak doku* değil) zaman çizelgesi yoktur; bu yüzden ne mini harita ne de bölünmüş görünüm vardır. Gantt'lı bir görünüme geri döndüğünüzde yeniden görünürler.

**Bölünmüş görünüm projeye bağlıdır, mini harita değildir.** Bölünmüş görünüm açık proje için geçerlidir: başka bir projeye geçip geri dönerseniz hâlâ oradadır. Mini harita tüm projeler için tek bir seçimdir ve yeniden başlatıldıktan sonra da açık veya kapalı kalır. İkisi de ekran seçimidir: proje dosyasına yazılmazlar, projeyi “değiştirilmiş” yapmazlar ve *Geri al* kapsamında değildirler.

**Bölünmüş görünüm ve sunum.** İkisi de sunum modunu açtığınızda görünür kalır (bkz. [Büyük ekranda sunum yapmak](docs://howto-presentatie)). Şerit o zaman gizlendiği için, bu modda ikisini artık açamaz veya kapatamazsınız. Bu yüzden başlamadan önce doğru ayarlayın.

## Ayrıca bakın

- [Büyük ekranda sunum yapmak](docs://howto-presentatie): Gantt tam ekranda, şerit olmadan.
- [Düzen oluşturmak ve kullanmak](docs://howto-layouts-gebruiken): zaman ölçeği de bir düzenin parçası olarak kaydedilebilir.
