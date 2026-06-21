/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        cyber: {
          bg: '#0A0E17',
          panel: '#121826',
          card: '#1A2332',
          line: '#1E2A3D',
          cyan: '#00F0FF',
          'cyan-dim': '#0094A8',
          green: '#00FF88',
          'green-dim': '#00A357',
          amber: '#FF9500',
          'amber-dim': '#B36900',
          red: '#FF2D55',
          'red-dim': '#B3203C',
          rose: '#FF6B8A',
          purple: '#AF52DE',
          grey: '#8A9BB3',
        }
      },
      boxShadow: {
        'neon-cyan': '0 0 12px rgba(0,240,255,0.4), 0 0 24px rgba(0,240,255,0.15)',
        'neon-green': '0 0 12px rgba(0,255,136,0.4), 0 0 24px rgba(0,255,136,0.15)',
        'neon-amber': '0 0 12px rgba(255,149,0,0.4), 0 0 24px rgba(255,149,0,0.15)',
        'neon-red': '0 0 12px rgba(255,45,85,0.5), 0 0 24px rgba(255,45,85,0.2)',
        'neon-inset': 'inset 0 0 20px rgba(0,240,255,0.05)',
      },
      backgroundImage: {
        'scanlines': 'repeating-linear-gradient(0deg, rgba(0,240,255,0.03) 0px, rgba(0,240,255,0.03) 1px, transparent 1px, transparent 3px)',
        'grid-cyber': 'linear-gradient(rgba(0,240,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.04) 1px, transparent 1px)',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
      animation: {
        'pulse-led': 'pulse-led 2s ease-in-out infinite',
        'blink-led': 'blink-led 0.8s steps(2) infinite',
        'scanline': 'scanline 8s linear infinite',
        'fault-pulse': 'fault-pulse 0.6s ease-out',
        'glitch': 'glitch 0.4s ease-in-out',
        'border-flow': 'border-flow 3s linear infinite',
      },
      keyframes: {
        'pulse-led': {
          '0%,100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.15)' },
        },
        'blink-led': {
          '0%,50%': { opacity: '0.3' },
          '51%,100%': { opacity: '1' },
        },
        'scanline': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'fault-pulse': {
          '0%': { boxShadow: '0 0 0 0 rgba(255,45,85,0.7)' },
          '100%': { boxShadow: '0 0 0 30px rgba(255,45,85,0)' },
        },
        'glitch': {
          '0%,100%': { transform: 'translate(0,0)', filter: 'hue-rotate(0deg)' },
          '20%': { transform: 'translate(-2px,1px)', filter: 'hue-rotate(90deg)' },
          '40%': { transform: 'translate(2px,-1px)', filter: 'hue-rotate(180deg)' },
          '60%': { transform: 'translate(-1px,2px)', filter: 'hue-rotate(270deg)' },
          '80%': { transform: 'translate(1px,-2px)', filter: 'hue-rotate(360deg)' },
        },
        'border-flow': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
      },
    },
  },
  plugins: [],
};
