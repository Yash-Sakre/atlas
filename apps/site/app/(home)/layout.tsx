import Nav from '@/components/landing/Nav';
import Footer from '@/components/landing/Footer';
import './landing.css';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <div className="landing">
      <Nav />
      {children}
      <Footer />
    </div>
  );
}
