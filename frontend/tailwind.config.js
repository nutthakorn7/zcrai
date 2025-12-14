import { heroui } from "@heroui/react";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Roboto", "sans-serif"],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in',
        'fade-in-up': 'fadeInUp 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      },
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      prefix: "heroui",
      addCommonColors: true,
      defaultTheme: "dark", // บังคับ Dark Mode เป็น Default
      defaultExtendTheme: "dark",
      layout: {
        radius: {
          small: "4px",
          medium: "6px",
          large: "8px",
        },
        borderWidth: {
          small: "1px",
          medium: "1px", 
        },
      },
      themes: {
        dark: {
          layout: {
            radius: {
              small: "4px",
              medium: "6px",
              large: "8px",
            },
          },
          colors: {
            background: "#111315", // Chinese Black (Main BG)
            foreground: "#ECEDEE", // Text Color (White-ish)
            
            // Surface colors (Card, Sidebar)
            content1: "#1A1D1F", // Eerie Black
            content2: "#242527", // Raisin Black (Hover)
            content3: "#353839", // Onyx (Active)
            content4: "#4A4D50", // Lighter divider

            // Action Colors
            primary: {
              DEFAULT: "#C0DBEF", // Beau Blue (Main Action)
              foreground: "#111315", // Text on Primary Button (Dark)
            },
            secondary: {
              DEFAULT: "#FDC693", // Peach-Orange
              foreground: "#111315",
            },
            success: {
              DEFAULT: "#FFEE98", // Flavescent (Adapting for positive vibes)
              foreground: "#111315",
            },
            // Mapping colors to HeroUI semantics
            focus: "#C0DBEF", 
          },
        },
      },
    }),
    require('@tailwindcss/typography'),
  ],
}