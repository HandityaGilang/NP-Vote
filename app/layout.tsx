import './globals.css';

export const metadata = {
  title: 'Funtastic Sakti',
  description: 'Voting lomba yang mudah untuk semua.',
  icons: { icon: '/NP.png' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
