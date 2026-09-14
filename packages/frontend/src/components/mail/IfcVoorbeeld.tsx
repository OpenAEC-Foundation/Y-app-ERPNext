import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

/**
 * Een IFC-bijlage naast de mail bekijken.
 *
 * Bouwmodellen komen hier gewoon per mail binnen — deze week alleen al een
 * stuk of vijf, van 200 kB tot 10 MB. Daar iets van zien kostte tot nu toe het
 * downloaden en openen van een ander programma; dit is dezelfde beweging als
 * bij een pdf: klikken, en hij staat ernaast.
 *
 * **Waarom web-ifc en niet de hele bovenbouw.** `web-ifc` is de motor van That
 * Open Company: één WebAssembly-module die het IFC-bestand leest en de
 * geometrie teruggeeft. De bovenbouw (`@thatopen/components`) brengt een eigen
 * scène-, werker- en fragmentenformaat mee, en dat vraagt om losse bestanden op
 * vaste paden. Deze app draait als één Frappe-webpagina waarin elk bestand een
 * eigen naam met bouwstempel krijgt; één wasm op een vast pad is daar
 * voorspelbaar, een werkerbestand met een fragmentencache niet.
 *
 * **Alles wordt pas geladen als je erop klikt.** three.js en web-ifc samen zijn
 * groter dan de rest van de app; ze zitten daarom achter een dynamische import
 * en komen niet in de hoofdbundel terecht.
 */

export default function IfcVoorbeeld({ url, naam }: { url: string; naam: string }) {
  const { t } = useTranslation();
  const doek = useRef<HTMLDivElement | null>(null);
  const [bezig, setBezig] = useState(true);
  const [fout, setFout] = useState("");
  const [onderdelen, setOnderdelen] = useState(0);

  useEffect(() => {
    let afgebroken = false;
    let opruimen: (() => void) | null = null;

    void (async () => {
      setBezig(true);
      setFout("");
      setOnderdelen(0);
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
         * Alles met dezelfde kleur in één geometrie. Een model van tien
         * megabyte bestaat uit tienduizenden losse stukjes; wordt elk stukje
         * een eigen mesh, dan staat het beeld stil nog voor je hebt gedraaid.
         */
        const perKleur = new Map<string, {
          kleur: [number, number, number, number];
          punten: number[];
          normalen: number[];
          index: number[];
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
              hoop = { kleur: [k.x, k.y, k.z, k.w], punten: [], normalen: [], index: [] };
              perKleur.set(sleutel, hoop);
            }
            const begin = hoop.punten.length / 3;
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
            aantal++;
          }
        });
        api.CloseModel(model);
        if (afgebroken) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf1f5f9);
        const groep = new THREE.Group();
        const opruimbaar: { dispose: () => void }[] = [];
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
          groep.add(new THREE.Mesh(geometrie, materiaal));
        }
        scene.add(groep);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 2.2));
        const zon = new THREE.DirectionalLight(0xffffff, 1.4);
        zon.position.set(1, 2, 1.5);
        scene.add(zon);

        const houder = doek.current;
        if (!houder) return;
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
          besturing.dispose();
          for (const d of opruimbaar) d.dispose();
          renderer.dispose();
          renderer.domElement.remove();
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

    return () => { afgebroken = true; opruimen?.(); };
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
      <div ref={doek} className="min-h-0 flex-1" />
    </div>
  );
}
