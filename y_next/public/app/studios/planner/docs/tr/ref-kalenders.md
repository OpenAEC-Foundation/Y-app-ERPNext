# Takvim pencereleri

*Takvimler* penceresi projenin takvim kitaplığını yönetir. Bu pencerede hangi iş günleri, çalışma saatleri ve tatil günleri olduğunu belirlersiniz. Ayrıca hangi takvimin proje takvimi olduğunu seçersiniz. Listenin yanındaki form, *Kaynak takvimi* penceresindeki formla aynıdır. Bu makale her alanın ne yaptığını, varsayılan değerini ve bunu uygulamada nasıl fark edeceğinizi açıklar. Takvim oluşturmayı ve bunu görevlere atamayı [Takvim oluşturma ve atama](docs://howto-kalender-maken-en-toewijzen) bölümünde bulursunuz. Uygulamanın iş günlerini nasıl saydığını [Takvimler ve iş günleri](docs://uitleg-kalenders) bölümünde bulursunuz.

## Nerede bulursunuz

- **Takvimler** — *Planlama › Takvim › Takvim* veya *Ayarlar › Takvim › Takvim*.
- **Görevin takvimi** — *Görevi düzenle* penceresindeki veya *Özellikler* panelindeki *Takvim* alanı. Bkz. [Görev penceresi ve özellikler paneli](docs://ref-taak-eigenschappen).
- **Kaynak takvimi** — *Kaynaklar* paneli, *Takvim* sütunu: bir takvim seçin, yeni bir takvim için *+ Kaynak takvimi* öğesini seçin veya seçilen takvim için kalem simgesine (*Düzenle…*) tıklayın. Bkz. [Kaynak paneli](docs://ref-resourcepaneel).

## Takvimler penceresindeki kitaplık

Solda takvimlerin listesi, sağda seçilen takvimin formu bulunur. Proje takvimi bir yıldızla gösterilir. Geçersiz giriş içeren bir takvimde kırmızı bir üçgen bulunur (*Bu takvim geçersiz giriş içeriyor*).

- **Yeni takvim** (artı simgesi) — uygulamanın varsayılan içeriğiyle *Yeni takvim* adında bir takvim ekler: Pazartesi'den Cuma'ya, 07:00 ile 16:00 arası, net 8 saat. *İnşaat modunu etkinleştir* açıksa (varsayılan), takvime Hollanda tatilleri de girer, inşaat tatili hariç. Bu seçenek kapalıysa tatil listesi boş kalır. Bu tatilleri istemiyorsanız *Tatilleri oluştur…* seçeneğini seçin ve içinde *Tatil yok* seçeneğini seçin. (*Bouwkalender NL* ve *Standaardkalender* adları her dilde Hollandaca kalır.)
- **Kopyala** — seçilen takvimi *{name} (kopya)* adıyla kopyalar.
- **Sil** (çöp kutusu) — seçilen takvimi siler. Bu düğme yalnızca bir takvim kaldığında devre dışıdır. Silinen takvim proje takvimiyse, kalan ilk takvim proje takvimi olur. Takvimi kullanan görevler ve kaynaklar proje takvimine döner.
- **Proje varsayılanı yap** — seçilen takvimi proje takvimi yapar. Zaten proje takvimi olan takvimde *Proje takvimi* yıldızla birlikte görünür. Etkisi: kendi takvimi olmayan her görev bu takvime göre sayılır; kendi takvimi olmayan bir kaynak da öyle. Takvimi kendiniz verdiğiniz bir görev bu takvimini korur.
- **Uygula** — listedeki tüm değişiklikleri tek seferde projeye yazar, planlama yeniden hesaplanır ve pencere kapanır. Toplamda hiçbir şey değişmediyse planlama yeniden hesaplanmaz. Takvimlerden birinde geçersiz giriş varken devre dışıdır. Normal bir metin alanında Enter tuşu aynısını yapar, ama pencere açık kalır.
- **İptal** — pencereyi kapatır ve açtığınızdan beri (veya son Enter tuşundan beri) yaptığınız tüm değişiklikleri atar. Esc tuşu ve çarpı simgesi *İptal* gibi davranır. Pencerenin yanına tıklamak bir şey yapmaz, böylece girişlerinizi kaybetmezsiniz.

Varsayılan olarak bir projede *Bouwkalender NL* takvimi (inşaat modu açık) veya *Standaardkalender* takvimi (inşaat modu kapalı) bulunur. Her ikisinde de Pazartesi'den Cuma'ya 07:00 ile 16:00 arası çalışılır.

## Form

### Temel bilgiler

- **Ad** — listedeki ad ve görevler ile kaynaklar için açılır listelerdeki ad.
- **İş günleri** — *Pzt* ile *Paz* arasında, haftanın her günü için bir düğme. Basılı düğme bir iş günüdür. Sıra, *Hafta başlangıcı* ayarına göre belirlenir (*Ayarlar*, *Planlama* sekmesi). Varsayılan: *Pzt* ile *Cum* arasındaki günler. İki hızlı düğme var: *Pzt–Cum* Pazartesi'den Cuma'ya, 07:00 ile 16:00 arasını ve 8 saati ayarlar. Ayarlı mola, yeniden 12:00'de başlayan 60 dakikalık mola olur. *Sürekli (24/7)* yedi günü, 00:00 ile 24:00 arasını ve 24 saati ayarlar. Etkisi: bir görev yalnızca iş günlerinde çalışır. Uygulama, iş günü olmayan bir takvimi hesaplayamaz (*Takvimde tanımlı iş günü yok*).
- **Başlangıç (saat)** ve **Bitiş (saat)** — iş gününün başlangıcı ve bitişi, HH:MM biçiminde, 24 saatlik gösterimle. Varsayılan: 07:00 ve 16:00. Oklar (veya ok tuşları) 15 dakikalık adımlarla ayarlar. Bitiş 24:00 olabilir, başlangıç bitişten önce olmalıdır. Etkisi: mola ile birlikte günlük net saatleri belirler. Bu alanlar görevlerin gün cinsinden tarihlerinde sayılmaz; saat cinsinden görevlerde ise sayılır. *Saat planlamasını etkinleştir* açıksa ve takvimde haftanın günlerine göre çalışma saatleri varsa, bu alanlar gizlenir. O zaman çalışma saatleri öncelik alır.
- **Mola başlangıcı** ve **Mola süresi (dakika)** — molanın başlangıcı ve uzunluğu, aynı 15 dakikalık adımlarla. Varsayılan: 12:00 ve 60 dakika. Süreyi 0 yaparsanız iş günü kesintisiz olur. Mola tamamen iş günü içinde olmalıdır ve tüm iş gününü kaplayamaz. Etkisi: net saatler bitiş eksi başlangıç eksi moladır. Saat cinsinden bir görevde molada iş yapılmaz. Bu alanlar da *Başlangıç (saat)* ile aynı koşulda gizlenir.
- **Net saat/gün** — alan yalnızca gösterir: bir iş gününün türetilmiş uzunluğu, iki ondalık basamakla, örneğin *8,00 h*. Varsayılan: 8. Etkisi: gün ile saat arasında çevirirken ve saat cinsinden görevlerde bir günün uzunluğu budur. Bkz. [Günler ve saatler](docs://uitleg-dagen-en-uren).

### Çalışma saatleri

Bu bölüm yalnızca *Saat planlamasını etkinleştir* açıkken görünür (*Ayarlar*, *Planlama* sekmesi). Burada haftanın günlerine göre çalışma saatlerini ve vardiyaları ayarlarsınız. Bkz. [Çalışma saatlerini ayarlama](docs://howto-werktijden-instellen).

- **Ön ayarlar** — çalışma saatlerini tek seferde ayarlayan düğmeler: *Gündüz vardiyası* (Pzt–Cum 08:00 ile 16:00, olağan bir gündüz takvimi), *2 vardiya* (Pzt–Cum 06:00 ile 22:00, 16 saat), *3 vardiya* (Pzt–Cum 06:00 ile sonraki gün 06:00, 24 saat), *Gece vardiyası* (Pzt–Cum 22:00 ile 06:00, 8 saat) ve *24/7* (tüm günler 00:00 ile 24:00). Yerleşik düğmelerin arkasında kendi ön ayarlarınız bulunur. Her birinde silmek için bir çarpı vardır.
- **Ön ayar olarak kaydet…** — geçerli çalışma saatlerini bu cihazda kendi ön ayarınız olarak kaydeder. Böylece bunları her projede yeniden kullanabilirsiniz. Bir ad verirsiniz (*Ön ayar adı*) ve *Kaydet* veya *İptal* düğmesine tıklarsınız.
- **Haftanın gününe göre ayarla…** — bir gün takvimini bir saat takvimine çevirir. Geçerli saatler her iş gününün çalışma saati bantları olur; mola bir boşluk olarak kalır. Saat takvimi için düğmenin adı *Çalışma saatlerini gizle* veya *Çalışma saatlerini göster* olur ve düzenleyiciyi daraltır veya genişletir. Saat takvimi için düzenleyici varsayılan olarak açıktır.
- **Düzenleyici** — haftanın her günü için başlangıç ve bitiş saati olan bantların bir listesi (*bant*). Onay kutusu *sonraki gün* bir bandın gece yarısını aşmasına izin verir (bir gece vardiyası). *Bant ekle* (artı simgesi) 08:00 ile 16:00 arasında bir bant ekler. *Tüm iş günlerine kopyala* (yalnızca *Pzt–Cum* için) o günün bantlarını Pazartesi'den Cuma'ya kopyalar. Bandı olmayan bir gün *Çalışılmayan* olarak adlandırılır. En altta *Türetilmiş saat/gün:* bulunur. Bir gün birden fazla banda sahip olduğunda şu ipucu görünür: *İki bant arasındaki boşluk bir moladır — saatleri gerektiği gibi ayarlayın.* Etkisi: bantlar öncelik alır. Bantları olan bir gün iş günüdür; *Başlangıç (saat)*, *Bitiş (saat)* ve mola alanları gizlenir.

### Tatiller

- **Tatilleri oluştur…** — oluşturucuyu açar. *Ülke* şunlardan birini seçer: *Hollanda*, *Almanya*, *Belçika*, *Fransa*, *Birleşik Krallık*, *Avusturya*, *İsviçre* veya *Tatil yok*. *Bölge* yalnızca ülkenin bölgeleri varsa görünür; varsayılan *Ulusal*. *İnşaat tatili* yalnızca Hollanda için ve *İnşaat modunu etkinleştir* açıkken görünür. Seçenekler şunlardır: *Yok* (varsayılan), *Kuzey*, *Orta* ve *Güney*. İpucu: *Bilgilendirme amaçlı tarihler — Bouwend Nederland ile doğrulayın*. Bir önizleme satırı kaç tatilin geleceğini gösterir (*… tatil, …–…*). Liste için genişletilebilir. *Oluştur* sonucu düzenlediğiniz takvime koyar; yalnızca *Uygula* düğmesinden sonra geçerli olur. *İptal* oluşturucuyu kapatır. Etkisi: tüm *Tatiller* listesi değiştirilir, kendiniz eklediğiniz satırlar dahil. Oluşturucunun kapsadığı yıllar, proje başlangıcından önceki yıldan proje bitişinden sonraki yıla kadardır (proje bitişi yoksa: başlangıçtan üç yıl sonrasına kadar). Bkz. [Tatilleri ve inşaat tatilini oluşturma](docs://howto-feestdagen-genereren).
- **Yeniden oluştur** — düğmenin yanında görünür. Oluşturulan tatiller artık proje dönemini kapsamadığında şu metinle: *Tatiller …–… aralığını kapsıyor; proje … yılına kadar sürüyor. Yeniden oluşturulsun mu?* Bir tıklama, aynı seçimi (ülke, bölge, inşaat tatili) yeni dönem için yeniden oluşturur. Bu düğme olmadan, oluşturulan yılların dışındaki günler olağan iş günleridir.
- **Tatiller** — tatil günlerinin listesi: *Açıklama*, *Başlangıç* ve *Bitiş*, her satırda bir çöp kutusu. *Tatil ekle* bugünü *Başlangıç* olarak alan bir satır ekler; *Bitiş* boş kalır. Boş *Bitiş* bir gündür. Satır yoksa *Henüz tatil yok.* yazar. Etkisi: dönemdeki tüm günler bu takvimde çalışılmayan günlerdir. Bu, bu takvimdeki görevler ve bu takvimi kullanan kaynaklar için geçerlidir. Geçersiz bir satırın kenarı kırmızı olur ve bir metin görünür (*Geçerli bir başlangıç tarihi girin.*, *Geçerli bir bitiş tarihi girin veya tek bir gün için boş bırakın.* veya *Bitiş tarihi başlangıç tarihinden önce.*). Geçersiz satır *Uygula* düğmesini engeller.

### Hata iletileri ve istisnalar

Çalışma saatlerindeki hatalar alanların altında görünür ve *Uygula* düğmesini engeller: *HH:MM biçiminde geçerli bir başlangıç saati girin.*, *HH:MM biçiminde geçerli bir bitiş saati girin.*, *Başlangıç saati bitiş saatinden önce olmalıdır.*, *HH:MM biçiminde geçerli bir mola saati girin.*, *Süre 0 veya daha büyük tam dakika olmalıdır.*, *Mola çalışma günü içinde olmalıdır.* ve *Mola tüm çalışma gününü kaplayamaz.*

Takvim tatil günlerini yalnızca bir istisna olarak bilir. Bir MS Project veya Primavera dosyasından gelen takvimde ek bir iş günü gibi çalışma istisnaları da olabilir. Pencere bunları göstermez veya düzenlemez.

## Kaynak takvimi penceresi

- **Kaynak takvimi** — yukarıdaki form, yalnızca *Uygula* ve *İptal* bulunan bir pencerede. Esc tuşu ve çarpı *İptal* gibi davranır. Pencerenin yanına tıklamak bir şey yapmaz ve burada Enter tuşu da bir şey yapmaz. Bu pencerede tek bir takvimi düzenlersiniz: mevcut bir takvimi veya varsayılan adı *Kaynak takvimi* olan yeni bir takvimi. *Uygula* düğmesinden sonra takvim kaynağa bağlanır (*İptal* hiçbir şey bırakmaz). Bunu kaynak panelinin *Kitaplık* görünümünde açarsanız, kaynak kitaplığındaki bir takvimi düzenlersiniz. *Proje* görünümünde ise projenin takvimini düzenlersiniz, takvim kaynak kitaplığından gelmiş olsa bile. Etkisi: kaynak takvimi, kaynağın histogramda, aşırı atanmışlık ve dengelemede ne zaman uygun olduğunu belirler. Bir görevin tarihlerini değiştirmez. *Uygula* yeniden hesaplamaz. Takvim aynı zamanda görevlerde kullanılıyorsa veya proje takvimiyse, planlama değişir. O zaman güncel olmadığı işaretlenir ve *Hesapla* ile yeniden hesaplanır. Bkz. [Kaynak takvimi ayarlama](docs://howto-resourcekalender-instellen).
