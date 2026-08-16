import type {Metadata} from "next";import "./globals.css";import "./enhancements.css";
export const metadata:Metadata={title:"GAMEVERSE_200",description:"A bilingual showcase of 200 score-ranked games with original artwork, five color themes, and the playable Shadow House 3D game.",other:{"codex-preview":"development"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fa" dir="rtl"><body>{children}</body></html>}
