import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // .env tunggal di root repo (hanya variabel berprefix VITE_ yang masuk ke bundle)
  envDir: '..',
  plugins: [react()],
})
