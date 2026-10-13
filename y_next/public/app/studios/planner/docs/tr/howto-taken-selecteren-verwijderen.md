# Görevleri seçme, silme ve geri alma

Amaç: görevleri seçmek, bunları kaldırmak ve bir hatayı geri almak.

## Ne zaman gerekir

Planlamadaki hemen her işlem seçtiğiniz görevlerle çalışır: silmek, kopyalamak, girintilemek ve bir kilometre taşını açmak veya kapatmak. Görevleri, iş ortadan kalktığında veya planlama revize edildiğinde kaldırırsınız. Uygulama silerken onay istemediği için *Geri al* sizin güvenlik ağınızdır.

## Adımlar

### Görevleri seçme

- **Tek görev.** Görev tablosunda satıra veya Gantt'taki çubuğa tıklayın.
- **Daha fazla görev.** Ctrl+tıklama (Mac'te ⌘+tıklama) bir görevi seçime ekler veya seçimden çıkarır. Görev tablosunda Shift+tıklama, etkin görevden tıkladığınız göreve kadar tüm görevleri seçer.
- **Görünen tüm görevler.** Ctrl+A, odak görev tablosunda veya Gantt'ta olduğunda. Bir filtrenin gizlediği görevler bunun dışında kalır; daraltılmış bir fazdaki alt görevler de öyle.
- **Gantt'ta bir kutu.** Ctrl tuşunu basılı tutun ve boş arka planın üzerinde sürükleyin: kutunun dokunduğu satırlardaki tüm görevler seçilir, çubukları kutunun yanında olsa bile. Yalnızca kutunun yüksekliği sayılır, zaman ekseni sayılmaz. Ctrl tuşunu yalnızca fare düğmesinden sonra bırakırsanız, bu görevler mevcut seçime eklenir; aksi halde seçimin yerini alır. Ctrl tuşu olmadan bu sürükleme, varsayılan ayarda zaman çizelgesini kaydırır.
- **Hiçbiri.** Esc tuşuna basın veya Gantt'ın boş arka planına tıklayın.

Bir özet görevi seçerseniz, alt görevleri onunla birlikte seçilmez. Silme ve kopyalama ise alt görevleri de kapsar.

### Görevleri silme

Görevleri seçin ve şu yollardan birini seçin:

- *Ana sayfa › Düzenle › Sil*. Aynı düğme *Tablo* sekmesinde de bulunur.
- Delete veya Backspace, odak görev tablosunda değilse: önce Gantt'ta bir çubuğa tıklayın.
- Sağ tık menüsünde *Sil*. Tıkladığınız görev seçimin bir parçasıysa, işlem tüm seçime uygulanır; değilse yalnızca o göreve uygulanır.
- *Özellikler* panelinin üstündeki küçük çöp kutusu (ipucu: *Görevi sil*). Bu, panelin gösterdiği görevi siler.

Uygulama onay istemez. Birden fazla görevi aynı anda silerseniz, bu *Geri al* için tek bir adımdır.

Bunlarla birlikte kaybolanlar: silinen bir özet görevin tüm alt görevleri, silinen görevlerden ve silinen görevlere giden tüm ilişkiler ve bunların kaynak atamaları. Bir özet görevin son alt görevini silerseniz, o normal bir görev olarak kalır. *WBS auto* açıksa, uygulama ağacı yeniden numaralandırır. Bundan sonra planlamanız artık güncel olmaz: **Hesapla** (F5) komutunu çalıştırın, *Otomatik hesapla* açık değilse.

### Daraltma ve genişletme

Bir özet görevin adının önünde görev tablosunda bir üçgen vardır; alt görevlerini gizlemek veya göstermek için buna tıklayın. *Görünüm › Anahat › Daralt* ve *Genişlet* ile bunu seçili özet görevler için yaparsınız; hiçbir şey seçili değilse hepsi için. Bir özet görevin sağ tık menüsünde de *Daralt* ve *Genişlet* bulunur. Gruplanmış bir görünümde düğmeler gruplar üzerinde çalışır.

Uygulama daraltma ve genişletmeyi açık belge başına tutar. Bu, *Geri al* kapsamında değildir ve proje dosyasında da yer almaz.

### Geri alma ve yineleme

- *Ana sayfa › Düzenle › Geri al* ve *Yinele* (ayrıca *Tablo* sekmesinde), başlık çubuğundaki oklar veya geri almak için Ctrl+Z, yinelemek için Ctrl+Y ya da Ctrl+Shift+Z.
- *Geri al* işleminden sonra yeni bir şey yaparsanız, *Yinele* artık kullanılamaz.

*Geri al* proje verilerinizdeki değişiklikleri kapsar (görevler, ilişkiler, kaynaklar, takvimler ve benzeri) ve bir düzen uygulamayı da. Görev tablosunun sütunlarındaki değişiklikler de adımdır: sütun eklemek, kaldırmak, taşımak, boyutunu değiştirmek, otomatik sığdırmak, sabitlemek ve sütun düzenini varsayılana sıfırlamak. Bu sütun adımları görev tablosunun kendisine aittir ve bir belgeye değil, tüm uygulamaya uygulanır. Uygulama her belge için son yüz adımı tutar; çok büyük bir projede daha az.

## Tuzaklar ve uygulamanın davranışı

**Görev tablosunda Delete bir görevi silmez.** Odak görev tablosundaysa, Delete (veya Backspace) seçili hücrelerin içeriğini temizler. Zorunlu veya hesaplanan bir hücre için, örneğin ad veya süre, uygulama işlemi reddeder ve görev tablosunun altında bir ileti gösterir; ad için örneğin *Bu değer zorunludur ve boş bırakılamaz.* Bu durumda hiçbir şey temizlenmez; diğer seçili hücreler bile temizlenmez. Bir görevi silmek için Gantt'ta bir çubuğa tıklayın veya *Sil* kullanın (Gantt'ın bulunmadığı *Tablo* sekmesinde: *Tablo › Düzenle › Sil* veya sağ tık menüsü).

**Bir faz bir seferde gider.** Bir özet görevi silerseniz, alt görevleri, onların ilişkileri ve atamaları da onunla birlikte gider. *Geri al* (Ctrl+Z) her şeyi geri getirir; ilişkileri ve atamaları da.

**Geri gelmeyenler.** Seçim, daraltma ve genişletme ile *Filtreleme/gruplama/sıralama sırasında kullanılamaz* şeridindeki *Temizle* düğmesi *Geri al* kapsamında değildir. *Temizle* düğmesinden sonra Ctrl+Z basarsanız, temizlemeyi değil, bir önceki adımınızı geri alırsınız.

**Başka görevlerin bağlı olduğu bir görevi kaldırmak.** Bu görevden ve bu göreve giden ilişkiler de kaybolur. Yalnızca ona bağlanmış görevler serbest kalır ve **Hesapla** komutundan sonra kendi planlanmış başlangıçlarında yeniden başlar. Gerekirse yeni ilişkiler ekleyin, bkz. [İlişki ekleme](docs://howto-relaties-leggen).

## Ayrıca bakın

- [Görevleri ve kilometre taşlarını eklemek](docs://howto-taken-en-mijlpalen-toevoegen): tersi ve görevleri kopyalama.
- [Yapıyı ayarlama](docs://howto-structuur-aanpassen): kaldırmak yerine bir görevi başka bir fazın altına yerleştirin.
- [Gantt'ta sürükleme, kaydırma ve yakınlaştırma](docs://howto-gantt-bedienen): seçim kutusu ve kaydırma modları.
- [Sağ tık menüleri](docs://ref-contextmenus): *Sil* ve diğer öğelerin bir seçimde ne yaptığı.
