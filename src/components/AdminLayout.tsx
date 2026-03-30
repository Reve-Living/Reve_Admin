import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Layers, 
  Folder,
  ShoppingCart, 
  Settings, 
  LogOut,
  PlusCircle,
  Truck,
  Star,
  Image,
  TicketPercent,
  BookOpen,
} from 'lucide-react';
import { cn } from '../lib/utils';

const sidebarLinks = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Products', href: '/products', icon: ShoppingBag },
  { name: 'Categories', href: '/categories', icon: Layers },
  { name: 'Collections', href: '/collections', icon: Folder },
  { name: 'Hero Slider', href: '/hero-slides', icon: Image },
  { name: 'Lifestyle Content', href: '/lifestyle-content', icon: BookOpen },
  { name: 'Promotions', href: '/promotions', icon: TicketPercent },
  { name: 'Mattresses', href: '/mattresses', icon: Layers },
  { name: 'Orders', href: '/orders', icon: ShoppingCart },
  { name: 'Reviews', href: '/reviews', icon: Star },
  { name: 'Delivery & Returns', href: '/policies', icon: Truck },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const Sidebar = () => {
  const location = useLocation();

  return (
    <div className="flex h-full w-64 flex-col bg-espresso text-ivory">
      <div className="flex h-16 items-center justify-center border-b border-white/10 px-6">
        <span className="text-xl font-serif font-bold tracking-wider uppercase">Reve Admin</span>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {sidebarLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.href;
            return (
              <Link
                key={link.name}
                to={link.href}
                className={cn(
                  'group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive 
                    ? 'bg-primary text-white' 
                    : 'text-ivory/70 hover:bg-white/5 hover:text-ivory'
                )}
              >
                <Icon className="mr-3 h-5 w-5 shrink-0" />
                {link.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t border-white/10 p-4">
        <button 
          onClick={() => {
            localStorage.removeItem('isLoggedIn');
            window.location.href = '/';
          }}
          className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-ivory/70 hover:bg-white/5 hover:text-ivory transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5 shrink-0" />
          Logout
        </button>
      </div>
    </div>
  );
};

const AdminLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b bg-white px-8">
          <h1 className="text-lg font-medium text-espresso">Admin Panel</h1>
          <div className="flex items-center space-x-4">
            <Link to="/products/new">
              <button className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors">
                <PlusCircle className="mr-2 h-4 w-4" />
                New Product
              </button>
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-gray-50/50 p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
