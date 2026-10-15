"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { DOC_TYPES, TEMPLATE_TEXT, prettyDate, type DocType, type DocumentRow } from "@/lib/documents";
import { jsPDF } from "jspdf";
import { School, LayoutDashboard, FileText, Files, Users, UserRound, ClipboardList, Plus, Search, LogOut, Download, Pencil, X, LoaderCircle, Filter, RefreshCw } from "lucide-react";

const icons = [FileText, Files, Users, Users, FileText, ClipboardList];
const colors = ["#2563eb", "#059669", "#7c3aed", "#4f46e5", "#d97706", "#e11d48"];

export default function Home() {
  const supabase = useMemo(() => {
    try { return createClient(); } catch { return null; }
  }, []);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<DocumentRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [form, setForm] = useState({ tipo_documento: "Oficio" as DocType, fecha_documento: new Date().toISOString().slice(0,10), destinatario: "", asunto_tema: "", contenido: "" });

  const loadRows = useCallback(async () => {
    if (!supabase || !session) return;
    setLoading(true); setError("");
    const { data, error: e } = await supabase.from("documentos").select("*").order("fecha_creacion", { ascending: false }).limit(500);
    if (e) setError(e.message); else setRows((data ?? []) as DocumentRow[]);
    setLoading(false);
  }, [supabase, session]);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => { if (session) void loadRows(); else { setRows([]); setLoading(false); } }, [session, loadRows]);

  const filtered = useMemo(() => rows.filter((r) => {
    const text = `${r.folio} ${r.destinatario} ${r.asunto_tema} ${r.tipo_documento}`.toLocaleLowerCase("es");
    return (!query || text.includes(query.toLocaleLowerCase("es"))) &&
      (!filterType || r.tipo_documento === filterType) &&
      (!from || r.fecha_documento >= from) && (!to || r.fecha_documento <= to);
  }), [rows, query, filterType, from, to]);

  const stats = useMemo(() => ({
    total: rows.length,
    oficios: rows.filter(r => r.tipo_documento === "Oficio").length,
    memos: rows.filter(r => r.tipo_documento === "Memorándum").length,
    circulares: rows.filter(r => r.tipo_documento === "Circular").length,
    citatorios: rows.filter(r => r.tipo_documento.startsWith("Citatorio")).length,
  }), [rows]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault(); if (!supabase) return;
    setSaving(true); setError("");
    const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
    if (e2) setError(e2.message);
    setSaving(false);
  }
  async function signOut() { await supabase?.auth.signOut(); }

  function newDocument(type?: DocType) {
    setEditing(null);
    setForm({ tipo_documento: type ?? "Oficio", fecha_documento: new Date().toISOString().slice(0,10), destinatario: "", asunto_tema: "", contenido: type ? TEMPLATE_TEXT[type] : "" });
    setModal(true); setError("");
  }
  function editDocument(row: DocumentRow) {
    setEditing(row);
    setForm({ tipo_documento: row.tipo_documento, fecha_documento: row.fecha_documento, destinatario: row.destinatario, asunto_tema: row.asunto_tema, contenido: row.contenido });
    setModal(true); setError("");
  }
  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) { setForm(old => ({ ...old, [key]: value })); }

  async function saveDocument(e: React.FormEvent) {
    e.preventDefault(); if (!supabase) return;
    setSaving(true); setError(""); setNotice("");
    if (editing) {
      const { error: e2 } = await supabase.from("documentos").update({
        tipo_documento: form.tipo_documento, fecha_documento: form.fecha_documento,
        destinatario: form.destinatario.trim(), asunto_tema: form.asunto_tema.trim(), contenido: form.contenido.trim(),
      }).eq("id", editing.id);
      if (e2) setError(e2.message);
      else { setNotice("Documento actualizado."); setModal(false); await loadRows(); }
    } else {
      const { data, error: e2 } = await supabase.rpc("crear_documento_con_folio", {
        p_tipo_documento: form.tipo_documento, p_fecha_documento: form.fecha_documento,
        p_destinatario: form.destinatario.trim(), p_asunto_tema: form.asunto_tema.trim(), p_contenido: form.contenido.trim(),
      });
      if (e2) setError(e2.message);
      else {
        const created = Array.isArray(data) ? data[0] : data;
        setNotice(`Documento creado con folio ${created?.folio ?? ""}.`);
        setModal(false); await loadRows();
      }
    }
    setSaving(false);
  }

  async function exportPdf(row: DocumentRow) {
    const pdf = new jsPDF({ unit: "mm", format: "letter" });
    const margin = 22, width = 170;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(15);
    pdf.text("SISTEMA DE GESTIÓN ESCOLAR", margin, 22);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
    pdf.text(`Folio: ${row.folio}`, margin, 32);
    pdf.text(`Fecha: ${prettyDate(row.fecha_documento)}`, margin, 38);
    pdf.setDrawColor(200); pdf.line(margin, 43, 190, 43);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
    pdf.text(row.tipo_documento.toUpperCase(), margin, 54);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(11);
    const recipient = pdf.splitTextToSize(`Destinatario: ${row.destinatario}`, width);
    pdf.text(recipient, margin, 66);
    let y = 66 + recipient.length * 6 + 6;
    pdf.setFont("helvetica", "bold"); pdf.text("Asunto:", margin, y);
    pdf.setFont("helvetica", "normal");
    const subject = pdf.splitTextToSize(row.asunto_tema, width);
    pdf.text(subject, margin, y + 6); y += 6 + subject.length * 6 + 7;
    const body = pdf.splitTextToSize(row.contenido || "(Sin contenido)", width);
    for (const line of body) {
      if (y > 250) { pdf.addPage(); y = 22; }
      pdf.text(line, margin, y); y += 6;
    }
    y += 24;
    if (y < 250) { pdf.line(70, y, 140, y); pdf.text("Nombre y firma", 91, y + 6); }
    const blob = pdf.output("blob");
    const fileName = `${row.folio.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;
    if (supabase && session) {
      const path = `${session.user.id}/${row.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from("documentos-pdf").upload(path, blob, { contentType: "application/pdf", upsert: true });
      if (uploadError) { setError(`PDF creado localmente, pero no se pudo guardar en Storage: ${uploadError.message}`); }
      else {
        const { error: updateError } = await supabase.from("documentos").update({ archivo_pdf_path: path }).eq("id", row.id);
        if (updateError) setError(`PDF guardado; no se actualizó el registro: ${updateError.message}`);
      }
    }
    pdf.save(fileName);
    if (!error) setNotice(`PDF descargado: ${fileName}`);
  }

  if (!supabase) return <SetupMessage />;
  if (!session) return <main className="min-h-screen grid place-items-center p-5"><div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-slate-200"><div className="flex items-center gap-3 mb-7"><div className="rounded-xl bg-blue-600 p-3 text-white"><School size={25}/></div><div><h1 className="text-xl font-bold">SGE Admin</h1><p className="text-sm text-slate-500">Control administrativo escolar</p></div></div><h2 className="text-2xl font-bold mb-2">Iniciar sesión</h2><p className="text-sm text-slate-500 mb-6">Acceso exclusivo para personal autorizado.</p>{error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 mb-4">{error}</p>}<form onSubmit={signIn} className="space-y-4"><label className="block text-sm font-medium">Correo electrónico<input className="mt-1 w-full rounded-lg border p-3 outline-blue-500" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="block text-sm font-medium">Contraseña<input className="mt-1 w-full rounded-lg border p-3 outline-blue-500" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={saving} className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? "Ingresando…" : "Entrar"}</button></form><p className="mt-5 text-xs text-slate-400">Las cuentas se administran desde Supabase Auth; no hay registro público.</p></div></main>;

  return <div className="min-h-screen md:flex">
    <aside className="hidden md:flex w-64 shrink-0 flex-col bg-slate-950 text-white min-h-screen">
      <div className="flex items-center gap-3 border-b border-slate-800 p-6"><div className="rounded-lg bg-blue-600 p-2"><School size={22}/></div><div><div className="font-bold tracking-wide">SGE Admin</div><div className="text-xs text-slate-400">Control escolar</div></div></div>
      <nav className="flex-1 p-4"><div className="rounded-lg bg-blue-600 px-4 py-3 flex items-center gap-3"><LayoutDashboard size={18}/> Panel de control</div><p className="px-4 pt-7 pb-2 text-xs uppercase tracking-wider text-slate-500">Documentos</p>{DOC_TYPES.map((t,i)=>{const Icon=icons[i];return <button key={t} onClick={()=>newDocument(t)} className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white"><Icon size={17}/>{t}</button>})}</nav>
      <div className="border-t border-slate-800 p-4"><p className="truncate text-sm font-medium">{session.user.email}</p><p className="text-xs text-slate-500 mb-3">Usuario autenticado</p><button onClick={signOut} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white"><LogOut size={16}/> Cerrar sesión</button></div>
    </aside>
    <main className="min-w-0 flex-1">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-white px-5 py-4 md:px-8"><div><h1 className="text-lg font-bold">Panel de control</h1><p className="text-xs text-slate-500">Gestión de documentos administrativos</p></div><div className="flex items-center gap-2"><button onClick={()=>void loadRows()} className="rounded-lg border p-2.5 text-slate-600 hover:bg-slate-50" title="Actualizar"><RefreshCw size={17}/></button><button onClick={()=>newDocument()} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={17}/> Nuevo documento</button></div></header>
      <div className="p-5 md:p-8">
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<button onClick={()=>setError("")} className="float-right"><X size={16}/></button></div>}
        {notice && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}<button onClick={()=>setNotice("")} className="float-right"><X size={16}/></button></div>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5 mb-8">
          {[["Documentos totales",stats.total,"#2563eb"],["Oficios",stats.oficios,"#059669"],["Memorándums",stats.memos,"#2563eb"],["Circulares",stats.circulares,"#d97706"],["Citatorios",stats.citatorios,"#7c3aed"]].map(([label,value,color])=><div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold" style={{color:String(color)}}>{value}</p></div>)}
        </div>
        <section className="mb-8"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold text-lg">Acciones rápidas</h2><p className="text-sm text-slate-500">Crear un documento con plantilla inicial</p></div></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{DOC_TYPES.map((t,i)=>{const Icon=icons[i];return <button key={t} onClick={()=>newDocument(t)} className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"><Icon size={22} color={colors[i]}/><p className="mt-3 text-sm font-semibold">{t}</p><p className="mt-1 text-xs text-slate-500">Crear documento</p></button>})}</div></section>
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-lg">Historial de documentos</h2><p className="text-sm text-slate-500">{filtered.length} registro(s) encontrados</p></div><div className="flex items-center gap-2 text-sm text-slate-500"><Filter size={16}/> Filtros</div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={16}/><input aria-label="Buscar" placeholder="Folio, destinatario o asunto" value={query} onChange={e=>setQuery(e.target.value)} className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-blue-500"/></label><select aria-label="Tipo de documento" value={filterType} onChange={e=>setFilterType(e.target.value)} className="rounded-lg border px-3 py-2.5 text-sm"><option value="">Todos los tipos</option>{DOC_TYPES.map(t=><option key={t}>{t}</option>)}</select><input aria-label="Desde" type="date" value={from} onChange={e=>setFrom(e.target.value)} className="rounded-lg border px-3 py-2.5 text-sm"/><input aria-label="Hasta" type="date" value={to} onChange={e=>setTo(e.target.value)} className="rounded-lg border px-3 py-2.5 text-sm"/></div></div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Folio","Fecha","Tipo","Destinatario / asunto","Estado","Acciones"].map(h=><th key={h} className="whitespace-nowrap px-5 py-3 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
          {loading ? <tr><td colSpan={6} className="p-12 text-center text-slate-500"><LoaderCircle className="inline animate-spin mr-2" size={17}/>Cargando documentos…</td></tr> : filtered.length===0 ? <tr><td colSpan={6} className="p-12 text-center text-slate-500">No hay documentos que coincidan con los filtros.</td></tr> : filtered.map(r=><tr key={r.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-5 py-4 font-semibold">{r.folio}</td><td className="whitespace-nowrap px-5 py-4 text-slate-500">{prettyDate(r.fecha_documento)}</td><td className="px-5 py-4"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{r.tipo_documento}</span></td><td className="min-w-56 px-5 py-4"><p className="font-medium">{r.destinatario}</p><p className="mt-1 max-w-64 truncate text-xs text-slate-500">{r.asunto_tema}</p></td><td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{r.estado}</span></td><td className="whitespace-nowrap px-5 py-4"><button title="Editar" onClick={()=>editDocument(r)} className="mr-2 rounded p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600"><Pencil size={16}/></button><button title="Descargar PDF" onClick={()=>void exportPdf(r)} className="rounded p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"><Download size={16}/></button></td></tr>)}
          </tbody></table></div>
        </section>
        <p className="mt-5 text-xs text-slate-400">SGE Admin · Los folios se asignan en PostgreSQL y no se generan en el navegador.</p>
      </div>
    </main>
    {modal && <div className="fixed inset-0 z-30 grid place-items-center overflow-y-auto bg-slate-950/50 p-4"><div className="my-5 w-full max-w-2xl rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-5"><div><h2 className="font-bold text-lg">{editing ? "Editar documento" : "Generador de documentos"}</h2><p className="text-sm text-slate-500">{editing ? `Folio ${editing.folio}` : "Completa los datos y guarda para asignar un folio"}</p></div><button onClick={()=>setModal(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20}/></button></div>
      <form onSubmit={saveDocument} className="space-y-4 p-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Tipo de documento<select value={form.tipo_documento} onChange={e=>{const t=e.target.value as DocType;updateField("tipo_documento",t);if(!editing)updateField("contenido",TEMPLATE_TEXT[t]);}} className="mt-1.5 w-full rounded-lg border p-3" required>{DOC_TYPES.map(t=><option key={t}>{t}</option>)}</select></label><label className="text-sm font-medium">Fecha del documento<input type="date" value={form.fecha_documento} onChange={e=>updateField("fecha_documento",e.target.value)} className="mt-1.5 w-full rounded-lg border p-3" required/></label></div>
      <label className="block text-sm font-medium">Destinatario<input value={form.destinatario} onChange={e=>updateField("destinatario",e.target.value)} placeholder="Nombre, departamento o dependencia" className="mt-1.5 w-full rounded-lg border p-3" maxLength={250} required/></label>
      <label className="block text-sm font-medium">Asunto / tema<input value={form.asunto_tema} onChange={e=>updateField("asunto_tema",e.target.value)} placeholder="Asunto del documento" className="mt-1.5 w-full rounded-lg border p-3" maxLength={300} required/></label>
      <label className="block text-sm font-medium">Contenido<textarea value={form.contenido} onChange={e=>updateField("contenido",e.target.value)} rows={7} placeholder="Redacta el cuerpo del documento…" className="mt-1.5 w-full rounded-lg border p-3 leading-6" maxLength={20000}/></label>
      {!editing && <p className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-800">Al guardar, la base de datos asignará el siguiente folio disponible para este tipo y año. No se consume un folio al abrir el formulario.</p>}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-3 border-t pt-4"><button type="button" onClick={()=>setModal(false)} className="rounded-lg border px-4 py-2.5 text-sm">Cancelar</button><button disabled={saving} className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving && <LoaderCircle size={16} className="animate-spin"/>}{editing ? "Guardar cambios" : "Guardar documento"}</button></div>
      </form></div></div>}
  </div>;
}

function SetupMessage() {
  return <main className="min-h-screen grid place-items-center p-6"><div className="max-w-xl rounded-2xl border bg-white p-8 shadow-sm"><School className="mb-4 text-blue-600" size={36}/><h1 className="text-2xl font-bold">SGE Admin</h1><p className="mt-3 text-slate-600">Para conectar la aplicación, configura las variables de Supabase en <code>.env.local</code> a partir de <code>.env.example</code>, y aplica la migración SQL incluida en <code>supabase/migrations</code>.</p></div></main>;
}
