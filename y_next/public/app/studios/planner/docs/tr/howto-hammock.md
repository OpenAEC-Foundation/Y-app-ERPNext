# Hamak oluşturma

Hedef: kendi süresini bilmeyen, ancak bir görevin başlangıcından bir başka görevin bitişine kadar süren bir görev oluşturmak. Örneğin saha kurulumu, denetim veya bir şantiye barakasının kiralanması.

## Ne zaman gerekir

Şantiye barakası, binanın yapımı sürdüğü müddetçe, ilk temel kazısından teslime kadar orada durur. Bu göreve 13 iş günü sabit süre verirseniz, tuğla örme işi gecikince o da onunla birlikte kaymaz ve planlama artık doğru olmaz. Bir **hamak** (*çaba düzeyi* olarak da adlandırılır) kendisinin bağlandığı görevi takip eder: başlangıcı bir başlangıç ilişkisinden, bitişi bir bitiş ilişkisinden gelir ve süresi ikisi arasındaki farktır.

## Adımlar

1. Görevi oluşturun, örneğin *Site cabin*, veya mevcut bir görevi seçin. Bir kilometre taşı ve bir özet görev (faz) hamak olamaz. Bu tür bir görev için *Özellikler* bölmesinde ve *Görevi düzenle* penceresinde onay kutusu yoktur. Tablo sütununda da bu değer değiştirilemez.
2. *Hamak (türetilmiş süre)* onay kutusunu işaretleyin. Bunu *Özellikler* bölmesinde, *Görevi düzenle* penceresinde (göreve sağ tıklayın, *Düzenle...*) veya *Planlama* altındaki *Hamak (türetilmiş süre)* tablo sütununda yapabilirsiniz. Bundan sonra *Süre* alanı artık düzenlenemez.
3. Hamağın başladığı görevden hamağa bir ilişki ekleyin. Tür **SS** (hamak o görevle birlikte başlar) veya **FS** (hamak o görevden sonra başlar) olsun. Bunun için hamağı seçin, *İlişkiler* bölümünde *İlişki ekle* düğmesini tıklayın, yönü *Öncül* olarak bırakın, görevi seçin ve türü seçin. Adımlar [İlişki ekleme](docs://howto-relaties-leggen) bölümünde de yer alır.
4. Hamağın bittiği görevden hamağa bir ilişki ekleyin. Tür **FF** (hamak o görevle birlikte biter) veya **SF**.
5. *Özellikler* bölmesinde, *Hamak (türetilmiş süre)* altına bakın: orada *Başlangıç driver'ı* ile görevi ve türünü, *Bitiş driver'ı* ile görevi ve türünü görürsünüz. Bir driver, hamağın başlangıcını veya bitişini aldığı görevdir.
6. Örneğin *Ana sayfa › Zamanlama › Hesapla* yoluyla **Hesapla** (F5) seçeneğine basın. Hamak artık başlangıç driver'ının başlangıcından bitiş driver'ının bitişine kadar uzanır ve *Süre* türetilmiş süreyi gösterir.

Gantt'ta hamak, iki ucunda kancası olan ince, turkuaz bir çubuktur.

Örnek: *Site cabin* görevi, *Groundwork* görevinden (Pazartesi 7 Haziran 2027) SS ve *Roofing* görevinden (Çarşamba 23 Haziran'da biter) FF alır. **Hesapla** komutundan sonra hamak Pazartesi 7 Haziran ile Çarşamba 23 Haziran arasında uzanır: 13 iş günü. Tuğla örme işi 2 iş günü gecikirse, *Roofing* bitişi Cuma 25 Haziran olur ve hamak 15 iş gününe kadar uzar.

## Uygulama hamakla ne yapar

- Hamak asla kritik değildir ve bolluğu yoktur. Başlangıcını ve bitişini aldığı görevleri de kısıtlamaz; bu görevler hamak yüzünden geç tarih almaz.
- Gecikme de hesaba girer. SS ve gecikme `1d` ile hamak, başlangıç driver'ından bir iş günü sonra başlar; FF ve gecikme `2d` ile ise bitiş driver'ından iki iş günü sonra biter.

## Dikkat edilecek noktalar ve uygulamanın davranışı

**Bitiş driver'ı yok.** Hamakta FF veya SF ilişkisi yoksa, uygulama bitişi türetemez. *Özellikler* bölmesi *Bitiş driver'ı yok (FF/SF) — aralık sıfır uzunluğa döner.* ifadesini gösterir. *Uyarılar* bölmesi *Bitiş driver'ı olmayan hamak (FF/SF öncülü yok): süresi sıfıra düşüyor* ifadesini gösterir. Hamak o zaman aynı günde başlar ve biter. Bir FF veya SF ilişkisi ekleyin.

**Son görevden sonra biten hamak.** Hamak son görevden sonraya kadar devam ederse, örneğin FF ve 2 iş günü gecikmeyle, projenin bitiş tarihi de onunla birlikte kayar. Gerçekte yapacağınız görevler o zaman bolluk alır; artık hiçbiri kritik değildir.

**Hamağı bekleyen görevler.** Hamaktan başka bir göreve bir ilişki eklerseniz, o görev ancak hamağın bitişinden sonra başlar. Hamaktan önceki tüm zincir, hamağın başlangıcını ve bitişini aldığı görevler dahil, o zaman bolluk alır ve artık kritik değildir; çünkü hamak geriye baskı uygulamaz. Bu yüzden görevlerin hamağı beklemesine izin vermeyin. Bunun yerine böyle görevleri hamağın bitiş driver'ına bağlayın.

**Süre girmek.** Bir hamağın *Süre* alanı türetilir ve düzenlenemez. Onay kutusunu işaretlemeden önce girdiğiniz bir süre artık dikkate alınmaz.

## Ayrıca bakın

- [İlişki ekleme](docs://howto-relaties-leggen): SS veya FF türünde bir ilişki eklemenin adımları.
- [İlişkiler ve gecikme](docs://uitleg-relaties): SS ve FF'in ne anlama geldiği ve gecikmenin nasıl hesaba girdiği.
- [Kritik yol ve bolluk](docs://uitleg-kritiek-pad): kritik ifadesinin anlamı ve bolluğun nasıl çalıştığı.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): bu projede *Structural works tower A (LOE)* adlı hamak bulunur.
