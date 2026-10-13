# Kısıtlama veya son tarih ayarlama

Hedef: bir görev üzerinde bir tarih anlaşmasını kaydetmek. Böylece planlama bunu dikkate alır veya bu tarihi tutmadığınızı gösterir.

## Ne zaman ihtiyaç duyarsınız

Tuğlalar yalnızca 21 Haziran'da teslim edilir. Bu nedenle duvar örme daha erken başlamamalıdır: bir **kısıtlama**, *şu tarihten önce başlamaz (SNET)*. Çatı, inşaat tatilinden önce kapatılmalıdır. Bunun tutmaması durumunda uyarılmak istersiniz: bir **son tarih**. Beton dökümü bir güne sabittir, çünkü beton santrali bunu söz vermiştir: *Şu tarihte başlamalı*. Hangi türün ne zaman uyduğunu ve uygulamanın bununla ne yaptığını [Kısıtlamalar ve son tarihler](docs://uitleg-constraints) bölümünde açıklanmıştır.

## Adımlar

Bir kısıtlamayı ve bir son tarihi *Özellikler* panelinde ayarlarsınız.

1. Görevi seçin. *Özellikler* panelini görmüyorsanız, *Görünüm › Paneller › Özellikler* ile açın.
2. *Kısıtlama* alanında türü seçin, örneğin *Şu tarihten önce başlamaz (SNET)*.
3. *Mümkün olduğunca erken (ASAP)* ve *Mümkün olduğunca geç (ALAP)* dışındaki her türde *Kısıtlama tarihi* alanı görünür. Tarihi gün, ay ve yıl için üç kutuya yazın, örneğin 21, 06 ve 2027, ve Enter tuşuna basın. Uygulama, bir kutu dolduğunda kendiliğinden sonraki kutuya geçer. Türü seçtikten sonra tarih zaten oradadır: önceki kısıtlamanın tarihi veya yoksa görevin özgün planlanmış başlangıcı. Bu tarih, panelde gösterilen başlangıçtan farklı olabilir. Bu yüzden istediğiniz tarihi her zaman kendiniz girin.
4. Görevi öncüllerinden önce bile tarihe sabitlemek istiyorsanız *Şu tarihte başlamalı (MSO)* veya *Şu tarihte bitmeli (MFO)* seçin ve *Zorunlu (sabitleme mantığı)* kutusunu işaretleyin. Bu kesin bir sabitlemedir. Yalnızca gerçekten sabit olan bir tarih için kullanın.
5. İkincil bir sınır da istiyorsanız, örneğin görevin 14 Haziran'dan önce başlamaması ve 17 Haziran'a kadar bitmesi gerekiyorsa, *İkincil kısıtlama* alanında bir tür seçin ve *İkincil tarih* alanını doldurun. Bu alan, kesin sabitleme hariç, tarihi olan her kısıtlamada görünür. MSO ve MFO ile ikincil kısıtlamaya izin verilmez. Uygulama bunu kırmızıyla işaretler.
6. Son tarih için *Son tarih* alanını, kısıtlama tarihiyle aynı şekilde doldurun. Son tarih, kısıtlamadan ayrıdır: aynı göreve ikisini birlikte ayarlayabilirsiniz.
7. **Hesapla** (F5) tuşuna basın, örneğin *Ana sayfa › Zamanlama › Hesapla* üzerinden. O zamana kadar durum çubuğu *Güncel değil — yeniden hesaplayın (F5)* yazar.

Alanlar ayrıca *Görevi düzenle* penceresinde de bulunur. Bu pencereyi görevi sağ tıklayıp *Düzenle...* seçerek açarsınız. Onaylamak için *Kaydet* seçin.

Tabloda sütunlarla çalışırsınız. Tablo başlığındaki **+** işaretine tıklayın ve *Kısıtlamalar* altında sütunları seçin: *Kısıtlama türü*, *Kısıtlama tarihi* ve *Son tarih*. (Ayrıca *Kesin kısıtlama*, *İkincil kısıtlama türü* ve *İkincil kısıtlama tarihi* de var.) Bir hücreyi düzenlemek için çift tıklayın. Türü bir listeden seçersiniz. Tarihi tirelerle yazarsınız, örneğin 21-06-2027. *Kesin kısıtlama* yalnızca MSO ve MFO için değiştirilebilir.

Görevin bir öncülü varsa, *Şu tarihten önce başlamaz (SNET)* için bir kısayol vardır. *Başlangıç* alanına yeni bir başlangıç tarihi yazmanız yeterlidir (*Özellikler* panelinde, *Görevi düzenle* penceresinde veya tabloda). Ya da Gantt'ta çubuğu taşıyın. Uygulama bunu kendiliğinden bir *Şu tarihten önce başlamaz (SNET)* kısıtlamasına çevirir ve bunu size bildirir.

## Sonucu kontrol etme

- Gantt'ta, çubuğun üzerinde küçük bir elmas vardır. Başlangıç kısıtlamasında elmas başlangıç tarafında, bitiş kısıtlamasında bitiş tarafındadır. SNET ve FNET için mavi, SNLT, FNLT, MSO ve MFO için mor. Kısıtlama ihlal edilirse kırmızıdır. Kesin sabitlemede bir pim vardır. Son tarih, o tarihin üzerinde aşağı yönlü bir oktur: görev zamanında bittiği sürece yeşil, geç kalırsa kırmızı.
- İhlal edilen kısıt veya kaçırılan bir son tarih, *Uyarılar* panelinde (*Planlama › Zamanlama › Uyarılar*) ve durum çubuğunda görünür. Bu durumda görevin ve ondan önceki görevlerin *Toplam bolluk* değeri negatif bolluk gösterir.
- Bir üst sınır (*şu tarihten sonra başlamaz (SNLT)*, *şu tarihten sonra bitmez*) veya bir son tarih için uyarının olmaması, planlamanın bu tarihi tuttuğu anlamına gelir.

## Kısıtlamayı veya son tarihi kaldırma

*Kısıtlama* alanında yeniden *Mümkün olduğunca erken (ASAP)* seçin. Bu, ikincil kısıtlamayı da kaldırır. Son tarihi, üç kutuyu boşaltıp Enter tuşuna basarak kaldırırsınız. Sonra **Hesapla** tuşuna basın.

## Dikkat noktaları ve uygulamanın davranışı

**Bir faza verilen kısıtlama.** Bir faza (özet görev) verilen kısıtlama veya son tarihin etkisi yoktur. Bunu görevin kendisine koyun.

**Zaten başlamış bir görev.** Görevin bir gerçek başlangıcı veya ilerlemesi varsa, gerçek başlangıcını korur. Daha sonraki bir tarihli *Şu tarihten önce başlamaz (SNET)* bunu taşımaz.

**Başka bir kısıtlama varken başlangıç tarihi yazmak.** Görevin bir öncülü varsa ve zaten başka bir kısıtlaması varsa, örneğin *Mümkün olduğunca geç (ALAP)*, uygulama yazdığınız başlangıcı uygulamaz. Bir ileti bu kısıtlamanın adını verir. Başlangıcı taşımak istiyorsanız o kısıtlamayı değiştirin.

**Hafta sonunda bir tarih.** Cumartesi, pazar veya tatil günündeki bir tarih bir iş günü sayılır: bir alt sınır (*Şu tarihten önce başlamaz (SNET)*, *şu tarihten önce bitmez*) bir sonraki iş günü olarak, bir üst sınır (*şu tarihten sonra başlamaz (SNLT)*, *şu tarihten sonra bitmez*) bir önceki iş günü olarak alınır.

**İzin verilmeyen bir ikincil kısıtlama.** Uygulama geçersiz bir birleşimi kırmızıyla işaretler ve nedenini de gösterir, örneğin *Birincil ve ikincil kısıtlama aynı tarafı sınırlayamaz.* İkincil kısıtlamaya ASAP, ALAP, MSO, MFO ve kesin sabitleme ile izin verilmez.

**Bir kesin sabitleme.** Onu ilk kez açtığınızda uygulama, kesin sabitlemenin ilişkileri geçersiz kıldığı konusunda uyarır. Görev o zaman tarihe yerleşir, öncüllerinden önce bile. Bu öncüller negatif bolluk alır.

**Ayarladıktan sonra bir şey değişmedi.** Kısıtlamalar yalnızca **Hesapla** sonrasında çalışır. Bir üst sınırın (*şu tarihten sonra başlamaz (SNLT)*, *şu tarihten sonra bitmez*) çubuklar üzerinde etkisi yoksa bu normaldir: bir üst sınır hiçbir şeyi taşımaz. Tarih tutulmazsa negatif bolluk oluşur.

## Ayrıca bakınız

- [Kısıtlamalar ve son tarihler](docs://uitleg-constraints): her türün ne yaptığı ve kesin sabitleme, negatif bolluk ile son tarihin açıklaması.
- [Kritik yol ve bolluk](docs://uitleg-kritiek-pad): negatif bolluğun kritik yolu nasıl etkilediği.
- [İlişkiler ve gecikme](docs://uitleg-relaties): kısıtlamanın yanında yer aldığı ilişkiler.
- [Bildirimler ve uyarılar](docs://ref-meldingen): ihlal edilen kısıt veya kaçırılan bir son tarih için uyarılar.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): *Demolish existing extension* üzerinde bir izin kısıtlaması *Şu tarihten önce başlamaz (SNET)* (14 Mayıs 2027) ve rahat bir payla tutulan bir son tarih.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): *Contractual project handover* üzerinde bilerek sıkı tutulmuş bir son tarih (15 Temmuz 2027). Hesapladıktan sonra bitiş 17 Ağustos'tadır ve birçok görevin negatif bolluğu vardır.
