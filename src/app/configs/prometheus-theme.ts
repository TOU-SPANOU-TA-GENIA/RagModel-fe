import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * Prometheus Theme - Futuristic dark theme with cyan accents
 */
export const PrometheusPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#e0f7fa',
      100: '#b2ebf2',
      200: '#80deea',
      300: '#4dd0e1',
      400: '#26c6da',
      500: '#00bcd4',
      600: '#00acc1',
      700: '#0097a7',
      800: '#00838f',
      900: '#006064',
      950: '#004d40'
    },
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617'
        },
        primary: {
          color: '#00bcd4',
          contrastColor: '#0a0e14',
          hoverColor: '#26c6da',
          activeColor: '#0097a7'
        }
      },
      dark: {
        surface: {
          0: '#0a0e14',
          50: '#0d1117',
          100: '#161b22',
          200: '#21262d',
          300: '#30363d',
          400: '#484f58',
          500: '#6e7681',
          600: '#8b949e',
          700: '#c9d1d9',
          800: '#e6edf3',
          900: '#f0f6fc',
          950: '#ffffff'
        },
        primary: {
          color: '#00e5ff',
          contrastColor: '#0a0e14',
          hoverColor: '#18ffff',
          activeColor: '#00b8d4'
        },
        highlight: {
          background: 'rgba(0, 229, 255, 0.16)',
          focusBackground: 'rgba(0, 229, 255, 0.24)',
          color: '#00e5ff',
          focusColor: '#18ffff'
        }
      }
    }
  }
});

export default PrometheusPreset;
