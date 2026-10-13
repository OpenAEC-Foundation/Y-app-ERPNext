# Kaydedilen tarihler

Primavera veya MS Project’ten bir planlama açarsınız. Tarihler, o pakette gördüğünüz tarihlerden farklıdır. İçe aktarma mı yanlış gitti? Genellikle hayır. Bu makalede neden uygulamanın kendiliğinden yeniden hesapladığını okursunuz. Ayrıca dosyadaki tarihleri ne zaman gösterdiğini, o durumda neyin boş kaldığını ve kendi hesaplamasına nasıl döneceğinizi okursunuz. Sondaki örnek iki görevi tüm süreç boyunca izler.

## Kavram

Bir planlama dosyası iki tür veri içerir. Birincisi mantık: görevler, süreler, ilişkiler, takvimler ve kısıtlamalar. İkincisi, diğer paketin bu mantıktan hesapladığı tarihler. Açılırken Open Planner Studio bu mantığı kullanır ve kendi hesabını yapar. Yani dosyadaki tarihler girdi değildir.

Uygulamanın kendi hesabı, dosyanın belirttiğinden farklı tarihlere varırsa hangi tarafın doğru olduğunu bilmezsiniz. Dosyada, paketin kullandığı bir mantık eksik olabilir. Paket de bazı noktalarda uygulamadan farklı hesaplayabilir. Bu yüzden uygulama tarihleri **kaydedildiği şekilde** gösterebilir: diğer paketin dosyaya yazdığı tarihleri. Böylece o paketteki gördüklerinizle karşılaştırırsınız.

## Uygulama bununla nasıl başa çıkar

### Hangi hesaplama profilini uygulama kullanır

Uygulama bir **hesaplama profili** ile hesaplar. Bu profil, hesaplama kurallarının bir kümesidir. Kurallar, örneğin bir görevin planlanmış başlangıcını ve kısıtlamaları nasıl ele alacağını belirler. Bkz. [Hesaplama profilleri ve kurallar](docs://uitleg-rekenprofielen). Üç yerleşik profil vardır: *Primavera P6*, *Microsoft Project* ve *Open Planner Studio*. Bir `.xer` dosyası *Primavera P6* ile, bir `.mpp` dosyası *Microsoft Project* ile açılır. CSV, MS Project XML ve Primavera P6 XML, *Open Planner Studio* ile açılır. Bir projenin profili, *Dosya › Proje bilgisi* altında, *Hesaplama profili ve seçenekleri* bölümünde yer alır. Uygulamadan gelen bir IFC dosyası profilini korur.

### Ne zaman karşılaştırır uygulama

Açılırken uygulama dosyanın ne dediğini kaydeder ve bunu kendi sonucuyla karşılaştırır. Bunu şunlar için yapar:

- bir Primavera dosyası (`.xer`) ve Primavera P6 XML;
- MS Project XML ve MS Project dosyaları (`.mpp`);
- başka bir programdan gelen bir IFC dosyası, erken tarihleri dosyada bulunan görevler için;
- uygulamanın kendisinden gelen ve kökenini hatırlayan bir IFC dosyası. Aşağıda bunun ne zaman olduğunu okursunuz.

Uygulama bir CSV dosyasını asla karşılaştırmaz. CSV’deki başlangıç tarihi bir girdidir, bir hesaplamanın sonucu değildir. Uygulamanın kendisinden gelen ama kökenini hatırlamayan bir IFC dosyası da karşılaştırılmaz.

Hiçbir görev farklı değilse bir şey fark etmezsiniz. Şu anda içe aktardığınız bir dosyada en az bir görev farklıysa, uygulama görünümü hemen açar.

Bir Primavera dosyası ile uygulama *Primavera P6* hesaplama profilini kullanarak hesaplar. Bu profil, dosyadaki planlanmış başlangıcı erken başlangıç olarak tutar. Dosyada bir görev, ilişkilerin gerektirdiğinden daha geç bir tarihtedir ama orada ayrıca planlanmıştır. Bu görev bu yüzden olduğu yerde kalır. O zaman fark yoktur.

### Ne görürsünüz

Şeridin altında bir bilgi çubuğu vardır: *Tarihleri dosyada kaydedildiği şekilde görüntülüyorsunuz; yeniden hesaplama 4 görevi kaydırır.* Bir Primavera kaynağında (bir `.xer` veya Primavera P6 XML) çubuk şunu yazar: *Planı Primavera’nın kaydettiği şekilde görüntülüyorsunuz; yeniden hesaplama 1 görevi kaydırır.* Çubuğun sağında *Yeniden hesapla* düğmesi vardır. Bilgi çubuğunda çarpı yoktur.

Ayrıca bir mesaj vardır: *4 görev, dosyada kayıtlı tarihleri gösteriyor (yeniden hesaplanmadı).* Yalnızca bir `.xer` dosyasında şu yazar: *1 görev, Primavera’nın kaydettiği tarihleri gösteriyor (yeniden hesaplanmadı).* Dosyada tarih kaydedilmiş her görev, *Özellikler* panelinde bir işaret gösterir: Primavera kaynağında *Bu görev için Primavera’nın kaydettiği kendi tarihlerini gösterir*, diğer kaynaklarda *Bu görev için dosyada kayıtlı tarihleri gösterir*. Gantt, görev tablosu ve durum çubuğu dosyadaki tarihleri gösterir.

### Bu görünümde neler boş kalır

Bu görünümde uygulama hiçbir şey hesaplamaz. Yalnızca dosyanın kaydettiğini gösterir. Bu yüzden bolluğu ve kritik yolu yalnızca dosya bunları içeriyorsa görürsünüz. Dosya hiç kritik görev kaydetmediyse, durum çubuğu 0 kritik görev bildirir. Bu, paketin kendi kritik yolu hakkında bir şey söylemez. Bir hesaplamadan çıkan şeyler bu görünümde yoktur: planı yönlendiren ilişkiler, ihlal edilen kısıtlar, sırası dışına çıkan görevler ve kritiğe yakın görevler.

Dosya bir görev için her şeyi kaydetmezse, *Özellikler* panelinde *Kayıt kısmen eksik — geç bitiş/bolluk sütunlarına bakın* işaretini görürsünüz. Bir CSV dışa aktarımında, böyle bir görev için *Kritik* ve *Toplam bolluk* sütunları boş kalır. Uydurulmuş bir sıfır yazılmaz.

### Görünümden çıkmak

Görünümden iki şekilde çıkarsınız:

- Bilgi çubuğundaki *Yeniden hesapla* düğmesine tıklayın veya *Hesapla* (F5) seçin. Uygulama kendi kurallarıyla hesaplar.
- Tarihleri değiştirebilecek bir şeyi değiştirin, bir görevin süresi veya yeni bir görev gibi. Uygulama görünümden çıkar ve hemen yeniden hesaplar, *Otomatik hesapla* kapalı olsa bile. Bir adı değiştirmek bunu yapmaz: görünüm açık kalır.

Kaynak kitaplığından gelen bir takvim değişikliği görünümü açık ve dosyadaki tarihleri olduğu gibi bırakır, ancak bilgi çubuğundaki sayıyı günceller.

Görünümden çıktıktan sonra görünüme geri dönmek için bir düğme yoktur. Ctrl+Z görünümü geri getirir, ama yalnızca hemen yeniden hesaplamadan veya hemen böyle bir düzenlemeden sonra. Aksi halde kaynak dosyayı yeniden açabilirsiniz. Bir `.xer` ile, yeniden hesaplamadan sonra kaydettiğiniz ama düzenlemediğiniz bir IFC dosyasını açmak da görünümü yeniden açar.

### Çökme kurtarma

Görünümde iken bir çökmeden sonra bir projeyi kurtarırsanız, görünüm açık kalır. Etkin olan proje, önceki gibi aynı çubuğu gösterir. Başka bir sekmedeki bir proje, sayısı olmayan bir çubuk gösterir: *Tarihleri dosyada kaydedildiği şekilde görüntülüyorsunuz. Herhangi bir yeniden hesaplama yapılmadı.* Bkz. [Çökmeden sonra kurtarma](docs://howto-herstellen-na-een-crash).

### Kaydetme ve yeniden açma

Görünümü kullanırken kaydederseniz, uygulama gösterilen tarihleri kaynak biçimle birlikte IFC dosyasına yazar. IFC dosyasını daha sonra yeniden açarsanız ve içe aktarmadan beri düzenlemediyseniz, görünüm yeni bir mesaj olmadan yeniden açılır.

Bu arada düzenleyip kaydettiyseniz, sonuç kaynağa bağlıdır. Bir Primavera dosyasında IFC dosyası özgün `.xer` dosyasını yanında tutar. Uygulama o zaman yeniden karşılaştırır ve görünümü önerir: *Yeniden hesaplama, dosyadaki tarihlere göre 2 görevden 1 tanesini kaydırdı.* Buna *Kaydedilen tarihleri göster* düğmesi ve bir çarpı eşlik eder. Her farklı görevde *Özellikler* paneli *Kaydedilen tarihlerden farklılaşıyor* işaretini gösterir. *Kaydedilen tarihleri göster* görünümü açar. Ctrl+Z bunu geri alır. Çarpı teklifi gizler.

MS Project XML, `.mpp`, Primavera P6 XML veya başka bir programdan gelen bir IFC dosyası kaynağı saklamaz. Böyle bir projeyi düzenleyip kaydederseniz, uygulama yeniden açarken artık karşılaştırmaz.

## Uygulamalı örnek: ek bina

Diyelim ki iki görevli bir Primavera dosyası *Uitbouw* (ek bina) açıyorsunuz. Takvimde tatil yoktur. 2027’de 6 Mayıs Göğe Yükseliş Günü, 17 Mayıs Pentikost Pazartesisi’dir: takvimde tatiller olduğunda tarihler farklı çıkar. *Fundering storten* (temel dökmek) 5 iş günü sürer, *Metselwerk* (duvar örgüsü) 10 iş günü. *Metselwerk* görevi, *Fundering storten* görevini bitiş-başlangıç ilişkisiyle izler. Dosya, *Fundering storten* görevinin Pazartesi 3 Mayıs’tan Cuma 7 Mayıs 2027’ye kadar sürdüğünü kaydeder. *Metselwerk* ise Pazartesi 17 Mayıs’tan Cuma 28 Mayıs 2027’ye kadar sürer. Bu, ilişkinin izin verdiği en erken başlangıçtan bir hafta sonradır. Dosyadaki *Metselwerk* görevinin planlanmış başlangıcı Pazartesi 10 Mayıs 2027’dir.

Açar açmaz dosyadaki tarihleri görürsünüz. Durum çubuğu *Bitiş: 28-05-2027* ve *Kritik yol: 2 görev, 20 iş günü* yazar. Çubuk, yeniden hesaplanınca 1 görevin farklı olduğunu bildirir. Her iki görev de *Bu görev için Primavera’nın kaydettiği kendi tarihlerini gösterir* işaretini gösterir.

*Yeniden hesapla* düğmesine tıkladığınızda, *Fundering storten* 3 ile 7 Mayıs’ta kalır. *Metselwerk* artık Pazartesi 10 Mayıs’ta başlar. Bu, *Fundering storten* görevinin bittiği iş gününün ertesi günüdür. Görev Cuma 21 Mayıs’ta biter. Plan 21 Mayıs 2027’de biter ve 20 yerine 15 iş günü sürer. Kritik yol aynı 2 görevden oluşur.

Ya farklı olursa?

- *Metselwerk* dosyada da Pazartesi 17 Mayıs’ta planlıysa, *Primavera P6* hesaplama profili bu başlangıcı korur. Hesap 17 ile 28 Mayıs arasında biter. Fark yoktur ve görünüm açılmaz.
- Görünümde bir görev eklersiniz: aynı yeniden hesaplama. *Metselwerk* 10 ile 21 Mayıs arasına kayar.
- Görünümde kaydedip IFC dosyasını düzenlemeden yeniden açarsanız: *Metselwerk* yine 17 ile 28 Mayıs’tadır.
- Yeniden hesaplarsınız, daha fazla düzenlemeden kaydedersiniz ve IFC dosyasını yeniden açarsınız: görünüm yeniden açıktır ve *Metselwerk* 17 ile 28 Mayıs’tadır.
- Düzenler, kaydeder ve yeniden açarsınız: uygulama görünümü *Yeniden hesaplama, dosyadaki tarihlere göre 2 görevden 1 tanesini kaydırdı.* mesajıyla önerir. *Metselwerk*, *Kaydedilen tarihlerden farklılaşıyor* işaretini gösterir.

## Sonuçlar ve yanlış anlamalar

**Bir fark, bir içe aktarma hatası değildir.** Uygulama kendi kurallarıyla hesaplar: `.xer` ile hesaplama profili *Primavera P6*, `.mpp` ile *Microsoft Project*, CSV, MS Project XML ve Primavera P6 XML ile *Open Planner Studio*. Kaynak pakette tarihlerin neden farklı çıktığı dosyadan ya da paketten kaynaklanabilir. Görünüm size bunların farklı olduğunu gösterir.

**Görünüm bir hesaplama sonucu değildir.** Uygulama tarihleri hesaplamadı. Bunları kendi planlamanızın sonucu gibi doğrudan almayın.

**Görünümde kaydetmek, kaynak paketin tarihlerini korur.** IFC dosyası o zaman uygulamanın hesaplayacağını değil, kaynak paketin söylediğini tutar.

**Düğme *Kaydedilen tarihleri göster* her içe aktarmada görünmez.** Yeni açılan bir dosyada görünüm zaten açıktır. Düğme yalnızca, içe aktarmadan sonra düzenlediğiniz, Primavera kaynaklı ve yeniden açılan bir IFC dosyasında görünür.

## Ayrıca bkz.

- [Dosyalar ve biçimler](docs://uitleg-bestanden): uygulamanın bir dosyada ne sakladığı ve bir içe aktarma veya dışa aktarmanın neyi taşıdığı.
- [Primavera P6 dosyasını açma (.xer)](docs://howto-xer-openen): bir `.xer` dosyası için adımlar ve mesajlar.
- [MS Project dosyasını açma (.mpp)](docs://howto-mpp-openen): bir `.mpp` dosyası için adımlar ve mesajlar.
- [Çökmeden sonra kurtarma](docs://howto-herstellen-na-een-crash): bu projeye bir çökmeden sonra ne olduğu.
- [Kritik yol ve bolluk](docs://uitleg-kritiek-pad): uygulamanın hesapladığında bolluğu ve kritikliği nasıl hesapladığı.
