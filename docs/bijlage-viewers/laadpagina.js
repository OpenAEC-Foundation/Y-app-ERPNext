// Kopie van de Web Page `open-cad-studio` (route /ocs-viewer) op ERPNext, veld JavaScript. Stand: 2026-09-23 05:47. Zie docs/bijlage-viewers.md.
/*
 * Laadpagina voor de webversie van Open CAD Studio, gehost op deze ERPNext.
 *
 * Twee dingen gebeuren hier:
 *
 * 1. Het programma zelf. Het wasm-bestand staat gecomprimeerd in /files
 *    (ERPNext neemt geen 54 MB aan); hier wordt het opgehaald, uitgepakt en
 *    gestart.
 *
 * 2. De brug naar de bestandskiezer. De viewer vraagt een tekening op met de
 *    moderne bestandskiezer (`showOpenFilePicker`) en controleert of hij een
 *    échte FileSystemFileHandle terugkrijgt; een nagemaakt object valt daar
 *    door de mand. Daarom zetten we de tekening eerst in de privé-opslag van
 *    de browser (OPFS) en geven we die handle terug. Oudere browsers zonder
 *    die kiezer vallen terug op het verborgen invoerveld.
 */
(async () => {
  const p = new URLSearchParams(location.search);
  const bron = p.get("src");
  const naam = p.get("naam") || "tekening.dwg";
  const stap = document.getElementById("stap");
  const voortgang = document.getElementById("voortgang");
  const tip = document.getElementById("tip");

  function melden(tekst) {
    if (!tip) return;
    tip.textContent = tekst || "";
    tip.style.display = tekst ? "block" : "none";
  }

  /*
   * Omleidingen naar /files.
   *
   * De viewer gaat ervan uit dat hij op de hoofdmap van een website staat: hij
   * laadt zijn parse-worker als "ocs-parse-worker.js" en zijn lettertypen uit
   * "/fonts/…". Hier draait hij als pagina binnen ERPNext, waar alleen /files
   * beschrijfbaar is. Zonder deze omleiding bleef het openen van een tekening
   * hangen op 10%: de worker die het parsen doet, was er domweg niet.
   */
  const BESTANDEN = {
    "ocs-parse-worker.js": "/files/ocs_v1_worker.js",
    "/fonts/latin.ttf": "/files/ocs_v1_latin.ttf",
  };

  function omgeleid(url) {
    const tekst = String(url);
    for (const [zoek, vervang] of Object.entries(BESTANDEN)) {
      if (tekst.includes(zoek)) return vervang;
    }
    return null;
  }

  const OorspronkelijkeWorker = window.Worker;
  window.Worker = function (url, opties) {
    const vervanger = omgeleid(url);
    return new OorspronkelijkeWorker(vervanger || url, opties);
  };
  window.Worker.prototype = OorspronkelijkeWorker.prototype;

  const origineleFetch = window.fetch.bind(window);
  window.fetch = function (invoer, init) {
    const url = typeof invoer === "string" ? invoer : (invoer && invoer.url) || "";
    const vervanger = omgeleid(url);
    return origineleFetch(vervanger || invoer, init);
  };

  /* ── Brug naar de bestandskiezer ── */
  const origineleKiezer = window.showOpenFilePicker ? window.showOpenFilePicker.bind(window) : null;
  const origineleKlik = HTMLInputElement.prototype.click;

  HTMLInputElement.prototype.click = function () {
    if (this.type === "file" && window.__ocsBestand) {
      const dt = new DataTransfer();
      dt.items.add(window.__ocsBestand);
      this.files = dt.files;
      this.dispatchEvent(new Event("change", { bubbles: true }));
      melden("");
      return;
    }
    return origineleKlik.apply(this, arguments);
  };

  if (origineleKiezer) {
    window.showOpenFilePicker = async function (...args) {
      if (window.__ocsHandle) {
        const handle = window.__ocsHandle;
        window.__ocsHandle = null;
        melden("");
        return [handle];
      }
      return origineleKiezer(...args);
    };
  }

  /** De tekening klaarzetten: als File én als echte handle in de privé-opslag. */
  async function zetKlaar(bestandsnaam, blob) {
    window.__ocsBestand = new File([blob], bestandsnaam);
    try {
      const map = await navigator.storage.getDirectory();
      const handle = await map.getFileHandle(bestandsnaam, { create: true });
      const schrijver = await handle.createWritable();
      await schrijver.write(blob);
      await schrijver.close();
      window.__ocsHandle = handle;
    } catch (err) {
      console.warn("privé-opslag niet beschikbaar:", err);
    }
  }

  // De tekening ophalen loopt naast het laden van het programma; `bestandKlaar`
  // is waar het automatisch openen straks op wacht.
  const bestandKlaar = bron
    ? fetch(bron, { credentials: "include" })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("HTTP " + r.status))))
      .then(async (b) => {
        await zetKlaar(naam, b);
        melden("“" + naam + "” staat klaar. Kies in de viewer Bestand openen (of Ctrl+O).");
        return true;
      })
      .catch(() => false)
    : Promise.resolve(false);


  /**
   * De tekening vanzelf openen.
   *
   * De viewer heeft geen manier om van buitenaf een bestand te krijgen, maar
   * hij heeft wel een opdrachtregel. We typen daar OPEN, en het venster dat
   * dan verschijnt vraagt om een bestand met een gewoon invoerveld; daar zetten
   * we de tekening in. Lukt dat niet binnen een paar seconden, dan blijft de
   * tip staan en doet de gebruiker het zelf.
   */
  async function openVanzelf() {
    if (!(await bestandKlaar)) return;
    let canvas = null;
    for (let poging = 0; poging < 30 && !canvas; poging++) {
      canvas = document.querySelector("canvas");
      if (!canvas) await new Promise((r) => setTimeout(r, 200));
    }
    if (!canvas || !window.__ocsBestand) return;
    canvas.focus();
    // Even wachten tot de viewer zijn beginscherm heeft opgebouwd; een
    // opdracht die aankomt terwijl hij nog bezig is, verdwijnt.
    await new Promise((r) => setTimeout(r, 800));
    const toets = (key, code) => {
      for (const soort of ["keydown", "keypress", "keyup"]) {
        canvas.dispatchEvent(new KeyboardEvent(soort, { key, code, bubbles: true, cancelable: true }));
      }
    };
    for (const teken of "open") toets(teken, "Key" + teken.toUpperCase());
    toets("Enter", "Enter");

    for (let poging = 0; poging < 40; poging++) {
      await new Promise((r) => setTimeout(r, 100));
      const velden = [...document.querySelectorAll("input[type=file]")];
      const veld = velden[velden.length - 1];
      if (!veld) continue;
      const dt = new DataTransfer();
      dt.items.add(window.__ocsBestand);
      veld.files = dt.files;
      veld.dispatchEvent(new Event("change", { bubbles: true }));
      melden("");
      // Zodra de tekening binnen is: passend in beeld zetten (ZOOM EXTENTS).
      // Zonder dat opent hij op de laatst bewaarde uitsnede van de tekening,
      // wat vaak een leeg hoekje is.
      await passendInBeeld(canvas);
      return;
    }
  }

  /** ZOOM EXTENTS via de opdrachtregel, zodra het inlezen klaar is. */
  async function passendInBeeld(canvas) {
    const toets = (key, code) => {
      for (const soort of ["keydown", "keypress", "keyup"]) {
        canvas.dispatchEvent(new KeyboardEvent(soort, { key, code, bubbles: true, cancelable: true }));
      }
    };
    // Wachten tot het openen-venster weg is; dan pas luistert de opdrachtregel.
    for (let poging = 0; poging < 60; poging++) {
      await new Promise((r) => setTimeout(r, 250));
      if (!document.querySelector("input[type=file]")) break;
    }
    await new Promise((r) => setTimeout(r, 600));
    canvas.focus();
    // Het eigenschappenvenster dicht: kijken naar een tekening vraagt om
    // beeld, niet om een kolom met veldwaarden. De viewer onthoudt deze keuze
    // niet, dus hij staat bij elke start weer open.
    for (const teken of "properties") toets(teken, "Key" + teken.toUpperCase());
    toets("Enter", "Enter");
    await new Promise((r) => setTimeout(r, 400));
    for (const teken of "ze") toets(teken, "Key" + teken.toUpperCase());
    toets("Enter", "Enter");
  }


  /**
   * Het tekenvlak over de hele pagina.
   *
   * De viewer hangt zijn canvas onderaan de pagina van ERPNext, ónder de
   * opmaak die die pagina zelf meebrengt. Daardoor begon de tekening halverwege
   * het scherm en bleef de bovenkant zwart. Hier gaat het canvas vast over het
   * hele venster en verdwijnt de rest van de pagina.
   */
  function schermVullend() {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    let blok = canvas;
    while (blok.parentElement && blok.parentElement !== document.body) blok = blok.parentElement;
    for (const kind of [...document.body.children]) {
      if (kind === blok || kind.id === "tip" || kind.id === "laden") continue;
      kind.style.display = "none";
    }
    Object.assign(document.body.style, { margin: "0", padding: "0", overflow: "hidden" });
    Object.assign(blok.style, { position: "fixed", inset: "0", width: "100%", height: "100%" });
    if (blok !== canvas) Object.assign(canvas.style, { width: "100%", height: "100%", display: "block" });
  }

  /* ── Het programma ── */
  try {
    stap.textContent = "programma ophalen…";
    const res = await fetch("/files/ocs_v1_wasm_gz.bin");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const totaal = Number(res.headers.get("content-length")) || 0;
    let binnen = 0;
    const geteld = new TransformStream({
      transform(chunk, controller) {
        binnen += chunk.byteLength;
        if (totaal) voortgang.style.width = Math.min(100, (binnen / totaal) * 100) + "%";
        controller.enqueue(chunk);
      },
    });
    stap.textContent = "uitpakken…";
    const uitgepakt = res.body.pipeThrough(geteld).pipeThrough(new DecompressionStream("gzip"));
    const bytes = await new Response(uitgepakt).arrayBuffer();
    stap.textContent = "starten…";
    const init = (await import("/files/ocs_v1_glue.js")).default;
    await init({ module_or_path: bytes });
    document.getElementById("laden").classList.add("weg");
    // De viewer meet zijn tekenvlak bij het starten. Staat hij in een kader
    // dat daarna van maat verandert (het paneel naast de mail, een venster dat
    // je sleept), dan blijft het beeld anders in een hoek hangen.
    schermVullend();
    const meetOpnieuw = () => { schermVullend(); window.dispatchEvent(new Event("resize")); };
    meetOpnieuw();
    window.setTimeout(meetOpnieuw, 300);
    new ResizeObserver(meetOpnieuw).observe(document.documentElement);
    if (bron) void openVanzelf();
  } catch (err) {
    stap.textContent = "laden mislukt: " + (err && err.message ? err.message : err);
    voortgang.style.background = "#e06c75";
  }
})();
