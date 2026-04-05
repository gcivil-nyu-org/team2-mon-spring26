import { describe, it } from 'vitest';

describe('Debug', () => {
  it('renders', async () => {
    try {
      const module = await import('../restaurant-card');
      console.log('Keys:', Object.keys(module));
    } catch (e) {
      console.log('Error importing:', e);
    }
  });
});
