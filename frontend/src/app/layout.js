import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import NavBar from "./components/NavBar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata = {
  title: "Asociación Vecinal 3C",
  description: "Gestión de reservas, biblioteca y servicios de la asociación.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#f4f7f5]">
        <AuthProvider>
          <NavBar />
          <div className="flex-1 pb-20 sm:pb-0">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
