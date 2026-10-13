# Çalışma saatlerini ayarlamak

Amaç: bir takvimin hangi saatlerde çalıştığını haftanın günü bazında kaydetmek. Böylece saatlerle ifade edilen görevler doğru zamanda ilerler.

## Ne zaman gerekir

Cuma öğleden sonra çalışılmaz. Ekip 06:00 ile 22:00 arasında iki vardiyada çalışır. Bir gece ekibi vardır. Mola bir saatten kısadır. Yalnızca günlerle planlıyorsanız *Başlangıç (saat)*, *Bitiş (saat)* ve mola yeterlidir ([Takvim oluşturma ve atama](docs://howto-kalender-maken-en-toewijzen)). Saatlerle görev planlıyorsanız uygulama, takvimin **bantları** içinde çalışma dakikalarını sayar. Uygulamada bu bantlara *bant* denir: bant, bir hafta gününde kesintisiz bir çalışma süresidir; iki bant arasındaki boşluk bir moladır. Bunun planlamanız için ne anlama geldiği, [Günler ve saatler](docs://uitleg-dagen-en-uren) bölümünde açıklanır.

Bunun için *Saat planlamasını etkinleştir* seçeneği gerekir ([Saat planlamasını açma](docs://howto-urenplanning-aanzetten)). Saat planlaması olmadan *Çalışma saatleri* bölümünü görmezsiniz.

## Adımlar

### Vardiya ön ayarı seçmek

1. *Planlama › Takvim › Takvim* öğesini seçin ve soldan takvimi seçin.
2. *Çalışma saatleri* bölümünde bir ön ayara tıklayın. Ön ayar, takvimin iş günlerini ve çalışma saatlerini değiştirir.
3. *Uygula* öğesine tıklayın.

Her ön ayar şunu yapar:

- *Gündüz vardiyası*: Pazartesi’den Cumaya 08:00 ile 16:00 arasında, mola olmadan. Bu, takvimi bant olmayan normal bir takvime geri çevirir.
- *2 vardiya*: Pazartesi’den Cumaya 06:00 ile 14:00 arasında ve 14:00 ile 22:00 arasında, toplam 16 saat.
- *3 vardiya*: Pazartesi’den Cumaya üç vardiya: 06:00 ile 14:00 arası, 14:00 ile 22:00 arası ve 22:00 ile ertesi gün 06:00 arası, toplam 24 saat.
- *Gece vardiyası*: Pazartesi’den Cumaya 22:00 ile ertesi gün 06:00 arası, 8 saat.
- *24/7*: yedi günün tamamında 00:00 ile 24:00 arası.

### Haftanın gününe göre çalışma saatlerini ayarlamak

1. *Çalışma saatleri* bölümünde *Haftanın gününe göre ayarla…* öğesine tıklayın. Düğmelerin altında her hafta günü için bir satır belirir. Bu satırda o günün çalışma saatleri yer alır. Takvimde artık haftanın günü başına bantlar vardır. Takvimde bu bantlar zaten varsa bu genel bakış hemen açılır. Düğme o zaman *Çalışma saatlerini gizle* adını taşır ve genel bakışı kapatır.
2. İki saat alanında her bandın başlangıç ve bitiş saatini ayarlayın.
3. Bir mola eklemek istiyorsanız o gün için **+** (*Bant ekle*) öğesine tıklayın. Bantların saatlerini ayarlayın, böylece aralarında boşluk olsun. Yeni bant 08:00’de başlar ve 16:00’da biter.
4. Gece yarısını geçen bir bant için *sonraki gün* kutusunu işaretleyin. Bant, başladığı günde sayılır.
5. Bir bantın arkasındaki çöp kutusuna tıklayarak bandı silin. Bandı olmayan bir gün *Çalışılmayan* olarak görünür.
6. Pazartesi ile Cuma arasındaki bir gün için kopyalama simgesine (*Tüm iş günlerine kopyala*) tıklayın. Böylece o günün bantları Pazartesi’den Cumaya uygulanır.
7. Altta *Türetilmiş saat/gün:* bulunur. Bu, uygulamanın buna göre türettiği günlük net saatleri gösterir. *Uygula* öğesine tıklayın.

**Örnek: Cuma öğleden sonrası boş.** *Haftanın gününe göre ayarla…* öğesine tıklayın. *Cum* için ikinci bandı (13:00 ile 16:00 arası) silin. Cuma artık 5 saat, diğer günler 8 saat var. Türetilmiş saat/gün 8 olarak kalır.

### Kendi ön ayarınızı kaydetmek

1. *Ön ayar olarak kaydet…* öğesine tıklayın ve *Ön ayar adı* alanına bir ad yazın.
2. *Kaydet* öğesine tıklayın. Ön ayar artık diğer ön ayarların arasında yer alır ve her projede kullanabilirsiniz. Yanındaki çarpı işaretiyle onu yeniden silersiniz.

Kendi ön ayarınız bu cihazda saklanır, proje dosyasında değil.

## Dikkat edilecek noktalar ve uygulamanın o zaman yaptığı

**Ön ayar her şeyin yerini alır.** Bir ön ayar seçerseniz daha önce ayarladığınız iş günleri ve çalışma saatleri kaybolur. Tatiller kalır.

**Gün düğmeleri ile bantlar iki ayrı şeydir.** *Çalışma günleri* altındaki düğmeler bantları değiştirmez. Bir gün, o gün için *Bant ekle* öğesine tıklanarak çalışma saatleri alır. Bir günü yalnızca düğmeyle açarsanız, o gün görevler için gün olarak sayılır ama saat cinsinden görevler için sayılmaz. Çalışma saatleri olan bir takvimde haftanın günü başına satırları kullanın.

**Saat planlaması kapalıyken çalışma saatlerini ayarlamak.** Saat planlamasını yeniden kapatırsanız *Başlangıç (saat)*, *Bitiş (saat)* alanları ve mola geri gelir. Bant içeren bir takvimde bu alanlar bantları değiştirmez. Bu yüzden çalışma saatlerini her zaman saat planlaması açıkken ayarlayın.

**Kullanılabilir çalışma saati yok.** Bandı veya iş günü olmayan bir takvim, saatlerle ifade edilen bir görevi taşıyamaz. Uygulama o zaman şunu bildirir: *Bu takvimde geçerli çalışma saatleri yok. Çalışma günlerini ve saatlerini kontrol edin.*

## Ayrıca bakınız

- [Günler ve saatler](docs://uitleg-dagen-en-uren): uygulamanın çalışma saatlerini nasıl saydığı ve günlük net saatleri nasıl türettiği.
- [Saat planlamasını açma](docs://howto-urenplanning-aanzetten): bir görevi saat cinsinden planlamak.
- [Takvimler ve iş günleri](docs://uitleg-kalenders): hangi takvimin hangi göreve uygulandığı.
- [Takvim pencereleri](docs://ref-kalenders): takvim pencerelerinin tüm alanları.
