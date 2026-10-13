# İş kuralları: süre, birim ve iş

Bir sıvacıyı sıva işine koyarsınız ve görev dört gün sürer. Bir ikinci sıvacı eklerseniz iş iki günde bitebilir. Süre dört gün de kalabilir, ama o zaman iki kat iş vardır. Her ikisi de mantıklıdır. Uygulamanın ikisinden hangisini seçeceği, görevin **iş kuralına** bağlıdır. Bu makalede uygulamanın süreyi, birimi ve işi nasıl birbirine bağladığını okursunuz. Ayrıca her iş kuralının neyi sabit tuttuğunu okursunuz.

## Kavram

Üç büyüklük birbirine bağlıdır:

- **Süre**: görevin ne kadar sürdüğü, iş günü veya saat cinsinden.
- **Birim**: bir kaynağın bir iş günü içinde göreve ne kadar çalıştığı. Uygulamada bu *Birim/gün* olarak geçer. Birim 1, bütün gün boyunca bir sıvacı demektir. 2, iki sıvacı demektir. 0,5 ise yarım gün demektir.
- **İş**: kaynağın göreve harcadığı toplam saat.

Toplam şöyledir: iş = süre × birim × iş günü başına saat. İş günü başına saat, görevin takviminden gelir. Bir sıvacıyla dört iş günü süren sıva işi, 8 saatlik iş gününde 4 × 1 × 8 = 32 saat iştir.

Üçünden birini değiştirirseniz, diğer ikisinden en az biri de değişmelidir. Aksi halde toplam artık tutmaz. İş kuralı hangisinin değişeceğini belirler. Bunu görev başına, *Özellikler* panelinde ayarlarsınız. Uygulama iş kuralını ve işi, siz bunları açana kadar göstermez. Bunun nasıl çalıştığı [İş kuralı seçmek](docs://howto-werkregel-kiezen) bölümünde yazar.

Bir iş kuralı yalnızca normal görevlerde çalışır. Kilometre taşlarında, fazlarda (özet görevler), hamaklarda ve *Süre türü* *Geçen süre* olan görevlerde iş kuralı yoktur. Bu durumda *İş kuralı* alanı görünmez. Malzeme, örneğin beton veya sıva harcı, de iş kuralına sahip değildir. Malzeme miktarı hiçbir zaman süreyi belirlemez. Uygulama süreyi bir iş kuralı yüzünden hiçbir zaman ayarlamaz.

## Uygulama nasıl hesaplar

### Kural, değiştirdiğiniz şeye göre işler

Uygulama süreyi, birimi ve işi yeniden hesaplar, ama yalnızca siz birini değiştirdiğinizde. Bu şunlardır: görevin süresi, bir atamanın birimi, iş, bir kaynak eklenmesi veya çıkarılması, ya da bir takvimdeki günlük saatler. **Hesapla** (F5) hiçbirini değiştirmez. F5 yalnızca tarihleri hesaplar. Bir iş kuralı seçmek de hiçbir sayıyı değiştirmez. Kural, bir sonraki değişikliğinizde devreye girer.

Bir iş kuralı görevin süresini değiştirirse, planlama güncel olmaz. Durum çubuğu o zaman *Güncel değil — yeniden hesaplayın (F5)* yazar, *Otomatik hesapla* açık değilse.

### Dört kural

*Özellikler* panelinde, açılır listenin altında, uygulama seçilen kuralın neyi koruduğunu gösterir. Uygulamanın kendi metniyle dört kural:

- **Sabit süre ve birimler** (*Korunan: süre ve birimler (iş izler)*). Bu varsayılandır. Uygulama süreyi hiçbir zaman kendisi değiştirmez. İş, süreden ve birimden çıkar. İşi kendiniz yazarsanız, uygulama birimleri ayarlar, çünkü süre sabittir.
- **Sabit süre ve iş** (*Korunan: süre ve iş (birimler izler)*). Uygulama süreyi kendisi değiştirmez. Süreyi değiştirirseniz iş kalır ve birimler ayarlanır.
- **Sabit iş** (*Korunan: iş (süre birimleri izler)*). İş sabittir. Süre, işten ve birimlerden çıkar.
- **Sabit birimler** (*Korunan: birimler (süre işi izler)*). Birimler sabittir. Süre, işten çıkar.

Yani iki kural süreyi olduğu gibi bırakır. Diğer ikisinde, birimleri, işi veya kaynak sayısını değiştirdiğinizde süre birlikte hareket eder. Tek kaynakla Sabit iş ve Sabit birimler tam olarak aynı şeyi yapar. Süreyi kendiniz değiştirdiğinizde ise farklılaşırlar. Sabit iş kuralında iş kalır ve birimler ayarlanır. Sabit birimler kuralında birimler kalır ve iş birlikte büyür. Görevde birden fazla kaynak olduğunda da farklılaşırlar.

Aşağıdaki işlenmiş örnekler, her kuralın ne yaptığını gösterir.

### Yuvarlama

Toplamdan çıkan süreyi uygulama yukarı yuvarlar. Günlerdeki bir görevin süresi tam iş günlerine yuvarlanır. Saatlerdeki bir görevin süresi tam dakikalara yuvarlanır. İş ve birimler, sizin girdiğiniz veya uygulamanın toplamdan aldığı değerler olarak kalır. Bu yüzden toplam bazen tam tutmaz. Aşağıdaki örnek, o zaman ne olduğunu gösterir.

### Birden fazla kaynak

Bir görevin birden fazla kaynağı varsa, iki kural geçerlidir. Sabit süre ve iş, Sabit iş ve Sabit birimler kurallarında, bir kaynak eklediğinizde veya çıkardığınızda toplam iş aynı kalır. Uygulama onu birimlere orantılı böler. Sabit süre ve birimler kuralında ise yeni bir kaynak bunun yerine kendi işini getirir. Sabit iş ve Sabit birimler kurallarında en yavaş kaynak süreyi belirler: kaynak başına iş birime bölünür ve en büyük sonuç sayılır.

Örnek: iki kaynağın her biri 32 saat işe ve birim 1'e sahiptir. Birlikte 4 iş günüdür. İlkinin birimini 0,5 yaparsınız. Süre o zaman 8 iş günü olur. Sabit iş kuralında ikinci kaynak 32 saat işini tutar ve birimleri 0.5'e düşer. Sabit birimler kuralında ikinci kaynak birim 1'ini tutar ve işi 64 saate çıkar.

### İlerleme

Görevin zaten ilerlemesi varsa, kural kalan kısımla çalışır: kalan süre ve kalan iş. Uygulamada bu iş *İş (kalan)* olarak geçer. Tamamlanan kısım aynı kalır.

### Saat cinsinden görevler

Saat cinsinden planladığınız bir görev aynı şekilde hesaplanır, ama dakikalarla. Yalnızca vinç 5 saatlik bir görevde ise, bu 5 saat iştir. Sabit iş kuralında birim 2 için süre o zaman 2,5 saat olur. Uygulamadaki alıştırma projesinde boşluklu döşemede marangoz ekibi de vardır. Bu döşeme hâlâ 5 saat iş ister. Marangoz ekibi en yavaş olandır ve bu yüzden süre 5 saat kalır. Saat ile gün arasındaki ilişki [Günler ve saatler](docs://uitleg-dagen-en-uren) bölümünde açıklanır.

## Örnek: sıva işi

Örnek, eğitimlerdeki alıştırma projesi *House extension* projesidir. Eğitim 5'te bunu kendiniz çözersiniz ve sayıları kontrol edersiniz. Burada her kuralın ne yaptığını okursunuz.

Sıva işi 4 iş günü sürer. Göreve bir sıvacı atanmıştır, birim 1 ile. İş günü 8 saattir. Dolayısıyla iş 32 saattir.

### Sabit süre ve birimler

- Süreyi 6 iş gününe çıkarırsınız: iş 48 saate büyür, birimler 1 kalır.
- Birimleri 2 yaparsınız: süre 4 iş günü kalır, iş 64 saat olur.
- *İş (kalan)* alanına 48 saat yazarsınız: süre 4 iş günü kalır, birimler 1,5 olur.
- Örneğin *Plasterer 2* adlı ikinci bir kaynağı birim 1 ile atarsınız: süre 4 iş günü kalır ve bu ikincisi 32 saat iş getirir. Birlikte 64 saat.

### Sabit süre ve iş

- Süreyi 6 iş gününe çıkarırsınız: iş 32 saat kalır, birimler 0,67'ye düşer.
- Birimleri 2 yaparsınız: süre 4 iş günü kalır. Süre sabit olduğu için iş 64 saate büyür.
- *İş (kalan)* alanına 16 saat yazarsınız: süre 4 iş günü kalır, birimler 0,5 olur.
- Örneğin *Plasterer 2* adlı ikinci bir kaynağı birim 1 ile atarsınız: 32 saat bölünür, her biri 16 saat. Birimler ikisi için de 0,5 olur. Süre 4 iş günü kalır.

### Sabit iş

- Süreyi 6 iş gününe çıkarırsınız: iş 32 saat kalır, birimler 0,67'ye düşer.
- Birimleri 2 yaparsınız: iş 32 saat kalır ve süre 2 iş gününe düşer. Bu, eğitim 5'te yaptığınız adımdır.
- *İş (kalan)* alanına 48 saat yazarsınız: birimler 1 kalır ve süre 6 iş gününe çıkar.
- Örneğin *Plasterer 2* adlı ikinci bir kaynağı birim 1 ile atarsınız: 32 saat bölünür, her biri 16 saat. Süre 2 iş gününe düşer. Bu ikinci kaynağı tekrar çıkarırsanız, süre yeniden 4 iş günü olur.

### Sabit birimler

- Süreyi 6 iş gününe çıkarırsınız: birimler 1 kalır, iş 48 saate büyür.
- Birimleri 2 yaparsınız: iş 32 saat kalır ve süre 2 iş gününe düşer.
- *İş (kalan)* alanına 48 saat yazarsınız: birimler 1 kalır ve süre 6 iş gününe çıkar.
- Örneğin *Plasterer 2* adlı ikinci bir kaynağı birim 1 ile atarsınız: 32 saat bölünür, her biri 16 saat. Süre 2 iş gününe düşer.

### Toplam tutmadığında

Sabit iş kuralında birimleri 3 yaparsınız. İş 32 saattir, bu yüzden süre 32 ÷ (3 × 8) = 1,33 iş günü olur. Uygulama bunu 2 iş gününe yukarı yuvarlar. İş (32 saat) ve birimler (3) kalır, ama 2 × 3 × 8 = 48 saattir. Histogram bu yüzden 32 saati 2 iş gününe yayar: günde 2 birim, 3 değil. *İş (kalan)* yanında bir uyarı çıkar, *Birim × süreden farklı*, bunu göstermek için.

Farklı birimleri olan iki kaynakta aynısı geçerlidir. Sabit iş kuralında, birim 1 olan sıvacıya birim 2 ile örneğin *Plasterer 2* adlı ikinci bir kaynak eklerseniz, uygulama 32 saati 1 : 2 oranında böler: 10,7 ve 21,3 saat. Her ikisi de 1,33 iş günü ister. Süre 2 iş günü olur.

### Farklı takvim

Sabit iş kuralında takvimin iş günü 8 saatten 6 saate düşer. İş 32 saat kalır. Dolayısıyla süre 32 ÷ 6 = 5,33 olur ve 6 iş gününe yukarı yuvarlanır. Uygulamanın iş günlerini ve çalışma saatlerini nasıl saydığı [Takvimler ve iş günleri](docs://uitleg-kalenders) bölümünde açıklanır. Uygulama şunu bildirir: *Takvim değişikliğinden sonra iş kuralı 1 görevin süresini ayarladı (iş aynı kaldı, günlük saatler değişti).*

### Görev ilerlemesiyle

İç boşluklu duvar tabakası 5 iş günü sürer ve %40 tamamlanmıştır. 2 iş günü tamamlanmış, 3 iş günü (24 saat) kalmıştır. Sabit iş kuralında birimleri 1'den 2'ye çıkarırsınız. Kalan iş 24 saat kalır. Kalan süre 1,5 olur ve 2 iş gününe yukarı yuvarlanır. Görev şimdi 2 + 2 = 4 iş günü sürer ve ilerleme %50'dir. Yüzde birlikte hareket eder, çünkü tamamlanan kısım aynı kalır ve kalan kısım kısalır.

## Sonuçlar ve yanlış anlamalar

**“Sabit iş, süresinin sabit olduğu anlamına gelir.”** Hayır, tam tersi. *Sabit süre ve birimler* ve *Sabit süre ve iş* kurallarında süre sabittir. *Sabit iş* ve *Sabit birimler* kurallarında süre diğer ikisinden çıkar.

**“Bir kural seçersem, planlamam değişir.”** Hayır. Seçim hiçbir sayıyı değiştirmez. Kural, neyin birlikte hareket edeceğine yalnızca bir sonraki değişikliğinizde karar verir. İşi koruyan bir kuralda uygulama işi seçtiğiniz anda sabitler, böylece korunacak bir sayı olur. Böyle bir görevde kayıtlı bir *İş (kalan)* bulunur.

**“Ben dokunmadan süre değişti.”** Bu, *Sabit iş* veya *Sabit birimler* kuralında birimleri, işi, kaynak sayısını veya günlük saatleri değiştirdikten sonra olabilir. Durum çubuğu o zaman planlamanın güncel olmadığını yazar. Yeni tarihleri görmek için **Hesapla** (F5) düğmesine basın.

**Atama olmadan iş kuralı hiçbir şey yapmaz.** O zaman süreye bağlanacak birim ve iş yoktur.

**MS Project veya Primavera P6 dosyaları her zaman iş kuralını gösterir.** MS Project'ten bir görev için kuralın altında bazen *MS Project'ten: çabaya dayalı* veya *MS Project'ten: çabaya dayalı değil* metni çıkar. Bu kayıtlı ayar iki durumu değiştirir. *Sabit süre ve iş* ile çabaya dayalı olduğunda, süreyi değiştirdiğinizde birimler yerine iş birlikte hareket eder. *Sabit birimler* ile çabaya dayalı olmadığında, bir kaynak eklediğinizde veya çıkardığınızda iş birlikte hareket eder ve süre aynı kalır. Uygulamada kendiniz oluşturduğunuz görevlerde bu ayar yoktur.

## Ayrıca bakın

- [İş kuralı seçmek](docs://howto-werkregel-kiezen): bir görevin iş kuralını ayarlamanın adımları.
- [Kaynak atamak (eğri ile)](docs://howto-resource-toewijzen): bir kaynağı bir göreve birim ve dağılımla koymak.
- [Günler ve saatler](docs://uitleg-dagen-en-uren): uygulamanın günleri ve saatleri nasıl dönüştürdüğü.
- [Takvimler ve iş günleri](docs://uitleg-kalenders): uygulamanın iş günlerini ve çalışma saatlerini nasıl saydığı.
