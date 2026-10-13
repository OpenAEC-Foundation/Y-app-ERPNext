# Başka bir projeye dış ilişkiler

Amaç: bu projedeki bir görev ile başka bir proje dosyasındaki bir görev arasında ilişki oluşturmak. Böylece planlamanız, başka yerde planlanan işi de hesaba katar.

## Ne zaman buna ihtiyacınız olur

Ek yapınız, şantiye inşaata hazır hale getirilene kadar başlayamaz. Bu iş yüklenicinin projesindedir. Ya da montajcı, yapınızın kaba yapısı bitene kadar başlayamaz ve kendi dosyasında planlama yapar. Normal bir ilişki yalnızca aynı projedeki görevler arasında çalışır. Bir **dış ilişki** ise bir görevi başka bir dosyadaki bir göreve bağlar.

Dış ilişki, diğer projeyle canlı hesaplama yapmaz. Uygulama sabit bir **bağlantı noktası tarihi** saklar. Bu, bağladığınız andaki dış görevin tarihidir. Hesaplama bu tarihi bir sınır olarak kullanır. Diğer proje değişirse, siz bağlantı noktasını yenileyene kadar sizin projenizde hiçbir şey kaymaz.

## Adımlar

1. Bu projede tam olarak bir görev seçin: dış göreve bağlı olan görevi ya da dış görevin bağlı olduğu görevi.
2. *Ana sayfa › Görevler › Bağlantı ▾ › Dış ilişki ekle…* öğesini seçin. Aynı menü *Planlama › İlişkiler* ve *Tablo › Görevler* altında da bulunur. Bu öğe yalnızca tam olarak bir görev seçiliyse kullanılabilir.
3. *Dış (projeler arası) bağlantı* penceresinde iki yoldan birini seçin. *Kaynak dosya* ile *Son kullanılan bir dosya seç* altından proje dosyasını seçersiniz, ardından *Kaynak görev* seçersiniz. Uygulama dosyayı salt okunur olarak okur, belge olarak açmaz ve bağlantı noktası tarihini kendisi alır. Bu yol yalnızca masaüstü uygulamasında ve yalnızca son kullanılan dosyalar listesindeki bir dosya için çalışır. Aksi halde *Kaynak dosya* düğmesi devre dışıdır. *Manuel (yedek)* ile dış görevin *Proje kimliği* ve *Görev kimliği* alanlarını doldurursunuz. İsteğe bağlı olarak *Görev adı (isteğe bağlı)* alanını ve *Bağlantı noktası tarihi* alanını da doldurabilirsiniz. Tarayıcı sürümünde bu tek yoldur.
4. *Yön* altında dış görevin öncülünüz mü yoksa ardılınız mı olduğunu seçin: *Öncül (dış → ben)* veya *Ardıl (ben → dış)*.
5. *İlişki türü* alanında FS, SS, FF veya SF seçin. Gerekirse *Gecikme (iş günü)* alanını doldurun, örneğin `0d` veya `2d`.
6. *Bağlantı ekle* düğmesine tıklayın ve **hesapla** (F5) tuşuna basın.

Manuel bir bağlantıda bağlantı noktası olarak hangi tarihi gireceğiniz, yöne ve türe bağlıdır:

- Dış **öncül** ile türün ilk harfi önemlidir. F, dış görevin bitiş tarihidir. S, başlangıç tarihidir. FS ve FF ile bu nedenle bitişi, SS ve SF ile başlangıcı girersiniz.
- Dış **ardıl** ile türün ikinci harfi önemlidir. S, dış görevin başlangıç tarihidir. F, bitiş tarihidir. FS ve SS ile bu nedenle başlangıcı, FF ve SF ile bitişi girersiniz.

Saat cinsinden planlıyorsanız (saat planlaması açık ve görev çalışma saatleri olan bir takvimde), *Bağlantı noktası tarihi* alanı ayrıca bir saat ister.

Örnek: şantiye projesi 18 Haziran 2027 Cuma günü biter. *Groundwork* görevini dış öncül ve FS türüyle bağlarsınız. Bağlantı noktası tarihi 18 Haziran 2027 olur. Komut **hesapla** çalıştırıldıktan sonra *Groundwork* 21 Haziran Pazartesi günü başlar. Bu, bağlantı noktasından sonraki ilk iş günüdür. Dış ardıl ise ters yönde çalışır: görevinizin en geç ne zaman bitebileceğini sınırlar.

## Ne görürsünüz ve nasıl yönetirsiniz

- Dış ilişkiler, görev tablosunun *Öncüller* ve *Ardıllar* sütunlarında metin olarak görünür. Bunları tablo başlığındaki **+** ile, *İlişkiler* altından ekleyin. Metinde projenin adı, görev ve tür yer alır. *Kaynak eksik* yazılı küçük bir üçgen, kaynağın okunmadığını gösterir. Proje bilgisini görmek için farenizi bağlantının üzerinde tutun. *Proje kimliği* satırı, ad bilinir bilinmez proje adını gösterir. Ayrıca görev kimliği, bağlantı noktası tarihi ve kaynak durumu görünür.
- Gantt grafiğinde göreve ait soluk gri bir çubuk vardır. Öncül ile bu çubuk bağlantı noktasında biter. Ardıl ile bu çubuk bağlantı noktasında başlar. Kırmızı *eski* etiketi olan kesikli bir kenarlık, kaynağın okunmadığı anlamına gelir. Manuel bağlantıda bu her zaman geçerlidir.
- Sütundaki bir bağlantıya sağ tıklayın ve *Dış ilişkiyi düzenle…* ya da *İlişkiyi sil* seçin. Bağlantının bir kaynak dosyası varsa, *Kaynağı yenile* seçeneği de orada bulunur.
- Kaynak dosyaları yeniden okuyup bağlantı noktalarını güncellemek için *Bağlantı ▾ › Tüm dış ilişkileri yenile* seçin. Bu yalnızca masaüstü uygulamasında çalışır. Yalnızca manuel bağlantılarınız varsa, uygulama *Yenilenebilir dış kaynak yok (dosya yolu eksik).* mesajını gösterir. Yenilemeden sonra **hesapla** komutunu çalıştırın.
- Türü veya yönü değiştirirseniz ve bağlantı noktası dış görevin diğer tarafını gerektirirse (bitiş yerine başlangıç, ya da tersi), manuel bağlantıda uygulama yeni bir bağlantı noktası sorar: *Yeni bir bağlantı noktası seçin: ilişki türü artık kaynak görevin diğer tarafını kullanıyor.* Kaynak dosyası olan bir bağlantıda uygulama bağlantı noktasını kendisi yeniden okur.

## Dikkat edilmesi gerekenler ve uygulamanın davranışı

**Diğer proje birlikte kaymaz.** Dış görevin tarihi değişirse, planlamanız siz bağlantı noktasını yenileyene ya da değiştirene kadar eski bağlantı noktasıyla hesaplamaya devam eder. Manuel yolda bağlantı noktası tarihini kendiniz değiştirirsiniz: bağlantıya sağ tıklayın ve *Dış ilişkiyi düzenle…* seçin.

**Dış öncül bir alt sınırdır.** Görevinizin kendi öncülleri yüzünden bağlantı noktasının istediğinden geç başlaması gerekiyorsa, o ilişki belirleyici olur. Bağlantı noktası yalnızca ileri iter.

**Dış ardıl bir üst sınırdır.** Bağlantı noktası çok sıkıysa, bunu görevinizde ve ondan önceki görevlerde negatif bolluk olarak görürsünüz. Bunun için ayrı bir uyarı çıkmaz. Bu yüzden *Toplam bolluk* sütununu izleyin.

**Yalnızca sabit gecikme.** Dış ilişkide takvim günü veya yüzde cinsinden gecikme veremezsiniz. Uygulama *Dış ilişkiler yalnızca iş günü veya iş saati cinsinden sabit gecikmeyi destekler.* mesajını gösterir. İş günleri, kendi görevinizin takvimine göre sayılır. Saat cinsinden gecikme yalnızca saat cinsinden planlanan bir görev için sayılır. Gün cinsinden planlanan bir görevde hesaplama bunu yok sayar. Bu durumda iş günü kullanın.

**Başka bir dosyanın proje kimliği.** Proje kimliği bir alanda veya sütunda yer almaz. Bu bilgi o projenin IFC dosyasında `InternalProjectId` olarak saklanır: projeyi açın, *IFC* sekmesine gidin ve *IFC Oluştur* seçin. Hesaplama yalnızca bağlantı noktası tarihini kullanır. Kimlik yalnızca bir etiket değildir. Yenilerken uygulama bir kaynak dosyayı önce proje kimliğiyle tanır, daha sonra dosya yoluyla. Manuel bağlantıda, bir kaynak dosyanınkiyle aynı kimliği girerseniz, o dosya yenilendiğinde bağlantı da birlikte güncellenir. Diğer projedeki bir görevin *Görev kimliği* değerini o projenin tablosunda, *Teknik* altındaki *Görev kimliği* sütununda bulursunuz.

## Ayrıca bakın

- [İlişkiler ve gecikme](docs://uitleg-relaties): uygulamanın bir ilişkiyi ve gecikmeyi nasıl hesapladığı.
- [İlişki ekleme](docs://howto-relaties-leggen): aynı projedeki görevler arasındaki ilişkiler.
- [Kısıtlamalar ve son tarihler](docs://uitleg-constraints): bir görevdeki tarih sınırları, başka bir proje olmadan.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): *Car park paving* görevinde bir dış ilişki içerir (dış öncül).
