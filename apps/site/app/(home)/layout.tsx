import Nav from '@/components/landing/Nav';
import Footer from '@/components/landing/Footer';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-white text-base text-neutral-900 antialiased selection:bg-blue-500/20 dark:bg-stone-950 dark:text-neutral-50">
      <Nav />
      {children}
      <Footer />
    </div>
  );
}
