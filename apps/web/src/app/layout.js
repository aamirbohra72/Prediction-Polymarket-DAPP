import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import Nav from "@/components/Nav";
import SolanaProvider from "@/components/SolanaProvider";

export const metadata = {
  title: "StockPredict — Play-Money Prediction Markets",
  description: "Trade YES/NO shares on stock price questions. Play money only.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SolanaProvider>
          <Nav />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-[var(--muted)]">
            Play money only. Not financial advice. Prices from third-party API.
          </footer>
        </SolanaProvider>
      </body>
    </html>
  );
}
