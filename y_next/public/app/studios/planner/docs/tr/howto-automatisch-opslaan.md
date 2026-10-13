# Otomatik kaydetmeyi açma

Doel: uygulama proje dosyanızı siz çalışırken günceller. Böylece Ctrl+S tuşuna sürekli basmanız gerekmez.

## Bunu ne zaman kullanırsınız

Tek bir planlama üzerinde uzun bir oturum çalışırsınız, ya da kaydetmeyi sık sık unutursunuz. Dosyanın diskte veya paylaşılan bir klasörde güncel kalmasını istersiniz. Otomatik kaydetme, çökme kurtarmanın yerini almaz. Çökme kurtarma her zaman açıktır ve bundan ayrı çalışır. Farkı [Dosyalar ve biçimler](docs://uitleg-bestanden) bölümünde okursunuz.

## Adımlar

1. Projenin henüz bir dosyası yoksa, önce *Ana sayfa › Dosya › Farklı kaydet* ile bir kez kaydedin. Dosya yoksa geçiş gri olur ve ipucu şunu yazar: *Otomatik kaydetmeyi kullanmak için önce bu projeyi kaydedin.*
2. Sol üstte, üst şeritte *Otomatik kaydet* geçişine tıklayın. Açık olduğunda ipucu şunu yazar: *Otomatik kaydet açık: değişiklikler bu dosyaya yazılır.*
3. Çalışmaya devam edin. Projenizde bir değişiklik olur olmaz uygulama bunu dosyanıza yazar. Hiçbir pencere açılmadan, en fazla on saniyede bir yazar. Ardından *Kaydedilmedi* işareti kendiliğinden kaybolur.
4. Durdurmak istiyorsanız geçişe bir kez daha tıklayın. İpucu şunu yazar: *Otomatik kaydet kapalı. Çökme kurtarma etkin kalır.*

Chrome ve Edge önce yalnızca açtığınız bir dosyayı okumanıza izin verir. *Kaydet* (Ctrl+S) ile bir kez kaydedip tarayıcı yazma izni verene kadar geçiş orada işe yaramaz. Bundan sonra geçişi açabilirsiniz. Firefox'ta geçiş gri kalır. Uygulama orada dosyanıza yazamaz.

## Dikkat edilecek noktalar ve uygulamanın o durumda yaptıkları

**Geçiş bir projeye aittir.** Her sekmenin kendi durumu vardır. Bir proje açtıktan sonra geçiş her zaman kapalıdır. Uygulama bunu bir sonraki seferde hatırlamaz.

**Otomatik kaydet yalnızca projenin mevcut dosyasına yazar.** *Farklı kaydet* seçerseniz, uygulama bundan sonra yeni dosyaya yazar. Uygulama yalnızca değişiklik varsa yazar.

**Yazma başarısız olabilir.** Örneğin dosya kaybolmuşsa veya kilitliyse, uygulama nedenini de gösteren *Otomatik kaydetme başarısız* iletisini gösterir. Tarayıcının yazma izni yoksa veya artık yoksa, uygulama o turu sessizce atlar. İzin istemez.

**Dosyaya istemediğiniz değişiklikler de yazılır.** Otomatik kaydetme, projenizin o anki durumunu yazar. Ctrl+Z ile bir şeyi geri alırsanız, dosya bu geri alınmış durumu da on saniye içinde alır. Eski bir sürümü tutmak istiyorsanız, önce *Farklı kaydet* ile bir kopya yapın.

**Çökmede yine de son saniyeler kaybolur.** Uygulama en fazla on saniyede bir yazar. Bu aralıkta yaptıklarınız henüz dosyanızda yoktur. Çökme kurtarmanın da aynı sınırı vardır.

**Tarayıcıda kurtarmadan sonra geçiş yine gri olur.** Çöktükten sonra tarayıcıda geri aldığınız proje artık dosyasına bağlı değildir. Bir kez kaydedin, geçiş yeniden çalışır. Bkz. [Çökmeden sonra kurtarma](docs://howto-herstellen-na-een-crash).

**Başka bir biçimdeki projenin dosyası yoktur.** Bir CSV, XML, `.mpp` veya `.xer` dosyası yalnızca kaydettiğinizde bir IFC dosyası alır. Bundan sonra otomatik kaydetmeyi açabilirsiniz.

## Ayrıca bakın

- [Dosyalar ve biçimler](docs://uitleg-bestanden): kaydetme, otomatik kaydetme ve çökme kurtarma arasındaki fark.
- [Dosyayı açma ve kaydetme](docs://howto-bestand-openen-en-opslaan): kaydetme, *Farklı kaydet* ve *Kaydedilmedi* işareti.
- [Çökmeden sonra kurtarma](docs://howto-herstellen-na-een-crash): uygulamanın düzgün kapanmadığında sunduğu seçenekler.
