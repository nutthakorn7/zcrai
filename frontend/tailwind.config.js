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
        sans: ["Inter", "sans-serif"],
        display: ["Outfit", "sans-serif"],
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
            background: "#09090b", 
            foreground: "#fafafa", 
            
            // Surface colors
            content1: "#111114", 
            content2: "#18181b", 
            content3: "#27272a", 
            content4: "#3f3f46", 
 
            // Action Colors
            primary: {
              DEFAULT: "#00d8ff", 
              foreground: "#09090b", 
            },
            secondary: {
              DEFAULT: "#8b5cf6", 
              foreground: "#fafafa",
            },
            success: {
              DEFAULT: "#10b981", 
              foreground: "#fafafa",
            },
            warning: {
              DEFAULT: "#f59e0b",
              foreground: "#09090b",
            },
            danger: {
              DEFAULT: "#ef4444",
              foreground: "#fafafa",
            },
            focus: "#00d8ff", 
          },
        },
      },
    }),
    require('@tailwindcss/typography'),
  ],
}