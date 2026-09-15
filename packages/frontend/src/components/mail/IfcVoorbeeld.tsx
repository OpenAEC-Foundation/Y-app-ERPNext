import { Fragment, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, X } from "lucide-react";
import { isKlik, soortLabel, waardeVan, zoekOnderdeel, type Bereik } from "../../lib/ifc-selectie";

/**
 * Een IFC-bijlage naast de mail bekijken.
 *
 * Bouwmodellen komen hier gewoon per mail binnen — van 200 kB tot 10 MB. Daar
 * iets van zien kostte het downloaden en openen van een ander programma; dit is
 * dezelfde beweging als bij een pdf: klikken, en hij staat ernaast.
 *
 * **Waarom web-ifc en niet de hele bovenbouw.** `web-ifc` is de motor van That
 * Open Company: een WebAssembly-module die het IFC-bestand leest en de
 * geometrie teruggeeft. De bovenbouw (`@thatopen/components`) brengt een eigen
 * scène-, werker- en fragmentenformaat mee dat losse bestanden op vaste paden
 * verwacht; deze app draait als een Frappe-webpagina waarin elk bestand een
 * naam met bouwstempel krijgt.
 *
 * **Alles wordt pas geladen als je erop klikt.** three.js en web-ifc samen zijn
 * groter dan de rest van de app; ze zitten achter een dynamische import.
 *
 * **Selecteren.** Klik op een onderdeel en het licht op, met ernaast wat het is
 * en welke eigenschappen het bestand erbij meegeeft. Alles met dezelfde kleur is
 * samengevoegd tot een geometrie (anders staat een groot model stil), dus welke
 * driehoek bij welk onderdeel hoort wordt apart bijgehouden — zie
 * `lib/ifc-selectie.ts`.
 */

/** Hoeveel eigenschappen per set we tonen; daarboven wordt het paneel een lijst. */
const MAX_EIGENSCHAPPEN = 20;

interface Eigenschapset {
  naam: string;
  eigenschappen: [string, string][];
}

interface Gekozen {
  soort: string;
  naam: string;
  globalId: string;
  tag: string;
  sets: Eigenschapset[];
  bezig: boolean;
}

/** Wat web-ifc teruggeeft voor een eigenschapset of een eigenschap. */
interface IfcRuw {
  Name?: unknown;
  HasProperties?: IfcRuw[];
  Quantities?: IfcRuw[];
  NominalValue?: unknown;
  LengthValue?: unknown;
  AreaValue?: unknown;
  VolumeValue?: unknown;
  CountValue?: unknown;
  WeightValue?: unknown;
}

function naarSets(ruw: IfcRuw[] | undefined): Eigenschapset[] {
  return (ruw || [])
    .map((set) => ({
      naam: waardeVan(set?.Name),
      eigenschappen: ((set?.HasProperties || set?.Quantities || []) as IfcRuw[])
        .slice(0, MAX_EIGENSCHAPPEN)
        .map((p): [string, string] => [
          waardeVan(p?.Name),
          waardeVan(p?.NominalValue ?? p?.LengthValue ?? p?.AreaValue ?? p?.VolumeValue
            ?? p?.CountValue ?? p?.WeightValue),
        ])
        .filter(([sleutel]) => sleutel !== ""),
    }))
    .filter((set) => set.eigenschappen.length > 0);
}

export default function IfcVoorbeeld({ url, naam }: { url: string; naam: string }) {
  const { t } = useTranslation();
  const doek = useRef<HTMLDivElement | null>(null);
  const [bezig, setBezig] = useState(true);
  const [fout, setFout] = useState("");
  const [onderdelen, setOnderdelen] = useState(0);
  const [gekozen, setGekozen] = useState<Gekozen | null>(null);
  const wisSelectie = useRef<() => void>(() => setGekozen(null));

  useEffect(() => {
    let afgebroken = false;
    let opruimen: (() => void) | null = null;

    void (async () => {
      setBezig(true);
      setFout("");
      setOnderdelen(0);
      setGekozen(null);
      try {
        const [THREE, webIfc, orbit] = await Promise.all([
          import("three"),
          import("web-ifc"),
          import("three/examples/jsm/controls/OrbitControls.js"),
        ]);
        if (afgebroken) return;

        const res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const bestand = new Uint8Array(await res.arrayBuffer());
        if (afgebroken) return;

        const api = new webIfc.IfcAPI();
        // De wasm staat als gewoon bestand naast de app: in productie onder
        // /files/, op de ontwikkelserver onder /.
        api.SetWasmPath(import.meta.env.BASE_URL, true);
        await api.Init();
        if (afgebroken) return;

        const model = api.OpenModel(bestand);

        /*
         * Alles met dezelfde kleur in een geometrie. Per onderdeel wordt
         * onthouden welke reeks driehoeken van hem is, zodat een klik weer bij
         * het onderdeel uitkomt.
         */
        const perKleur = new Map<string, {
          kleur: [number, number, number, number];
          punten: number[];
          normalen: number[];
          index: number[];
          bereiken: Bereik[];
        }>();
        let aantal = 0;

        api.StreamAllMeshes(model, (mesh) => {
          const stukken = mesh.geometries;
          for (let i = 0; i < stukken.size(); i++) {
            const stuk = stukken.get(i);
            const geo = api.GetGeometry(model, stuk.geometryExpressID);
            const hoeken = api.GetVertexArray(geo.GetVertexData(), geo.GetVertexDataSize());
            const index = api.GetIndexArray(geo.GetIndexData(), geo.GetIndexDataSize());
            const m = new THREE.Matrix4().fromArray(Array.from(stuk.flatTransformation));
            const normaalM = new THREE.Matrix3().getNormalMatrix(m);
            const k = stuk.color;
            const sleutel = k.x.toFixed(2) + "|" + k.y.toFixed(2) + "|"
              + k.z.toFixed(2) + "|" + k.w.toFixed(2);
            let hoop = perKleur.get(sleutel);
            if (!hoop) {
              hoop = { kleur: [k.x, k.y, k.z, k.w], punten: [], normalen: [], index: [], bereiken: [] };
              perKleur.set(sleutel, hoop);
            }
            const begin = hoop.punten.length / 3;
            const eersteDriehoek = hoop.index.length / 3;
            const punt = new THREE.Vector3();
            const normaal = new THREE.Vector3();
            // web-ifc levert per hoekpunt zes getallen: plaats en normaal.
            for (let v = 0; v < hoeken.length; v += 6) {
              punt.set(hoeken[v], hoeken[v + 1], hoeken[v + 2]).applyMatrix4(m);
              normaal.set(hoeken[v + 3], hoeken[v + 4], hoeken[v + 5])
                .applyMatrix3(normaalM).normalize();
              hoop.punten.push(punt.x, punt.y, punt.z);
              hoop.normalen.push(normaal.x, normaal.y, normaal.z);
            }
            for (let n = 0; n < index.length; n++) hoop.index.push(begin + index[n]);
            hoop.bereiken.push({ start: eersteDriehoek, aantal: index.length / 3, expressID: mesh.expressID });
            aantal++;
          }
        });
        if (afgebroken) { api.CloseModel(model); return; }

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf1f5f9);
        const groep = new THREE.Group();
        const opruimbaar: { dispose: () => void }[] = [];
        const stukken: InstanceType<typeof THREE.Mesh>[] = [];
        for (const hoop of perKleur.values()) {
          if (hoop.index.length === 0) continue;
          const geometrie = new THREE.BufferGeometry();
          geometrie.setAttribute("position", new THREE.Float32BufferAttribute(hoop.punten, 3));
          geometrie.setAttribute("normal", new THREE.Float32BufferAttribute(hoop.normalen, 3));
          geometrie.setIndex(hoop.index);
          const doorzichtig = hoop.kleur[3] < 1;
          const materiaal = new THREE.MeshLambertMaterial({
            color: new THREE.Color(hoop.kleur[0], hoop.kleur[1], hoop.kleur[2]),
            side: THREE.DoubleSide,
            transparent: doorzichtig,
            opacity: doorzichtig ? hoop.kleur[3] : 1,
            depthWrite: !doorzichtig,
          });
          opruimbaar.push(geometrie, materiaal);
          const stuk = new THREE.Mesh(geometrie, materiaal);
          stuk.userData.bereiken = hoop.bereiken;
          groep.add(stuk);
          stukken.push(stuk);
        }
        scene.add(groep);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 2.2));
        const zon = new THREE.DirectionalLight(0xffffff, 1.4);
        zon.position.set(1, 2, 1.5);
        scene.add(zon);

        const houder = doek.current;
        if (!houder) { api.CloseModel(model); return; }
        const breed = () => houder.clientWidth || 400;
        const hoog = () => houder.clientHeight || 400;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(breed(), hoog());
        houder.appendChild(renderer.domElement);

        const camera = new THREE.PerspectiveCamera(60, breed() / hoog(), 0.1, 1e6);
        const doos = new THREE.Box3().setFromObject(groep);
        const midden = doos.getCenter(new THREE.Vector3());
        const maat = doos.getSize(new THREE.Vector3()).length() || 10;
        camera.position.set(midden.x + maat * 0.6, midden.y + maat * 0.5, midden.z + maat * 0.6);
        camera.far = maat * 20;
        camera.updateProjectionMatrix();

        const besturing = new orbit.OrbitControls(camera, renderer.domElement);
        besturing.target.copy(midden);
        besturing.enableDamping = true;
        besturing.update();

        /* ── Selecteren ── */

        const accentMateriaal = new THREE.MeshBasicMaterial({
          color: 0x2563eb,
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        });
        const accent = new THREE.Group();
        scene.add(accent);

        const leegAccent = () => {
          for (const kind of [...accent.children]) {
            (kind as InstanceType<typeof THREE.Mesh>).geometry.dispose();
            accent.remove(kind);
          }
        };

        /*
         * Het gekozen onderdeel oplichten met een eigen kopie van zijn
         * driehoeken. Geen gedeelde buffers: bij het opruimen van de accentlaag
         * zou three.js die anders ook bij het model zelf weggooien.
         */
        const markeer = (id: number) => {
          leegAccent();
          for (const stuk of stukken) {
            const bereiken = stuk.userData.bereiken as Bereik[];
            const bron = stuk.geometry as InstanceType<typeof THREE.BufferGeometry>;
            const alle = bron.getIndex();
            // Zelf opgebouwd met gewone BufferAttributes; het verzameltype van
            // getAttribute kent ook GPU-attributen zonder getX.
            const pos = bron.getAttribute("position") as InstanceType<typeof THREE.BufferAttribute>;
            const nor = bron.getAttribute("normal") as InstanceType<typeof THREE.BufferAttribute>;
            if (!alle) continue;
            const p: number[] = [];
            const nn: number[] = [];
            for (const b of bereiken) {
              if (b.expressID !== id) continue;
              for (let i = b.start * 3; i < (b.start + b.aantal) * 3; i++) {
                const v = alle.getX(i);
                p.push(pos.getX(v), pos.getY(v), pos.getZ(v));
                nn.push(nor.getX(v), nor.getY(v), nor.getZ(v));
              }
            }
            if (p.length === 0) continue;
            const g = new THREE.BufferGeometry();
            g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
            g.setAttribute("normal", new THREE.Float32BufferAttribute(nn, 3));
            accent.add(new THREE.Mesh(g, accentMateriaal));
          }
        };

        let laatsteKlik = 0;
        const kies = async (id: number) => {
          const deze = ++laatsteKlik;
          markeer(id);
          const lijn = api.GetLine(model, id);
          const basis = {
            soort: soortLabel(api.GetNameFromTypeCode(api.GetLineType(model, id))),
            naam: waardeVan(lijn?.Name),
            globalId: waardeVan(lijn?.GlobalId),
            tag: waardeVan(lijn?.Tag),
          };
          setGekozen({ ...basis, sets: [], bezig: true });
          let sets: Eigenschapset[] = [];
          try {
            sets = naarSets(await api.properties.getPropertySets(model, id, true));
          } catch { /* eigenschappen zijn extra; soort en naam staan er al */ }
          // Een snellere tweede klik wint: dan hoort dit antwoord niet meer in beeld.
          if (!afgebroken && deze === laatsteKlik) setGekozen({ ...basis, sets, bezig: false });
        };

        const wis = () => {
          laatsteKlik++;
          leegAccent();
          setGekozen(null);
        };
        wisSelectie.current = wis;

        const raycaster = new THREE.Raycaster();
        let neer: { x: number; y: number } | null = null;
        const opNeer = (e: PointerEvent) => { neer = { x: e.clientX, y: e.clientY }; };
        const opLos = (e: PointerEvent) => {
          const begin = neer;
          neer = null;
          // Draaien begint ook met indrukken; alleen een echte klik selecteert.
          if (!begin || !isKlik(begin, { x: e.clientX, y: e.clientY })) return;
          const r = renderer.domElement.getBoundingClientRect();
          const punt = new THREE.Vector2(
            ((e.clientX - r.left) / r.width) * 2 - 1,
            -((e.clientY - r.top) / r.height) * 2 + 1,
          );
          raycaster.setFromCamera(punt, camera);
          const raak = raycaster.intersectObjects(stukken, false)[0];
          const driehoek = raak?.faceIndex;
          if (!raak || driehoek === undefined || driehoek === null) { wis(); return; }
          const id = zoekOnderdeel(raak.object.userData.bereiken as Bereik[], driehoek);
          if (id === null) { wis(); return; }
          void kies(id);
        };
        const toets = (e: KeyboardEvent) => { if (e.key === "Escape") wis(); };
        renderer.domElement.addEventListener("pointerdown", opNeer);
        renderer.domElement.addEventListener("pointerup", opLos);
        window.addEventListener("keydown", toets);

        let loopt = true;
        const tekenen = () => {
          if (!loopt) return;
          besturing.update();
          renderer.render(scene, camera);
          requestAnimationFrame(tekenen);
        };
        tekenen();

        const meten = new ResizeObserver(() => {
          camera.aspect = breed() / hoog();
          camera.updateProjectionMatrix();
          renderer.setSize(breed(), hoog());
        });
        meten.observe(houder);

        opruimen = () => {
          loopt = false;
          meten.disconnect();
          renderer.domElement.removeEventListener("pointerdown", opNeer);
          renderer.domElement.removeEventListener("pointerup", opLos);
          window.removeEventListener("keydown", toets);
          besturing.dispose();
          leegAccent();
          accentMateriaal.dispose();
          for (const d of opruimbaar) d.dispose();
          renderer.dispose();
          renderer.domElement.remove();
          try { api.CloseModel(model); } catch { /* al gesloten */ }
        };

        setOnderdelen(aantal);
        setBezig(false);
      } catch (err) {
        if (!afgebroken) {
          setFout(err instanceof Error ? err.message : String(err));
          setBezig(false);
        }
      }
    })();

    return () => {
      afgebroken = true;
      wisSelectie.current = () => setGekozen(null);
      opruimen?.();
    };
  }, [url]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {bezig && (
        <p className="flex items-center gap-2 px-4 py-2 text-xs text-slate-500">
          <Loader2 size={12} className="animate-spin" /> {t("webmail.ifc_loading", { naam })}
        </p>
      )}
      {fout && (
        <p className="px-4 py-2 text-xs text-amber-700">{t("webmail.ifc_failed", { error: fout })}</p>
      )}
      {!bezig && !fout && (
        <p className="px-4 py-1.5 text-[11px] text-slate-400">
          {t("webmail.ifc_parts", { count: onderdelen })}
        </p>
      )}
      <div className="relative min-h-0 flex-1">
        <div ref={doek} className="absolute inset-0" />
        {gekozen && (
          <div className="absolute bottom-2 left-2 z-10 max-h-[60%] w-72 max-w-[90%] overflow-y-auto rounded-lg border border-slate-200 bg-white/95 p-3 text-xs shadow-lg">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">{gekozen.soort}</p>
                <p className="truncate text-sm font-semibold text-slate-800">
                  {gekozen.naam || gekozen.tag || "—"}
                </p>
                {gekozen.globalId && (
                  <p className="truncate font-mono text-[10px] text-slate-400" title={gekozen.globalId}>
                    {gekozen.globalId}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => wisSelectie.current()} title={t("common.close")}
                className="cursor-pointer rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X size={13} />
              </button>
            </div>
            {gekozen.bezig ? (
              <p className="mt-2 flex items-center gap-1 text-slate-400">
                <Loader2 size={11} className="animate-spin" /> {t("webmail.ifc_properties_loading")}
              </p>
            ) : gekozen.sets.length === 0 ? (
              <p className="mt-2 text-slate-400">{t("webmail.ifc_no_properties")}</p>
            ) : (
              gekozen.sets.map((set, s) => (
                <div key={s} className="mt-2">
                  <p className="font-medium text-slate-600">{set.naam || t("webmail.ifc_properties")}</p>
                  <dl className="mt-0.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                    {set.eigenschappen.map(([sleutel, waarde], e) => (
                      <Fragment key={e}>
                        <dt className="text-slate-400">{sleutel}</dt>
                        <dd className="truncate text-slate-700" title={waarde}>{waarde || "—"}</dd>
                      </Fragment>
                    ))}
                  </dl>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
