export const DOC_TYPES = [
  "Memorándum", "Oficio", "Citatorio Grupal",
  "Citatorio Personal", "Circular", "Acta de Hechos",
] as const;
export type DocType = typeof DOC_TYPES[number];

export const PREFIX: Record<DocType, string> = {
  "Memorándum": "MEM", "Oficio": "OF", "Citatorio Grupal": "CIT-G",
  "Citatorio Personal": "CIT-P", "Circular": "CIR", "Acta de Hechos": "ACT",
};

export const TEMPLATE_TEXT: Record<DocType, string> = {
  "Memorándum": "Por medio del presente se informa que [DESCRIBIR EL MOTIVO]. Se solicita su atención y seguimiento correspondiente.",
  "Oficio": "Por este conducto me permito dirigirme a usted para [DESCRIBIR SOLICITUD O ASUNTO]. Sin otro particular, agradezco su atención.",
  "Citatorio Grupal": "Se convoca a madres, padres y tutores a la reunión que se llevará a cabo el día [FECHA] a las [HORA] en [LUGAR], para tratar asuntos relacionados con [ASUNTO].",
  "Citatorio Personal": "Por medio del presente se solicita su presencia el día [FECHA] a las [HORA] para tratar asuntos relacionados con el/la estudiante y dar seguimiento oportuno.",
  "Circular": "Se comunica a la comunidad escolar que [COMUNICADO]. Agradecemos su atención y colaboración.",
  "Acta de Hechos": "En las instalaciones del plantel, siendo las [HORA] del día [FECHA], se hace constar lo siguiente: [DESCRIPCIÓN OBJETIVA DE LOS HECHOS]. Se levanta la presente para los efectos administrativos correspondientes.",
};

export type DocumentRow = {
  id: string; tipo_documento: DocType; folio: string; fecha_creacion: string;
  fecha_documento: string; destinatario: string; asunto_tema: string;
  contenido: string; archivo_pdf_path: string | null; estado: string;
};

export function prettyDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value + "T12:00:00Z"));
}
