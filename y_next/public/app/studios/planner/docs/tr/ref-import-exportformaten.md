# İçe ve dışa aktarma biçimleri

Her dosya biçimi için: dosyayı açıp açamayacağınız, kaydedip dışa aktarıp aktaramayacağınız, neyin birlikte gelip neyin gelmediği ve hangi hesaplama profiliyle açıldığı. Bunun arkasındaki neden ve sayılarla bir örnek, [Dosyalar ve biçimler](docs://uitleg-bestanden) sayfasında.

## Bir bakışta

**Açma** IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` ve `.xer` ile çalışır. Uygulama, başka bir uzantıya sahip dosyayı IFC olarak işler.

**Kaydetme** her zaman IFC yazar. Yalnızca açılmış bir IFC dosyası kayıt hedefi olur. Başka bir biçimden gelen proje, açıldıktan sonra dosyaya sahip değildir. *Kaydet* o zaman IFC dosyasının nereye gideceğini sorar.

**Dışa aktarma** şu biçimler için kullanılabilir: IFC 4x3, MS Project XML, Primavera P6 XML, CSV ve iki ilerleme sayfası (Excel ve CSV). Dışa aktarma projenizi değiştirmez.

**Salt okunur** olanlar `.mpp` ve `.xer` dosyalarıdır. Uygulama bunları açabilir, ama yazamaz.

**PDF** yalnızca bir rapordan çıkar (bkz. [Rapor türleri](docs://ref-rapporttypes)). Uygulama PDF okumaz.

**Nerede.** Açmak için: *Ana sayfa › Dosya › Aç*, *Dosya › Aç* veya Ctrl+O. Dışa aktarmak için: *Ana sayfa › Dosya › Dışa aktar* veya *Dosya › Dışa aktar*. Doldurulmuş bir ilerleme sayfasını *Dosya › İçe aktar* ile içe aktarırsınız. Ayrıca şeritteki *İlerleme* grubunda, *Planlama*, *Tablo* ve *Rapor* sekmelerinde *Bir tablodan ilerlemeyi güncelle* düğmesini kullanabilirsiniz.

**Açılışta hesaplama profili.** Her biçim bir hesaplama profiliyle açılır. Bunun ne olduğu [Hesaplama seçenekleri ve kurallar](docs://ref-rekenopties-en-conventies) sayfasında. `.xer` dosyası *Primavera P6* ile, `.mpp` dosyası *Microsoft Project* ile açılır. CSV, MS Project XML ve P6 XML dosyaları *Open Planner Studio* ile açılır. IFC, dosyada kayıtlı profili kullanır. `.xer` ve `.mpp` için uygulama, projenin bu şekilde hesaplandığını bildirir. Yalnızca IFC hesaplama profilini ve hesaplama seçeneklerini taşır. Hesaplama seçeneklerinden MS Project XML en fazla kritik eşiği yazar. Başka bir biçimin dışa aktarması yeniden açılırsa, *Open Planner Studio* olarak hesaplanır.

## IFC

**Açma** — evet, `.ifc`. Uygulama IFC 4.3 okur. Hesaplama profili: dosyada kayıtlı olan.

**Kaydetme** — evet. Kaydedebilen tek biçim budur. *Kaydet* projenizin tamamını IFC dosyası olarak yazar. Bu dosya kayıt hedefi olur.

**Dışa aktarma** — evet, *IFC 4x3* olarak (*BuildingSMART standardı. BIM modelleriyle 4D bağlantısı*.). Varsayılan ad: proje adı, uzantısı `.ifc`. Projeniz bir kaynak kitaplığına bağlıysa, *Kitaplık dosyasını da kaydet* onay kutusu *Dosya › Dışa aktar* ekranında kartların altındadır. İşaretlenirse uygulama, proje için ayrıca *projectname-bibliotheek.ifc* dosyasının yerini sorar. Onay kutusu, *Ana sayfa* sekmesindeki listede yer almaz.

**Birlikte gelenler** — projeye ait her şey: yapısı, süresi, tarihleri ve ilerlemesi olan görevler; gecikmeli ilişkiler; kısıtlamalar ve son tarihler; takvimler; saat dağılımı dahil kaynaklar ve atamalar; temel planlar; etkinlik kodları ve özel alanlar; notlar; diğer projelere dış ilişkiler; kesintiler; iş kuralları ve görev türleri; durum tarihi, ilerleme modu, hesaplama profili ve hesaplama seçenekleri gibi proje ayarları; bir kaynak kitaplığına bağlantı. `.xer` dosyasından gelen bir projede özgün kaynak dosyası da birlikte gelir. Özel bir görev türü, IFC türü `USERDEFINED` olarak ve adı ObjectType alanında saklanır. Böylece diğer IFC programları görevi normal okur. Uygulama ayrıca türün sabit kimliğini saklar, bu yüzden yeniden adlandırma bağlantıyı bozmaz. Dosyayı başka bir bilgisayarda açan biri için tür orada *Bu projeden* altında görünür, kendi *Görev türlerim* listesinde değil.

**Birlikte gelmeyenler** — ekranı nasıl ayarladığınız (yakınlaştırma, kaydırma konumu, seçili görev, daraltılmış fazlar, seçilen filtre ve gruplama) ve uygulama ayarları ([Ayarlar](docs://ref-instellingen)). *IFC* sekmesi, projenizin IFC metnini gösterir.

## MS Project XML (MSPDI)

**Açma** — evet. Uygulama bir `.xml` dosyasını, MS Project ad alanındaki kök öğe `Project` ile (veya ad alanı olmadan) MS Project XML olarak tanır. Hesaplama profili: *Open Planner Studio*.

**Kaydetme** — hayır. Böyle bir proje için kayıt hedefi oluşmaz.

**Dışa aktarma** — evet, *MS Project XML* olarak (*Microsoft Project'te açılır. Tam WBS yapısı*.). Varsayılan ad: proje adı, uzantısı `.xml`.

**Birlikte gelenler** — yapısı (düzey ve WBS), süresi, tarihleri ve ilerlemesi olan görevler; gecikmeli ilişkiler, saat cinsinden veya yüzde olarak da; kısıtlamalar, son tarih dahil; takvimler, görev ve kaynak takvimleri dahil; kaynaklar ve atamalar, eğri veya saat dağılımı dahil; durum tarihi; kritik eşik, tam sayı olarak 0 veya daha fazla iş günü ile birlikte *Toplam bolluk ≤ eşik*; bir görevin açıklaması (not olarak); bir görevin iş kuralı (MS Project görev türü olarak); özel bir görev türü, MS Project'in yok sayabileceği serbest bir alanda (`ExtendedAttribute`), uygulama bunu geri okur. Temel planlarınızdan yalnızca etkin olan gelir, temel 0 olarak. Saat cinsindeki bir görev birimini korur. Bir kilometre taşı da türünü korur: başlangıç, bitiş veya otomatik.

**Birlikte gelmeyenler** — notlar (bir görevdeki denetim listesi), diğer projelere dış ilişkiler, etkinlik kodları ve özel alanlar, ikinci bir kısıtlama, *Elle planlandı* işaretlemesi, dengeleme gecikmesi, sıra dışı ilerlemesi olan bir görevin devam ve durdurma noktası, bir MS Project profilinin kuralları *Kalan iş geçen süreden sonra devam eder* ve *Başlamamış görevleri durum tarihine taşıma*, ve diğer hesaplama seçenekleri. Saat dağılımı olmayan kesintili görevler, kesintileri olmadan gelir.

**Yol boyunca değişenler** — *Şu tarihte başlamalı (MSO)* veya *Şu tarihte bitmeli (MFO)* kısıtlaması, *Zorunlu (sabitleme mantığı)* seçeneği olmadan, *Şu tarihten önce başlamaz (SNET)* veya *Şu tarihten önce bitmez (FNET)* olur. Bir hamak, hesaplanan tarihleri olan sıradan bir görev olur.

## MS Project dosyası (`.mpp`)

**Açma** — evet, MS Project 2010 ile 2021 arasındaki sürümlerden. Hesaplama profili: *Microsoft Project*. Uygulama dosyayı yalnızca okur. `.mpp` dosyanızı asla değiştirmez. MS Project 2007 veya daha eski bir dosyayı ve parola korumalı bir dosyayı reddeder. Bu durumda MS Project'in XML dışa aktarmasını gösteren bir ileti verir.

**Kaydetme** — hayır, kayıt hedefi de yoktur. *Kaydet* yeni bir IFC dosyası yazar.

**Dışa aktarma** — hayır.

**Birlikte gelenler** — yapısı, süresi ve kısıtlamaları olan görevler; gecikmeli ilişkiler; takvimler; kaynaklar ve atamalar; ilerleme; MS Project'te kendiniz doldurduğunuz bir WBS kodu. MS Project'in kendi hesapladığı tarihler ve bolluk da okunur, *Kaydedildiği gibi tarihler* görünümü için.

**Birlikte gelmeyenler** — temel planlar, maliyetler ve ücretler, notlar ve MS Project'in özel alanları. Bkz. [MS Project dosyasını (.mpp) açma](docs://howto-mpp-openen).

**Köken ve lisans** — `.mpp` okuyucusu Open Planner Studio için yazıldı. MPXJ'in (`github.com/joniles/mpxj`, Jon Iles ve diğerleri) kaynak kodundan ve yapısal bilgisinden türetildi. MPXJ, LGPL-2.1 altında bir Java kütüphanesidir. Yapı ve alan sabitleri TypeScript'e aktarıldı. Open Planner Studio'nun kendisi LGPL-3.0 altında açık kaynaktır. `.xer` okuyucusu bir türev değildir: orada MPXJ yalnızca bir başvuru kaynağı olarak incelendi.

## Primavera P6 XML

**Açma** — evet. Uygulama bir `.xml` dosyasını, kök öğe `APIBusinessObjects` ile P6 XML olarak tanır. Hesaplama profili: *Open Planner Studio*.

**Kaydetme** — hayır.

**Dışa aktarma** — evet, *Primavera P6 XML* olarak (*Oracle Primavera P6 için*.). Varsayılan ad: proje adı, uzantısı `.xml`. Bu, MS Project XML dışa aktarmasıyla aynı addır. Adları kendiniz farklı verin.

**Birlikte gelenler** — WBS yapısı ve görevler, süre, tarihler ve ilerleme ile; gecikmeli ilişkiler; kısıtlamalar (ikinci bir kısıtlama da, yumuşak kısıtlama olarak); takvimler; kaynaklar ve atamalar; durum tarihi (`DataDate` olarak); kendi alanında özel bir görev türü, `OPS Custom Task Type`. Uygulama bunu geri okur, P6 ise yok sayabilir.

**Birlikte gelmeyenler** — temel planlar ve son tarihler; etkinlik kodları, özel alanlar, notlar ve dış ilişkiler; hesaplama seçenekleri. P6'da yüzde cinsinden gecikme yoktur. Uygulama bunu sabit bir gün sayısına çevirir. Takvim günü cinsinden bir gecikme, çalışma saatlerinde bir gecikme olur: 3 takvim günü, 3 iş günü olur. Bir hamak sıradan bir görev olur. Elle planlanan bir görev, hesaplanan tarihleri olan sıradan bir görev olur. Bir günden kısa bir dengeleme gecikmesi düşer.

## Primavera dosyası (`.xer`)

**Açma** — evet. Hesaplama profili: *Primavera P6*. Uygulama dosyayı yalnızca okur. `.xer` yazmaz ve dosyanızı asla değiştirmez. Görevleri olan her proje için bir sekme açar. Görevi olmayan veya bozuk tablolar içeren bir dosyayı bir iletiyle reddeder.

**Kaydetme** — hayır, kayıt hedefi de yoktur. *Kaydet* yeni bir IFC dosyası yazar. Bu dosyanın içinde özgün `.xer` bulunur.

**Dışa aktarma** — hayır. Bir `.xer` projesini CSV, MS Project XML veya P6 XML olarak dışa aktarırsanız, uygulama XER kaynak bilgisinin kaybolduğunu bildirir. Bu, projeyi arada IFC olarak kaydetmiş olsanız bile geçerlidir. IFC'ye hiçbir şey kaybolmaz.

**Birlikte gelenler** — WBS yapısı ve görevler, süre, tarihler, kısıtlamalar ve ilerleme ile; gecikmeli ilişkiler; takvimler; atamalı kaynaklar; etkinlik kodları; özel alanlar (UDF); notlar; P6'nın planlama ayarları. *Çaba düzeyi* türündeki bir görev bir hamak olur. Bir temel plan projesi, ona başvuran projenin etkin temel planı olur. Uygulama, iki proje arasındaki bir ilişkiyi kaynak verisi olarak tutar.

**Birlikte gelmeyenler** — görevi olmayan bir proje ve planınızda gerçek bir ilişki olarak iki proje arasındaki bir ilişki. Bkz. [Primavera P6 dosyasını (.xer) açma](docs://howto-xer-openen).

## CSV

**Açma** — evet. Uygulama `;` ve `,` ayırıcı olarak okur. İngilizce ve Hollandaca sütun başlıklarını tanır (örneğin `Name` veya `Naam`, `Duration` veya `Duur`, `Predecessors` veya `Voorgangers`). Tarihler *yyyy-aa-gg*, *gg-aa-yyyy* veya *gg/aa/yyyy* biçiminde olabilir. Bir öncülü WBS kodu, ilişki türü ve gecikme olarak yazarsınız, örneğin `1.2FS+2d`. Hesaplama profili: *Open Planner Studio*. Proje adı *CSV Import* olur. Sabit kodlardan hiçbiri olmayan bir `Task Type` (uygulamanın kendisinin yazdığı `CONSTRUCTION` veya `INSTALLATION` gibi), *Bu projeden* altında bir özel görev türü olur, *Görev türlerim* içinde değil. `OPS Custom Task Type ID` ile bir özel türün kimliği korunur.

**Kaydetme** — hayır.

**Dışa aktarma** — evet, *CSV (;)* olarak (*Evrensel tablo dışa aktarımı. Tarihler ve sürelerle birlikte tüm görevler*.), *CSV (noktalı virgülle ayrılmış)* kartında. Dosya ayırıcı olarak noktalı virgül kullanır, UTF-8 biçiminde ve BOM işaretiyle yazılır ve İngilizce sütun başlıkları vardır.

**Birlikte gelenler** — görev başına şu sütunlar: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` ve `Description`. Tamamlanma, tam yüzde olarak yazılır.

**Birlikte gelmeyenler** — kaynaklar, atamalar, takvimler, kısıtlamalar, son tarihler, temel planlar ve durum tarihi. Tarihler *Kaydedildiği gibi tarihler* görünümündeyse, dışa aktarma `Critical` ve `Total Float` alanlarını boş bırakır. Bu durum, kaynak dosyada bu bilgi kaydedilmemiş görevler için geçerlidir.

## İlerleme sayfası (Excel ve CSV)

**Açma** — evet, *Dosya › İçe aktar* (*Bir tablodan ilerlemeyi güncelle*) üzerinden. Ayrıca şeritteki *İlerleme* grubunda, *Planlama*, *Tablo* ve *Rapor* sekmelerinde aynı adı taşıyan düğme ile. Uygulama `.xlsx` ve `.csv` dosyalarını okur, 16 MB'a ve 50.000 satıra kadar. Bu bir projeyi açmaz. Açık projenizin ilerlemesini günceller. Bkz. [Bir elektronik tablodan ilerleme içe aktarma](docs://howto-voortgang-importeren).

**Kaydetme** — hayır.

**Dışa aktarma** — evet, *İlerleme sayfası (Excel)* olarak (listede *İlerleme (Excel)*) ve *İlerleme sayfası (CSV)* olarak (*İlerleme (CSV)*). Varsayılan ad: *projectname-voortgang*. Aynı şerit grubundaki *İlerleme sayfasını dışa aktar* düğmesi, Excel sayfasını tek tıkla oluşturur. Excel sayfasında sabit sütun genişlikleri, kilitli alanlar ve tarih kontrolü vardır. CSV sayfası aynı içeriği düz metin olarak taşır.

**Birlikte gelenler** — `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` ve `Actual Finish` sütunları. Okurken uygulama `Completion (%)`, `Actual Start` ve `Actual Finish` sütunlarını kullanır. `Start` ve `Finish` yalnızca tarih gösterimini tanımak için kullanılır ve planlamanızı değiştirmez. Uygulama satırları `OPS Task ID` ile görevlere bağlar. Bu yoksa, benzersiz bir WBS kodu ile bağlar.

**Birlikte gelmeyenler** — bu sütunların dışında kalan her şey: süre, ilişkiler, kaynaklar ve planlamanızın geri kalanı. Bir özet görev, sayfadan ilerleme almaz.

## PDF

**Açma** — hayır.

**Kaydetme** — hayır.

**Dışa aktarma** — evet, bir rapordan: *Rapor* sekmesinde *PDF dışa aktar* düğmesi. Uygulama bir raporu kendisi yazıcıya göndermez. Kağıda çıkarmanın yolu PDF'dir. İçerik rapor türüne bağlıdır: bkz. [Rapor türleri](docs://ref-rapporttypes) ve [Bir rapor oluşturma ve yazdırma](docs://howto-rapport-maken-en-afdrukken).

## Ayrıca bakınız

- [Dosyalar ve biçimler](docs://uitleg-bestanden): neden IFC kendi biçimdir ve bir dışa aktarmanın neyi kaybettiği, bir örnekle.
- [Dosya açma ve kaydetme](docs://howto-bestand-openen-en-opslaan): adımlar.
- [Dışa aktarma](docs://howto-exporteren): bir biçim seçmek ve dışa aktarmadan sonraki iletiler.
- [Kaydedildiği gibi tarihler](docs://uitleg-datums-zoals-opgeslagen): açılan bir dosyanın neden başka tarihler gösterebildiği.
- [Hesaplama seçenekleri ve kurallar](docs://ref-rekenopties-en-conventies): hesaplama profilleri.
