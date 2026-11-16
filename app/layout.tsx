import type {Metadata} from "next";import "./globals.css";import "./enhancements.css";
export const metadata:Metadata={title:"HIREX UNIVERSE | One Universe. Infinite Adventures.",description:"HIREX UNIVERSE — a bilingual gaming universe with curated game stories, original artwork, and playable adventures.",other:{"codex-preview":"development"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fa" dir="rtl"><body>{children}</body></html>}
