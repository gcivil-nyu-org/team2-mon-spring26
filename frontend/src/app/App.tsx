import { RouterProvider } from 'react-router';
import { router } from '@/app/routes';
import { AppProvider } from '@/app/contexts/app-context';
import { VenueProvider } from '@/app/contexts/venue-context';

export default function App() {
  return (
    <AppProvider>
      <VenueProvider>
        <RouterProvider router={router} />
      </VenueProvider>
    </AppProvider>
  );
}