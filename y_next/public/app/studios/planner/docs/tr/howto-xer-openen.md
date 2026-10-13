# Primavera P6 dosyasını açma (.xer)

Amaç: bir planlamayı Primavera P6'dan önce XML'e aktarmadan, doğrudan uygulamada açmak.

## Ne zaman gerekir

Bir müşteri veya ana yüklenici Primavera'da çalışır ve planlamasını bir `.xer` dosyası olarak teslim eder. Bunu görüntülemek, hesaplamak veya üzerine eklemek istersiniz. Uygulama yalnızca `.xer` dosyalarını okur: `.xer` dosyası yazmaz ve dosyanızı asla değiştirmez. Dosyadan WBS yapısını, süresi, tarihleri, kısıtlamaları ve ilerlemesi olan görevleri, gecikmeleriyle birlikte ilişkileri, takvimleri ve atamalarıyla birlikte kaynakları alır. Ayrıca etkinlik kodlarını, özel alanları (UDF), notları ve P6'nın planlama ayarlarını alır. Türü *Çaba düzeyi* olan bir görev hamağa dönüşür.

## Adımlar

1. *Ana sayfa › Dosya › Aç* öğesini seçin veya Ctrl+O tuşlarına basın. `.xer` dosyasını seçin.
2. Uygulama, görevi olan her proje için bir sekme açar. En çok görevi olan proje etkin sekmedir. Bir sekme, P6 proje kimliği addan farklıysa *Proje adı (Proje kimliği)* olarak adlandırılır.
3. Alttaki mesajı okuyun. Üç proje içeren bir dosyada bu şöyle görünebilir: *XER dosyası açıldı: 3 proje belgesi.* Altında uygulamanın ne yaptığını açıklayan satırlar yer alır. Aşağıdaki başlığa bakın.
4. Şeridin altında bir bilgi alanı olup olmadığını kontrol edin: *Planı Primavera'nın kaydettiği şekilde görüntülüyorsunuz; yeniden hesaplama 1 görevi kaydırır.* Primavera kendi hesapladığı tarihleri dosyaya kaydeder. Uygulamanın hesabı bunlardan farklıysa uygulama, siz hiçbir şey değiştirmezseniz Primavera'nın tarihlerini gösterir. Bunun anlamı ve uygulamanın kendi hesabına nasıl geçeceğiniz için bkz. [Kaydedilen tarihler](docs://uitleg-datums-zoals-opgeslagen). Ayrıca *Bu dosya saat bazlı planlama içeriyor.* mesajı çıkabilir; bu durumda *Saat planlamasını etkinleştir* düğmesi görünür. Bkz. [Saat planlamasını açma](docs://howto-urenplanning-aanzetten).
5. Projenizi Ctrl+S ile kaydedin. Bir `.xer` dosyası asla üzerine yazılmadığı için uygulama, yeni IFC dosyasının nereye kaydedileceğini sorar. Dosya adı olarak *Proje adı (Proje kimliği)* önerir.

### Mesajın altındaki satırlar

Mesajın ilk satırı açılan sekme sayısını verir. Altında yalnızca geçerli olan satırlar yer alır. Bunlara dikkat edin:

- *Bu proje Primavera P6 olarak hesaplanıyor. Dosya → Proje bilgisi → Hesaplama profili ve seçenekleri üzerinden değiştirin.* Uygulama bu projeyi Primavera'nın hesap kurallarıyla hesaplar. *Hesaplama profilini aç* ile ayara gidersiniz.
- *1 temel proje dışarıda bırakıldı.* ve *1 temel plan oluşturuldu.* Bir P6 projesi başka bir projeyi kendi temel planı olarak belirlerse, bu diğer proje kendi sekmesi olarak açılmaz. Bu diğer proje, ona başvuran projenin etkin temel planı olur.
- *Koruyucu temel plan geri dönüşü kullanıldı.* Temel planları belirlemek hiçbir projenin açılmamasına yol açacaksa, bir proje kendisine başvuruyorsa veya projeler birbirine döngü içinde başvuruyorsa, uygulama yalnızca tüm projeleri açar ve temel plan oluşturmaz.
- *1 dış ilişki korundu.* Bu, iki proje arasındaki bir dış ilişkidir. Uygulama bunu kaynak verisi olarak saklar, ancak planlamanızda bir ilişkiye dönüştürmez.
- *1 görev, Primavera'nın kaydettiği tarihleri gösteriyor (yeniden hesaplanmadı).* Bu, *Kaydedilen tarihler* görünümünde gördüğünüz görev sayısıdır.

Diğer satırlar, okumanın kendisine ilişkin tanılamalardır: bulunan proje sayısı, atlanan boş bir proje, yok sayılan bozuk bir temel plan başvurusu, düz UTF-8 dışında bir metin kodlaması, tablolardaki, takvimlerdeki ve sayılardaki bulgular için sayaçlar, bilinmeyen alan değerleri ve uygulamanın güvenli bir seçenekle değiştirdiği P6 planlama ayarları. Bunlar sizden bir şey istemez. *Daha fazla bilgi* ile Primavera dosyalarını açma hakkındaki Yardım açılır.

## Sorunlar ve uygulamanın o durumda yaptığı

**Her şey sekmeye veya ilişkiye dönüşmez.** Görevi olmayan bir proje açılmaz. Bir temel proje kendi sekmesi olarak açılmaz. İki proje arasındaki bir dış ilişki planlamanızda ilişkiye dönüşmez. Uygulama bunu mesajın altındaki satırlarda bildirir.

**Her sekme kendi başına bir projedir.** Birini kaydederseniz IFC dosyası tam orijinal `.xer` dosyasını da saklar. Bu IFC dosyasını daha sonra yeniden açarsanız uygulama Primavera'nın tarihlerini yine bilir. Bu kaynak arşiv bozuksa veya başka bir IFC programı dosyayı yeniden yazdıysa, uygulama şunu bildirir: *Bu dosyadaki XER kaynak arşivi kullanılamaz durumda ve dışarıda bırakıldı; projenin kendisi eksiksiz açıldı.* Planlama, hesaplama profili ve tüm proje verileri eksiksizdir. Eksik olanlar şunlardır: Primavera'nın sakladığı tarihler ve yapay zekâ ve uzantılar için kaynak kökeni. Arşivi geri almak için orijinal `.xer` dosyasını yeniden açın.

**CSV, MS Project XML veya P6 XML'e dışa aktarmak veri kaybına yol açar.** Uygulama şunu uyarır: *CSV biçimine dışa aktarma XER kaynak bilgilerini kaybeder.* IFC hiçbir şey kaybettirmez.

**Uygulamanın okuyamadığı bir dosya.** Nedenini gösteren bir hata mesajı alırsınız. Birkaç örnek:

- *Bu, geçerli veya desteklenen bir XER dosyası değil.*
- *Bir XER tablosunda gerekli sütunlar eksik.*
- *Bu XER dosyasındaki P6 projesinde etkinlik yok.*

Bu durumda hiçbir şey açılmaz. Dosyayı P6'da kontrol edin veya göndericiden yeni bir dışa aktarma isteyin.

## Ayrıca bakın

- [Dosyalar ve biçimler](docs://uitleg-bestanden): neden bir `.xer` yalnızca okunur ve dışa aktarma neyi kaybettirir.
- [Kaydedilen tarihler](docs://uitleg-datums-zoals-opgeslagen): Primavera'nın kendi tarihlerinin görünümü.
- [MS Project dosyasını açma (.mpp)](docs://howto-mpp-openen): aynısı MS Project için geçerlidir.
- [Saat planlamasını açma](docs://howto-urenplanning-aanzetten): dosya saat bazlı veri içeriyorsa.
- [İçe ve dışa aktarma biçimleri](docs://ref-import-exportformaten): her biçim için neyin aktarıldığı ve neyin aktarılmadığı.
- [Hesaplama profilleri ve kurallar](docs://uitleg-rekenprofielen): neden bir P6 dosyasının kendi hesaplama profiliyle açıldığı.
