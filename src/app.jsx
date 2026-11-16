const {useState,useEffect,useRef} = React;
const PRESSING_TEL = "0709405059";
const ADMIN_PWD = "F@nic0";
const ADMIN_ROUTE = "#/gestion-fanico";   // lien spécifique administrateur
const DEFAULT_POS = [5.345, -4.024];      // Abidjan
const DATA_FILE = "data.md";
const LOGO = window.__LOGO__ || "";
L.Icon.Default.mergeOptions(window.__LEAFLET_ICONS__ || {});

// ---------- utilitaires ----------
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const uid = () => { const a = new Uint8Array(9); crypto.getRandomValues(a); return Array.from(a, b => b.toString(36).padStart(2, "0")).join("").slice(0, 14); };
const genCode = () => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = "FN-"; for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };
const money = n => (Number(n) || 0).toLocaleString("fr-FR") + " FCFA";
const today = () => new Date().toISOString().slice(0, 10);
const fdate = d => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const reste = o => Math.max(0, (Number(o.aPayer) || 0) - (Number(o.dejaPaye) || 0));
const calcAPayer = o => (o.lavage ? Number(o.prixLavage) || 0 : 0) + (o.repassage ? Number(o.prixRepassage) || 0 : 0) + (o.service ? Number(o.prixService) || 0 : 0);
const waLink = (tel, txt) => { let t = (tel || "").replace(/\D/g, ""); if (t.length === 10) t = "225" + t; return `https://wa.me/${t}?text=${encodeURIComponent(txt)}`; };
const routeLink = p => `https://www.google.com/maps/dir/?api=1&destination=${p[0]},${p[1]}`;
const toB64 = s => btoa(unescape(encodeURIComponent(s)));
const fromB64 = s => decodeURIComponent(escape(atob(s.replace(/\n/g, ""))));

// ---------- data.md : fichier texte du projet sur GitHub ----------
const EMPTY = () => ({ seq: 0, orders: [], clients: {} });
// Référence unique de commande (indépendante du code client) : CMD-AAAA-00001
const makeRef = n => `CMD-${new Date().getFullYear()}-${String(n).padStart(5, "0")}`;
const cell = v => String(v ?? "").replace(/\|/g, "/").replace(/\n/g, " ");
function toMd(d) {
  const o = d.orders.map(x => `| ${cell(x.ref || "")} | ${cell(x.nom)} | ${cell(x.contact)} | ${x.status === "termine" ? "Terminé" : "En attente"} | ${cell(x.depot)} | ${cell(x.retrait)} | ${cell(x.details?.join(", "))} | ${cell(x.aPayer)} | ${reste(x)} | ${cell(x.code || "")} | ${x.pos ? x.pos.map(n => n.toFixed(5)).join(", ") : ""} |`).join("\n");
  const c = Object.entries(d.clients).map(([k, v]) => `| ${k} | ${cell(v.nom)} | ${cell(v.contact)} | ${v.pos ? v.pos.map(n => n.toFixed(5)).join(", ") : ""} |`).join("\n");
  return `# Données – Pressing Fanico Moderne

> Fichier généré automatiquement par l'application. Ne modifiez pas le bloc JSON à la main.
> Dernière mise à jour : ${new Date().toLocaleString("fr-FR")}

## Commandes (${d.orders.length})

| Référence | Client | Contact | Statut | Dépôt | Retrait | Détails | À payer | Reste | Code | Position |
|---|---|---|---|---|---|---|---|---|---|---|
${o}

## Codes clients (${Object.keys(d.clients).length})

| Code | Nom | Contact | Position |
|---|---|---|---|
${c}

## Données brutes

\`\`\`json
${JSON.stringify(d, null, 1)}
\`\`\`
`;
}
function parseMd(t) {
  const m = t.match(/```json\s*([\s\S]*?)\s*```/);
  if (!m) return EMPTY();
  const d = JSON.parse(m[1]);
  return { seq: d.seq || 0, orders: d.orders || [], clients: d.clients || {} };
}
function defaultCfg() {
  const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
  const first = location.pathname.split("/").filter(Boolean)[0];
  return { owner: m ? m[1] : "", repo: m ? (first && !first.includes(".") ? first : `${m[1]}.github.io`) : "", branch: "main", token: "", publicUrl: "" };
}
const getCfg = () => ({ ...defaultCfg(), ...load("fn_cfg", {}) });
const isWeb = /^https?:$/.test(location.protocol);
// URL publique de l'app (GitHub Pages) : utilisée pour les liens clients, même si l'admin travaille depuis le fichier local
const publicUrl = () => { const c = getCfg(); let u = c.publicUrl || (c.owner && c.repo ? (c.repo.toLowerCase() === `${c.owner}.github.io`.toLowerCase() ? `https://${c.owner}.github.io/` : `https://${c.owner}.github.io/${c.repo}/`) : ""); if (!u && isWeb) u = location.href.split("#")[0]; return u && !u.endsWith("/") && !u.endsWith(".html") ? u + "/" : u; };
const clientLink = o => publicUrl() + "#/suivi/" + o.id;
const api = c => `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${DATA_FILE}`;

async function ghGet(c, withToken) {
  const h = { Accept: "application/vnd.github+json" };
  if (withToken && c.token) h.Authorization = `Bearer ${c.token}`;
  const r = await fetch(`${api(c)}?ref=${c.branch}&t=${Date.now()}`, { headers: h, cache: "no-store" });
  if (r.status === 404) return { data: EMPTY(), sha: null };
  if (!r.ok) throw new Error(r.status === 401 ? "Jeton GitHub invalide" : "Erreur GitHub " + r.status);
  const j = await r.json();
  return { data: parseMd(fromB64(j.content)), sha: j.sha };
}
async function ghPut(c, data, sha, message) {
  const r = await fetch(api(c), {
    method: "PUT",
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${c.token}` },
    body: JSON.stringify({ message, content: toB64(toMd(data)), branch: c.branch, ...(sha ? { sha } : {}) })
  });
  if (!r.ok) {
    let gm = ""; try { gm = (await r.json()).message || ""; } catch {}
    const why = {
      401: "jeton invalide ou expiré",
      403: "le jeton n'a pas la permission « Contents : Read and write »",
      404: "le jeton n'a pas accès à ce dépôt (Repository access → sélectionnez le dépôt)",
      409: "conflit, réessayez",
      422: "données refusées par GitHub"
    }[r.status] || "erreur inconnue";
    const e = new Error(`Écriture refusée (${r.status}) : ${why}${gm ? " — GitHub : " + gm : ""}`); e.status = r.status; throw e;
  }
}
// Lecture publique (client) : API GitHub puis, en secours, le fichier servi par l'hébergeur
async function readPublic() {
  const c = getCfg();
  let err;
  if (c.owner && c.repo) { try { return (await ghGet(c, false)).data; } catch (e) { err = e; } }
  if (!isWeb) throw err || new Error("Application non configurée");
  const r = await fetch(DATA_FILE + "?t=" + Date.now(), { cache: "no-store" });
  if (!r.ok) throw new Error("Données indisponibles");
  return parseMd(await r.text());
}

// ---------- composants communs ----------
function useHash() {
  const [h, setH] = useState(location.hash);
  useEffect(() => { const f = () => setH(location.hash); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return h;
}
function Toast({ msg }) { return msg ? <div className="toast">{msg}</div> : null; }

function MapPicker({ pos, onChange, readOnly }) {
  const ref = useRef(), map = useRef(), mk = useRef();
  useEffect(() => {
    map.current = L.map(ref.current).setView(pos || DEFAULT_POS, pos ? 16 : 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map.current);
    if (!readOnly) map.current.on("click", e => onChange([e.latlng.lat, e.latlng.lng]));
    setTimeout(() => map.current.invalidateSize(), 200);
    return () => map.current.remove();
  }, []);
  useEffect(() => {
    if (!map.current) return;
    if (!pos) { if (mk.current) { mk.current.remove(); mk.current = null; } return; }
    if (!mk.current) {
      mk.current = L.marker(pos, { draggable: !readOnly }).addTo(map.current);
      mk.current.on("dragend", e => { const p = e.target.getLatLng(); onChange([p.lat, p.lng]); });
      map.current.setView(pos, 16);
    } else { mk.current.setLatLng(pos); if (!map.current.getBounds().contains(pos)) map.current.setView(pos, Math.max(map.current.getZoom(), 16)); }
  }, [pos && pos[0], pos && pos[1]]);
  return <div ref={ref} className="map" />;
}

function Receipt({ o }) {
  const done = o.status === "termine";
  const det = (o.details || []).filter(d => d.trim());
  return (
    <div className="card receipt">
      <div className="center">
        <img src={LOGO} alt="Logo" style={{ height: 90 }} onError={e => e.target.style.display = "none"} />
        <h2 style={{ marginTop: 6 }}>Reçu Pressing Fanico Moderne</h2>
        <div className="muted">Contact : <a href={"tel:" + PRESSING_TEL}>{PRESSING_TEL}</a></div>
        <p><span className={"badge " + (done ? "ter" : "att")}>{done ? "✔ Terminé" : "⏳ En attente"}</span></p>
      </div>
      <dl>
        <dt>Référence</dt><dd>{o.ref || "—"}</dd>
        <dt>Client</dt><dd>{o.nom || "—"}</dd>
        <dt>Contact</dt><dd>{o.contact || "—"}</dd>
        <dt>Date de dépôt</dt><dd>{fdate(o.depot)}</dd>
        <dt>Date de retrait</dt><dd>{fdate(o.retrait)}</dd>
        <dt>Service</dt><dd>{[o.lavage && "Lavage", o.repassage && "Repassage", o.service && "Récupération / Livraison"].filter(Boolean).join(" + ") || "—"}</dd>
        <dt>Poids</dt><dd>{o.kg ? o.kg + " Kg" : "—"}</dd>
        {o.lavage && <><dt>Prix lavage</dt><dd>{money(o.prixLavage)}</dd></>}
        {o.repassage && <><dt>Prix repassage</dt><dd>{money(o.prixRepassage)}</dd></>}
        {o.service && <><dt>Récupération / Livraison</dt><dd>{money(o.prixService)}</dd></>}
      </dl>
      {det.length > 0 && <>
        <h3 style={{ color: "var(--b2)", fontSize: "1rem", marginBottom: 4 }}>Détails</h3>
        <ul style={{ marginTop: 0 }}>{det.map((d, i) => <li key={i}>{d}</li>)}</ul>
      </>}
      <dl className="tot">
        <dt>À payer</dt><dd>{money(o.aPayer)}</dd>
        <dt>Déjà payé</dt><dd style={{ color: "var(--ok)" }}>{money(o.dejaPaye)}</dd>
        <dt><b>Reste à payer</b></dt><dd style={{ color: reste(o) ? "var(--r)" : "var(--ok)", fontSize: "1.1rem" }}>{money(reste(o))}</dd>
      </dl>
      {o.maj && <p className="muted center">Mis à jour le {new Date(o.maj).toLocaleString("fr-FR")}</p>}
    </div>
  );
}

// ---------- Accueil client : coller son lien ----------
function Home() {
  const [v, setV] = useState(""), [e, setE] = useState("");
  const go = ev => {
    ev.preventDefault();
    const t = v.trim(), m = t.match(/#\/suivi\/([A-Za-z0-9_-]+)/);
    const id = m ? m[1] : (/^[A-Za-z0-9_-]{8,}$/.test(t) ? t : null);
    if (!id) return setE("Lien invalide. Collez le lien reçu du pressing.");
    location.hash = "#/suivi/" + id;
  };
  return (
    <main style={{ maxWidth: 520 }}>
      <form className="card center" onSubmit={go}>
        <img src={LOGO} alt="Logo Fanico Moderne" style={{ maxWidth: 180, width: "55%" }} />
        <h2>Suivre ma commande</h2>
        <p className="muted">Collez ici le lien de votre reçu envoyé par le pressing.</p>
        <input placeholder="Collez votre lien ici" value={v} onChange={x => { setV(x.target.value); setE(""); }} />
        {e && <p className="err">{e}</p>}
        <button style={{ width: "100%", marginTop: 12 }}>Voir mon reçu</button>
        <p className="muted">📞 <a href={"tel:" + PRESSING_TEL}>{PRESSING_TEL}</a></p>
      </form>
    </main>
  );
}

// ---------- Vue client : se met à jour toute seule ----------
function ClientView({ id }) {
  const [o, setO] = useState(undefined), [err, setErr] = useState(""), [chk, setChk] = useState(null);
  useEffect(() => {
    let alive = true;
    const refresh = () => readPublic()
      .then(d => { if (alive) { setO(d.orders.find(x => x.id === id) || null); setErr(""); setChk(new Date()); } })
      .catch(e => alive && setErr(e.message));
    refresh();
    const t = setInterval(refresh, 60000);
    const v = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", v);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", v); };
  }, [id]);
  if (o === undefined) return <main><div className="card center">{err ? <span className="err">{err}</span> : "Chargement…"}</div></main>;
  if (o === null) return <main style={{ maxWidth: 560 }}><div className="card center">
    <p>Commande introuvable. Elle a peut-être été archivée.</p><p>Contactez le pressing : <a href={"tel:" + PRESSING_TEL}>{PRESSING_TEL}</a></p>
    <a className="btn sec" href="#/">Retour</a></div></main>;
  return (
    <main style={{ maxWidth: 560 }}>
      <Receipt o={o} />
      {o.pos && <div className="card"><h2>📍 Adresse de livraison</h2><MapPicker pos={o.pos} readOnly onChange={() => {}} /></div>}
      <p className="muted center noprint">🔄 Actualisation automatique · dernière vérification {chk && chk.toLocaleTimeString("fr-FR")}</p>
      <div className="row noprint">
        <button onClick={() => print()}>🖨️ Imprimer / PDF</button>
        <a className="btn sec" href={"tel:" + PRESSING_TEL}>📞 Appeler le pressing</a>
      </div>
    </main>
  );
}

// ---------- Admin ----------
const empty = () => ({ id: null, lavage: true, repassage: false, kg: "", prixLavage: "", prixRepassage: "", service: false, prixService: "", aPayer: 0, dejaPaye: "", nom: "", contact: "", depot: today(), retrait: "", details: [""], pos: null, status: "attente", code: null, codeFromLookup: false, detailsPosition: "" });

function Login({ onOk }) {
  const [p, setP] = useState(""), [e, setE] = useState(false);
  const go = ev => { ev.preventDefault(); if (p === ADMIN_PWD) { sessionStorage.setItem("fn_admin", "1"); onOk(); } else setE(true); };
  return (
    <main><form className="card login" onSubmit={go}>
      <h2>🔐 Espace administrateur</h2>
      <label>Mot de passe</label>
      <input type="password" value={p} onChange={x => { setP(x.target.value); setE(false); }} autoFocus />
      {e && <p className="err">Mot de passe incorrect.</p>}
      <button style={{ width: "100%", marginTop: 12 }}>Se connecter</button>
    </form></main>
  );
}

function Settings({ onDone, onCancel }) {
  const [c, setC] = useState(getCfg()), [st, setSt] = useState("");
  const set = (k, v) => setC(p => ({ ...p, [k]: v.trim() }));
  const test = async () => {
    setSt("Test en cours…");
    try {
      const r = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}`, { headers: { Authorization: `Bearer ${c.token}` } });
      if (!r.ok) throw new Error(r.status === 401 ? "Jeton invalide" : "Dépôt introuvable (" + r.status + ")");
      const j = await r.json();
      if (!j.permissions?.push) throw new Error("Le jeton n'a pas le droit d'écriture sur ce dépôt");
      save("fn_cfg", c); setSt(""); onDone();
    } catch (e) { setSt("❌ " + e.message); }
  };
  return (
    <main style={{ maxWidth: 560 }}><div className="card">
      <h2>⚙️ Connexion GitHub (stockage data.md)</h2>
      <p className="muted">À faire une seule fois par appareil. Voir le fichier GUIDE.md pour créer le jeton.</p>
      <div className="grid">
        <div><label>Propriétaire (compte GitHub)</label><input value={c.owner} onChange={e => set("owner", e.target.value)} /></div>
        <div><label>Dépôt</label><input value={c.repo} onChange={e => set("repo", e.target.value)} /></div>
        <div><label>Branche</label><input value={c.branch} onChange={e => set("branch", e.target.value)} /></div>
      </div>
      <label style={{ marginTop: 12 }}>Adresse publique de l'app (facultatif)</label>
      <input value={c.publicUrl || ""} onChange={e => set("publicUrl", e.target.value)} placeholder={c.owner ? `https://${c.owner}.github.io/${c.repo}/` : "https://compte.github.io/depot/"} />
      <label style={{ marginTop: 12 }}>Jeton d'accès (token)</label>
      <input type="password" value={c.token} onChange={e => set("token", e.target.value)} placeholder="github_pat_…" />
      {st && <p className={st.startsWith("❌") ? "err" : "muted"}>{st}</p>}
      <div className="row" style={{ marginTop: 12 }}>
        <button onClick={test} disabled={!c.owner || !c.repo || !c.token}>Tester et enregistrer</button>
        {onCancel && <button className="sec" onClick={onCancel}>Annuler</button>}
      </div>
    </div></main>
  );
}

function OrderForm({ initial, clients, onSave, onCancel, toast, busy }) {
  const [o, setO] = useState(initial);
  const [lookup, setLookup] = useState("");
  const set = (k, v) => setO(p => { const n = { ...p, [k]: v }; if (["lavage", "repassage", "service", "prixLavage", "prixRepassage", "prixService"].includes(k)) n.aPayer = calcAPayer(n); return n; });
  const setDet = (i, v) => setO(p => ({ ...p, details: p.details.map((d, j) => j === i ? v : d) }));

  const genererCode = () => {
    if (o.code) return;
    if (!o.nom.trim()) return toast("Renseignez d'abord le nom du client.");
    let c; do c = genCode(); while (clients[c]);
    setO(p => ({ ...p, code: c, codeFromLookup: false }));
    toast("Code généré : " + c + " (enregistré à la sauvegarde)");
  };
  const recuperer = async () => {
    const c = lookup.trim().toUpperCase();
    let cl = clients[c];
    try { cl = (await ghGet(getCfg(), true)).data.clients[c] || cl; } catch {}
    if (!cl) return toast("Code introuvable.");
    setO(p => ({ ...p, nom: cl.nom, contact: cl.contact, pos: cl.pos, detailsPosition: cl.detailsPosition || "", code: c, codeFromLookup: true }));
    toast(cl.pos ? "Client récupéré (position incluse)." : "Client récupéré — aucune position enregistrée, placez-la sur la carte.");
  };
  const submit = e => {
    e.preventDefault();
    if (!o.nom.trim()) return toast("Le nom du client est obligatoire.");
    onSave({ ...o, details: o.details.filter(d => d.trim()), id: o.id || uid(), maj: Date.now() });
  };

  return (
    <form className="card" onSubmit={submit}>
      <h2>{initial.id ? `✏️ Modifier la commande ${initial.ref || ""}` : "➕ Nouvelle commande"}</h2>
      {!initial.id && <p className="muted">La référence de commande (CMD-…) est attribuée automatiquement à l'enregistrement. Le code client sert uniquement à retrouver nom, contact et position.</p>}

      {!initial.id && <div className="card" style={{ background: "var(--bl)" }}>
        <label>Client existant ? Saisir son code</label>
        <div className="row"><input style={{ flex: 1, minWidth: 150 }} placeholder="FN-XXXXXX" value={lookup} onChange={e => setLookup(e.target.value)} />
          <button type="button" className="sec" onClick={recuperer}>🔎 Récupérer</button></div>
      </div>}

      <div className="grid">
        <div><label>Nom du client *</label><input value={o.nom} onChange={e => set("nom", e.target.value)} /></div>
        <div><label>Contact du client</label><input type="tel" value={o.contact} onChange={e => set("contact", e.target.value)} /></div>
        <div><label>Date de dépôt</label><input type="date" value={o.depot} onChange={e => set("depot", e.target.value)} /></div>
        <div><label>Date de retrait</label><input type="date" value={o.retrait} onChange={e => set("retrait", e.target.value)} /></div>
        <label className="chk"><input type="checkbox" checked={o.lavage} onChange={e => set("lavage", e.target.checked)} /> Lavage</label>
        <label className="chk"><input type="checkbox" checked={o.repassage} onChange={e => set("repassage", e.target.checked)} /> Repassage</label>
        <label className="chk"><input type="checkbox" checked={o.service} onChange={e => set("service", e.target.checked)} /> Récupération / Livraison</label>
        <div><label>Nombre de Kg</label><input type="number" min="0" step="0.1" value={o.kg} onChange={e => set("kg", e.target.value)} /></div>
        <div><label>Prix du lavage (FCFA)</label><input type="number" min="0" disabled={!o.lavage} value={o.prixLavage} onChange={e => set("prixLavage", e.target.value)} /></div>
        <div><label>Prix du repassage (FCFA)</label><input type="number" min="0" disabled={!o.repassage} value={o.prixRepassage} onChange={e => set("prixRepassage", e.target.value)} /></div>
        <div><label>Prix récupération / livraison (FCFA)</label><input type="number" min="0" disabled={!o.service} value={o.prixService} onChange={e => set("prixService", e.target.value)} /></div>
        <div><label>À payer (FCFA)</label><input type="number" min="0" value={o.aPayer} onChange={e => setO(p => ({ ...p, aPayer: e.target.value }))} /></div>
        <div><label>Déjà payé (FCFA)</label><input type="number" min="0" value={o.dejaPaye} onChange={e => set("dejaPaye", e.target.value)} /></div>
        <div><label>Reste à payer</label><input readOnly value={money(reste(o))} /></div>
      </div>

      <h2 style={{ marginTop: 18 }}>🧺 Détails</h2>
      {o.details.map((d, i) => (
        <div className="detail" key={i}>
          <input placeholder="ex : 2 draps blancs" value={d} onChange={e => setDet(i, e.target.value)} />
          {o.details.length > 1 && <button type="button" className="dng" onClick={() => setO(p => ({ ...p, details: p.details.filter((_, j) => j !== i) }))}>✕</button>}
        </div>
      ))}
      <button type="button" className="sec" onClick={() => setO(p => ({ ...p, details: [...p.details, ""] }))}>＋ Nouveau détail</button>

      <h2 style={{ marginTop: 18 }}>📍 Position du client</h2>
      <p className="muted">Cliquez sur la carte pour placer le client, ou déplacez le marqueur pour mettre à jour.</p>
      <MapPicker pos={o.pos} onChange={p => set("pos", p)} />
      <label style={{ marginTop: 10 }}>📝 Détails position (admin uniquement)</label>
      <textarea rows="3" placeholder="ex : maison à étage, 2e étage, porte n°12, portail bleu, après la pharmacie…" value={o.detailsPosition || ""} onChange={e => set("detailsPosition", e.target.value)} />
      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" className="sec" onClick={() => navigator.geolocation?.getCurrentPosition(p => set("pos", [p.coords.latitude, p.coords.longitude]), () => toast("Géolocalisation refusée."))}>🎯 Ma position actuelle</button>
        {o.pos && <a className="btn sec" href={routeLink(o.pos)} target="_blank">🧭 Itinéraire</a>}
        {o.pos && <button type="button" className="sec" onClick={() => set("pos", null)}>Effacer</button>}
      </div>

      <h2 style={{ marginTop: 18 }}>🔑 Code client</h2>
      <div className="row">
        {o.code ? <span className="code">{o.code}</span> : <span className="muted">Aucun code</span>}
        <button type="button" onClick={genererCode} disabled={!!o.code}>⚙️ Générer un code</button>
        {o.codeFromLookup && <span className="muted">Infos récupérées via code — régénération impossible.</span>}
        {o.code && <span className="muted">Nom, contact et position modifiés ici seront enregistrés sur ce code.</span>}
      </div>

      <h2 style={{ marginTop: 18 }}>Statut</h2>
      <div className="row">
        <label className="chk"><input type="radio" checked={o.status === "attente"} onChange={() => set("status", "attente")} /> ⏳ En attente</label>
        <label className="chk"><input type="radio" checked={o.status === "termine"} onChange={() => set("status", "termine")} /> ✔ Terminé (payé + livré)</label>
      </div>

      <div className="row" style={{ marginTop: 18 }}>
        <button type="submit" disabled={busy}>{busy ? "Enregistrement…" : "💾 Enregistrer"}</button>
        <button type="button" className="sec" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}

function ClientEdit({ code, client, onSave, onCancel, busy }) {
  const [c, setC] = useState({ nom: "", contact: "", pos: null, detailsPosition: "", ...client });
  return (
    <div className="card">
      <h2>👤 Client <span className="code">{code}</span></h2>
      <div className="grid">
        <div><label>Nom</label><input value={c.nom} onChange={e => setC({ ...c, nom: e.target.value })} /></div>
        <div><label>Contact</label><input type="tel" value={c.contact} onChange={e => setC({ ...c, contact: e.target.value })} /></div>
      </div>
      <h2 style={{ marginTop: 18 }}>📍 Position</h2>
      <p className="muted">Cliquez sur la carte ou déplacez le marqueur pour mettre à jour.</p>
      <MapPicker pos={c.pos} onChange={p => setC(x => ({ ...x, pos: p }))} />
      <label style={{ marginTop: 10 }}>📝 Détails position (admin uniquement)</label>
      <textarea rows="3" placeholder="ex : maison à étage, 2e étage, porte n°12, portail bleu, après la pharmacie…" value={c.detailsPosition || ""} onChange={e => setC({ ...c, detailsPosition: e.target.value })} />
      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" className="sec" onClick={() => navigator.geolocation?.getCurrentPosition(p => setC(x => ({ ...x, pos: [p.coords.latitude, p.coords.longitude] })))}>🎯 Ma position actuelle</button>
        {c.pos && <a className="btn sec" href={routeLink(c.pos)} target="_blank">🧭 Itinéraire</a>}
      </div>
      <p className="muted">Les commandes en attente de ce client seront aussi mises à jour.</p>
      <div className="row">
        <button onClick={() => onSave(c)} disabled={busy || !c.nom.trim()}>{busy ? "Enregistrement…" : "💾 Enregistrer sur ce code"}</button>
        <button className="sec" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}

function ClientsList({ clients, onOpen, onBack }) {
  const [q, setQ] = useState("");
  const rows = Object.entries(clients).filter(([k, v]) => (k + v.nom + v.contact).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>👥 Codes clients ({Object.keys(clients).length})</h2>
          <button className="sec" onClick={onBack}>← Commandes</button>
        </div>
        <input style={{ marginTop: 12 }} placeholder="🔍 Rechercher (code, nom, contact)" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="list">
        {rows.length === 0 && <div className="card muted center">Aucun client.</div>}
        {rows.map(([k, v]) => (
          <div className="item card" key={k} style={{ marginBottom: 0, cursor: "pointer" }} onClick={() => onOpen(k)}>
            <div className="top"><b>{v.nom}</b><span className="code">{k}</span></div>
            <div className="muted">{v.contact || "—"} · {v.pos ? "📍 position enregistrée" : "aucune position"}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function Admin() {
  const [logged, setLogged] = useState(sessionStorage.getItem("fn_admin") === "1");
  const [cfgOk, setCfgOk] = useState(() => { const c = getCfg(); return !!(c.owner && c.repo && c.token); });
  const [showCfg, setShowCfg] = useState(false);
  const [data, setData] = useState(() => load("fn_cache", EMPTY()));
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null), [viewId, setViewId] = useState(null);
  const [clientsView, setClientsView] = useState(false), [clientCode, setClientCode] = useState(null);
  const [q, setQ] = useState(""), [f, setF] = useState("tous");
  const [msg, setMsg] = useState("");
  const toast = m => { setMsg(m); setTimeout(() => setMsg(""), m.startsWith("❌") ? 9000 : 3000); };

  const refresh = async () => {
    setLoading(true);
    try { const { data } = await ghGet(getCfg(), true); setData(data); save("fn_cache", data); }
    catch (e) { toast("❌ " + e.message); }
    setLoading(false);
  };
  useEffect(() => { if (logged && cfgOk) refresh(); }, [logged, cfgOk]);

  // Relit data.md, applique la modification, puis réécrit le fichier (évite d'écraser d'autres changements)
  const mutate = async (fn, message) => {
    setBusy(true);
    const c = getCfg();
    try {
      for (let i = 0; i < 2; i++) {
        const { data: cur, sha } = await ghGet(c, true);
        const nd = fn(structuredClone(cur));
        try { await ghPut(c, nd, sha, message); setData(nd); save("fn_cache", nd); setBusy(false); return true; }
        catch (e) { if (e.status !== 409 || i) throw e; }
      }
    } catch (e) { toast("❌ " + e.message); }
    setBusy(false); return false;
  };

  if (!logged) return <Login onOk={() => setLogged(true)} />;
  if (!cfgOk || showCfg) return <Settings onDone={() => { setCfgOk(true); setShowCfg(false); }} onCancel={cfgOk ? () => setShowCfg(false) : null} />;

  const upsert = async o => {
    const { codeFromLookup, ...clean } = o;
    const ok = await mutate(d => {
      if (o.code) d.clients[o.code] = { ...(d.clients[o.code] || { cree: Date.now() }), nom: o.nom, contact: o.contact, pos: o.pos, detailsPosition: o.detailsPosition || "" };
      const i = d.orders.findIndex(x => x.id === o.id);
      const rec = { ...clean, codeFromLookup };
      if (i >= 0) d.orders[i] = { ...rec, ref: d.orders[i].ref || rec.ref };
      else { d.seq = (d.seq || d.orders.length) + 1; d.orders.unshift({ ...rec, ref: makeRef(d.seq) }); }
      return d;
    }, `Commande ${o.nom} (${o.status})`);
    if (ok) { setEdit(null); setViewId(o.id); toast("✔ Enregistré dans data.md"); }
  };
  const del = async o => {
    if (!confirm(`Supprimer la commande de ${o.nom} ? (le code client reste valide)`)) return;
    if (await mutate(d => ({ ...d, orders: d.orders.filter(x => x.id !== o.id) }), `Suppression commande ${o.nom}`)) setViewId(null);
  };
  const terminer = o => upsert({ ...o, status: "termine", dejaPaye: o.aPayer, maj: Date.now() });
  const copy = t => navigator.clipboard?.writeText(t).then(() => toast("Lien copié !"), () => prompt("Copiez le lien :", t));

  const saveClient = async (code, c) => {
    const ok = await mutate(d => {
      d.clients[code] = { ...(d.clients[code] || { cree: Date.now() }), nom: c.nom, contact: c.contact, pos: c.pos, detailsPosition: c.detailsPosition || "" };
      d.orders = d.orders.map(x => x.code === code && x.status !== "termine" ? { ...x, nom: c.nom, contact: c.contact, pos: c.pos, detailsPosition: c.detailsPosition || "", maj: Date.now() } : x);
      return d;
    }, `Client ${code} mis à jour`);
    if (ok) { setClientCode(null); toast("✔ Client mis à jour"); }
  };
  if (clientCode) return <main><ClientEdit code={clientCode} client={data.clients[clientCode]} busy={busy} onSave={c => saveClient(clientCode, c)} onCancel={() => setClientCode(null)} /><Toast msg={msg} /></main>;
  if (clientsView && !edit && !viewId) return <main><ClientsList clients={data.clients} onOpen={setClientCode} onBack={() => setClientsView(false)} /><Toast msg={msg} /></main>;

  if (edit) return <main><OrderForm initial={edit} clients={data.clients} onSave={upsert} onCancel={() => setEdit(null)} toast={toast} busy={busy} /><Toast msg={msg} /></main>;

  const view = viewId && data.orders.find(x => x.id === viewId);
  if (view) {
    const link = clientLink(view);
    return (
      <main style={{ maxWidth: 640 }}>
        <div className="row noprint" style={{ marginBottom: 12 }}><button className="sec" onClick={() => setViewId(null)}>← Retour</button></div>
        <Receipt o={view} />
        {view.code && <div className="card">Code client : <span className="code">{view.code}</span></div>}
        <div className="card noprint">
          <h2>🔗 Lien de suivi client</h2>
          <div className="linkbox">{link}</div>
          <p className="muted">Ce lien reste le même : le client voit automatiquement chaque mise à jour.</p>
          <div className="row">
            <button onClick={() => copy(link)}>📋 Copier</button>
            <a className="btn okb" target="_blank" href={waLink(view.contact, `Bonjour ${view.nom}, suivez votre commande ${view.ref || ""} Pressing Fanico Moderne ici : ${link}`)}>WhatsApp</a>
            <a className="btn sec" target="_blank" href={link}>Ouvrir</a>
            <button className="sec" onClick={() => print()}>🖨️ Imprimer</button>
          </div>
        </div>
        {(view.pos || view.detailsPosition) && <div className="card noprint"><h2>📍 Livraison</h2>
          {view.detailsPosition && <p style={{ whiteSpace: "pre-wrap", background: "var(--bl)", padding: 10, borderRadius: 10 }}>📝 {view.detailsPosition}</p>}
          {view.pos && <MapPicker pos={view.pos} readOnly onChange={() => {}} />}
          {view.pos && <a className="btn" style={{ marginTop: 8 }} target="_blank" href={routeLink(view.pos)}>🧭 Lancer l'itinéraire</a>}</div>}
        <div className="row noprint">
          <button className="sec" onClick={() => setEdit({ ...empty(), ...view, details: view.details?.length ? view.details : [""] })} disabled={busy}>✏️ Modifier</button>
          {view.status !== "termine" && <button className="okb" onClick={() => terminer(view)} disabled={busy}>✔ Marquer terminé</button>}
          <button className="dng" onClick={() => del(view)} disabled={busy}>🗑 Supprimer</button>
        </div>
        <Toast msg={msg} />
      </main>
    );
  }

  const list = data.orders.filter(o => (f === "tous" || o.status === f) && (o.nom + o.contact + (o.code || "") + (o.ref || "")).toLowerCase().includes(q.toLowerCase()));
  const nAtt = data.orders.filter(o => o.status === "attente").length;
  return (
    <main>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>📋 Commandes ({data.orders.length}) · <span style={{ color: "var(--wa)" }}>{nAtt} en attente</span></h2>
          <div className="row">
            <button onClick={() => setEdit(empty())}>➕ Nouvelle commande</button>
            <button className="sec" onClick={refresh} disabled={loading}>{loading ? "…" : "🔄"}</button>
            <button className="sec" onClick={() => setClientsView(true)}>👥 Clients</button>
            <button className="sec" onClick={() => setShowCfg(true)}>⚙️</button>
            <button className="sec" onClick={() => { sessionStorage.removeItem("fn_admin"); setLogged(false); }}>Déconnexion</button>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <input style={{ flex: 1, minWidth: 180 }} placeholder="🔍 Rechercher (référence, nom, contact, code)" value={q} onChange={e => setQ(e.target.value)} />
          <select style={{ width: "auto" }} value={f} onChange={e => setF(e.target.value)}>
            <option value="tous">Tous</option><option value="attente">En attente</option><option value="termine">Terminés</option>
          </select>
        </div>
      </div>
      <div className="list">
        {list.length === 0 && <div className="card muted center">{loading ? "Chargement…" : "Aucune commande."}</div>}
        {list.map(o => (
          <div className="item card" key={o.id} style={{ marginBottom: 0, cursor: "pointer" }} onClick={() => setViewId(o.id)}>
            <div className="top"><b>{o.ref && <span className="muted">{o.ref} · </span>}{o.nom}</b><span className={"badge " + (o.status === "termine" ? "ter" : "att")}>{o.status === "termine" ? "Terminé" : "En attente"}</span></div>
            <div className="muted">{o.contact} · Dépôt {fdate(o.depot)} · Retrait {fdate(o.retrait)} {o.code && <>· <b>{o.code}</b></>}</div>
            <div>À payer {money(o.aPayer)} · <span style={{ color: reste(o) ? "var(--r)" : "var(--ok)" }}>Reste {money(reste(o))}</span></div>
          </div>
        ))}
      </div>
      <Toast msg={msg} />
    </main>
  );
}

function App() {
  const h = useHash();
  const page = h.startsWith("#/suivi/") ? <ClientView id={h.slice(8)} /> : h.startsWith(ADMIN_ROUTE) ? <Admin /> : <Home />;
  return (<>
    <header>
      <img src={LOGO} alt="" onError={e => e.target.style.display = "none"} />
      <h1>Pressing Fanico Moderne<small>Tél : {PRESSING_TEL}</small></h1>
    </header>
    {page}
    <footer>© Pressing Fanico Moderne · {PRESSING_TEL}</footer>
  </>);
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
