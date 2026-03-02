import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppProvider } from '@/app/contexts/app-context';
import { VenueProvider } from '@/app/contexts/venue-context';

interface AllTheProvidersProps {
  children: ReactNode;
  initialRoute?: string;
}

function AllTheProviders({ children, initialRoute = '/' }: AllTheProvidersProps) {
  return (
    <MemoryRouter initialEntries={[initialRoute]}>
      <AppProvider>
        <VenueProvider>{children}</VenueProvider>
      </AppProvider>
    </MemoryRouter>
  );
}

function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { initialRoute?: string }
) {
  const { initialRoute = '/', ...renderOptions } = options ?? {};
  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders initialRoute={initialRoute}>{children}</AllTheProviders>
    ),
    ...renderOptions,
  });
}

export * from '@testing-library/react';
export { customRender as render };
