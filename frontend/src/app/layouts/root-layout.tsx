import { Outlet } from 'react-router';
import { FloatingChat } from '@/app/components/floating-chat';
import { Toaster } from '@/app/components/ui/sonner';

export function RootLayout() {
  return (
    <>
      <Outlet />
      <FloatingChat />
      <Toaster />
    </>
  );
}
