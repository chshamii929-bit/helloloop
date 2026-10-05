import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
 title: "ChitChat — Meet someone new",
 description: "Real conversations. New connections. A relaxed space to meet people over video.",
 icons: { icon: "/favicon.svg" },
 robots: { index: false, follow: false },
};
export default function RootLayout({children}: Readonly<{children:React.ReactNode}>) {
 return <html lang="en" className="dark"><body>{children}</body></html>;
}

