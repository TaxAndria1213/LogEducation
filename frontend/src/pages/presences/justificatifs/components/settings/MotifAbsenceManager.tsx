import { FiSettings } from "react-icons/fi";
import { useEffect, useMemo, useState } from "react";
import MotifAbsenceService from "../../../../../services/motifAbsence.service";
import { useAuth } from "../../../../../hooks/useAuth";

export default function MotifAbsenceManager() {
  const { etablissement_id } = useAuth();
  const service = useMemo(() => new MotifAbsenceService(), []);
  const [nom, setNom] = useState("");
  const [excuse, setExcuse] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => { if (!etablissement_id) return; const result = await service.getForEtablissement(etablissement_id, { take: 200 }); setRows(result?.status.success ? result.data.data : []); };
  useEffect(() => { void load(); }, [etablissement_id]);
  const submit = async () => { if (!etablissement_id || !nom.trim()) return; await service.create({ etablissement_id, nom: nom.trim(), est_excuse_par_defaut: excuse }); setNom(""); setExcuse(false); await load(); };
  return <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><FiSettings className="text-slate-500" /><div><h3 className="text-lg font-semibold text-slate-900">Motifs d'absence</h3><p className="text-sm text-slate-500">Ajoute les motifs utilises par les justificatifs.</p></div></div><div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto_auto]"><input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom du motif" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" /><label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm"><input type="checkbox" checked={excuse} onChange={(e) => setExcuse(e.target.checked)} /> Excuse par defaut</label><button type="button" onClick={() => void submit()} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Ajouter</button></div><div className="mt-5 space-y-3">{rows.map((row) => <div key={row.id} className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"><div><p className="text-sm font-semibold text-slate-900">{row.nom}</p><p className="text-xs text-slate-500">{row.est_excuse_par_defaut ? "Excuse par defaut" : "Motif standard"}</p></div><button type="button" onClick={() => void service.delete(row.id).then(load)} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">Supprimer</button></div>)}</div></section>;
}

