import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SGE | Control Administrativo Escolar",
  description: "Sistema de gestión de documentos administrativos escolares",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
