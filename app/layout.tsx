import './globals.css';

export const metadata = {
  title: 'NPVote — Pilihan Anda berarti',
  description: 'Voting lomba yang mudah untuk semua.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
