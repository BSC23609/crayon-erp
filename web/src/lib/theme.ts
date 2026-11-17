export function toggleTheme() {
  const dark = document.documentElement.classList.toggle('dark')
  try { localStorage.setItem('theme', dark ? 'dark' : 'light') } catch { /* storage unavailable */ }
  return dark
}
export const isDark = () => document.documentElement.classList.contains('dark')
