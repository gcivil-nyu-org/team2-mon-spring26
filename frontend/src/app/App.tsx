import { RouterProvider } from 'react-router';
import { router } from '@/app/routes';
import { AppProvider } from '@/app/contexts/app-context';
import { VenueProvider } from '@/app/contexts/venue-context';
import { AdminProvider } from '@/app/contexts/admin-context';

export default function App() {
  return (
    <AppProvider>
      <VenueProvider>
        <AdminProvider>
          <RouterProvider router={router} />
        </AdminProvider>
      </VenueProvider>
    </AppProvider>
  );
}
