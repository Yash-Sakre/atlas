/** Fixture tailwind config for design-system extraction tests. */
module.exports = {
  content: ['./src/**/*.{js,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#6366f1',
          900: '#312e81',
        },
      },
      borderRadius: {
        card: '14px',
      },
    },
  },
};
